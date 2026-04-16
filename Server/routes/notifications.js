import express from 'express';
import admin from 'firebase-admin';
import { requireAuth } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';

const router = express.Router();
router.use(requireAuth);

function tsIso(v) {
  if (!v?.toDate) return null;
  try {
    return v.toDate().toISOString();
  } catch {
    return null;
  }
}

router.get('/me', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('users')
      .doc(req.uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const notifications = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        type: x.type,
        title: x.title,
        body: x.body,
        appealId: x.appealId || null,
        read: x.read === true,
        meta: x.meta || {},
        createdAt: tsIso(x.createdAt),
      };
    });
    res.json({ notifications });
  } catch (err) {
    console.error('[Notifications]', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

router.post('/read-all', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const col = db.collection('users').doc(req.uid).collection('notifications');
    const snap = await col.where('read', '==', false).limit(500).get();
    const batch = db.batch();
    const ts = admin.firestore.FieldValue.serverTimestamp();
    snap.docs.forEach((d) => {
      batch.update(d.ref, { read: true, readAt: ts });
    });
    await batch.commit();
    res.json({ ok: true, updated: snap.size });
  } catch (err) {
    console.error('[Notifications] read-all:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/:id/read', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const ref = db.collection('users').doc(req.uid).collection('notifications').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    await ref.update({ read: true, readAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Notifications] read:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

export default router;
