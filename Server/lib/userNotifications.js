import admin from 'firebase-admin';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';

/**
 * In-app notification for a single user (Firestore subcollection; client reads with rules).
 */
export async function notifyUser(userId, { type, title, body, appealId = null, meta = {} }) {
  if (!isFirebaseAdminReady() || !userId) return;
  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(userId).collection('notifications').add({
      type,
      title: (title || '').toString().slice(0, 120),
      body: (body || '').toString().slice(0, 2000),
      appealId,
      read: false,
      meta,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('[notifyUser]', userId, e?.message || e);
  }
}
