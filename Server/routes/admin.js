import express from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore } from '../config/firebase.js';
import { assertCanAssignUserRole, assertCanModifyTargetUser } from '../lib/rbac.js';

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission('access_admin_panel'));

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
  const role = (req.body?.role || '').toString().trim();
  if (!role) return res.status(400).json({ error: 'role required' });
  try {
    const db = getAdminFirestore();
    const r = await db.collection('roleDefinitions').doc(role).get();
    if (!r.exists) {
      return res.status(400).json({ error: 'Unknown role key' });
    }
    await assertCanAssignUserRole(db, req.uid, req.params.uid, role);
    await db.collection('users').doc(req.params.uid).update({ role });
    res.json({ ok: true });
  } catch (err) {
    if (err.code) {
      const status = err.code === 'UNKNOWN_ROLE' ? 400 : 403;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Admin] set role error:', err);
    res.status(500).json({ error: 'Failed to set role' });
  }
});

router.post('/users/:uid/ban', requirePermission('ban_users'), async (req, res) => {
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, req.params.uid, { forBan: true });
    await db.collection('users').doc(req.params.uid).update({ banned: true });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Admin] ban error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:uid/unban', requirePermission('ban_users'), async (req, res) => {
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, req.params.uid, { forBan: true });
    await db.collection('users').doc(req.params.uid).update({ banned: false });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Admin] unban error:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

export default router;
