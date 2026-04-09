import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';

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
