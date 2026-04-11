import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { getDefaultRoleDefinitions, PERMISSION_KEYS } from './permissions.js';
import {
  expandLegacyManageRoles,
  computePrivilegeTierFromPermissions,
} from '../lib/rbac.js';

let initialized = false;

function loadCredential() {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    const parsed = JSON.parse(jsonRaw);
    return admin.credential.cert(parsed);
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountPath) {
    const resolved = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath);
    const serviceAccount = JSON.parse(readFileSync(resolved, 'utf8'));
    return admin.credential.cert(serviceAccount);
  }

  return admin.credential.applicationDefault();
}

export function initFirebase() {
  if (initialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[Firebase Admin] FIREBASE_PROJECT_ID not set — admin features disabled.');
    return;
  }

  try {
    const credential = loadCredential();
    admin.initializeApp({ credential, projectId });
    initialized = true;
    console.log('[Firebase Admin] Initialized for project:', projectId);
  } catch (err) {
    console.error('[Firebase Admin] init failed:', err.message);
  }
}

export function isFirebaseAdminReady() {
  return initialized && admin.apps.length > 0;
}

export function getAdminAuth() {
  return admin.auth();
}

export function getAdminFirestore() {
  if (!isFirebaseAdminReady()) {
    throw new Error('Firebase Admin is not initialized');
  }
  return admin.firestore();
}

export async function verifyToken(idToken) {
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export async function getUserRole(uid) {
  try {
    const doc = await admin.firestore().collection('users').doc(uid).get();
    return doc.exists ? doc.data().role || 'user' : 'user';
  } catch {
    return 'user';
  }
}

/**
 * Sync built-in role docs + Owner role, merge new permission keys, backfill privilegeTier on custom roles.
 * Safe to run on every server start.
 */
export async function ensureDefaultRoleDefinitions() {
  if (!isFirebaseAdminReady()) return;
  const db = admin.firestore();
  const defs = getDefaultRoleDefinitions();
  const ts = admin.firestore.FieldValue.serverTimestamp();

  for (const def of Object.values(defs)) {
    const ref = db.collection('roleDefinitions').doc(def.key);
    const snap = await ref.get();
    let permissions = { ...def.permissions };
    if (snap.exists) {
      const existing = snap.data().permissions || {};
      for (const k of PERMISSION_KEYS) {
        if (existing[k] !== undefined) permissions[k] = existing[k];
      }
    }
    if (def.key === 'admin') permissions.protect_owner = false;
    if (def.key === 'owner') {
      permissions = { ...def.permissions };
      for (const k of PERMISSION_KEYS) permissions[k] = true;
    }

    const payload = {
      key: def.key,
      displayName: def.displayName,
      description: def.description,
      system: def.system,
      protected: def.protected,
      privilegeTier: def.privilegeTier,
      order: def.order,
      permissions,
      updatedAt: ts,
    };
    if (!snap.exists) {
      payload.createdAt = ts;
    }
    await ref.set(payload, { merge: true });
  }

  const allSnap = await db.collection('roleDefinitions').get();
  for (const doc of allSnap.docs) {
    if (defs[doc.id]) continue;
    const d = doc.data();
    if (d.privilegeTier) continue;
    const tier = computePrivilegeTierFromPermissions(d.permissions || {});
    await doc.ref.update({
      privilegeTier: tier,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log('[Firebase Admin] roleDefinitions synced (built-ins + metadata)');
}

/** Effective permission map for a Firebase Auth uid (legacy manage_roles expanded). */
export async function getUserPermissions(uid) {
  if (!isFirebaseAdminReady()) {
    return { roleKey: 'user', permissions: {} };
  }
  const db = admin.firestore();
  const uSnap = await db.collection('users').doc(uid).get();
  const roleKey = uSnap.exists ? (uSnap.data().role || 'user') : 'user';
  const rSnap = await db.collection('roleDefinitions').doc(roleKey).get();
  if (!rSnap.exists) {
    return { roleKey, permissions: {} };
  }
  const raw = rSnap.data().permissions || {};
  return { roleKey, permissions: expandLegacyManageRoles(raw) };
}
