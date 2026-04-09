import admin from 'firebase-admin';
import { createRequire } from 'module';

let initialized = false;
const require = createRequire(import.meta.url);

export function initFirebase() {
  if (initialized) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[Firebase Admin] FIREBASE_PROJECT_ID not set — admin features disabled.');
    return;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
  initialized = true;
  console.log('[Firebase Admin] Initialized for project:', projectId);
}

export function getAdminAuth() {
  return admin.auth();
}

export function getAdminFirestore() {
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
