import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAdminFirestore } from '../config/firebase.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/users', async (req, res) => {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('users').get();
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    res.json({ users });
  } catch (err) {
    console.error('[Admin] list users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users/:uid/role', async (req, res) => {
  const { role } = req.body;
  if (!['user', 'mod', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(req.params.uid).update({ role });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] set role error:', err);
    res.status(500).json({ error: 'Failed to set role' });
  }
});

router.post('/users/:uid/ban', async (req, res) => {
  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(req.params.uid).update({ banned: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] ban error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:uid/unban', async (req, res) => {
  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(req.params.uid).update({ banned: false });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] unban error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

export default router;
