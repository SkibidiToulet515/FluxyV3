import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore } from '../config/firebase.js';
import { assertCanAssignUserRole, assertCanModifyTargetUser } from '../lib/rbac.js';
import { createBanPunishment, clearBanPunishment } from '../lib/moderationPunishments.js';

const router = express.Router();

router.use(requireAuth);
router.use(requirePermission('access_admin_panel'));

router.get('/users', async (req, res) => {
  try {
    const db = getAdminFirestore();
    const limitNum = Math.min(250, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const cursor = typeof req.query.cursor === 'string' && req.query.cursor.trim()
      ? req.query.cursor.trim()
      : null;

    let q = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(limitNum);
    if (cursor) {
      const cur = await db.collection('users').doc(cursor).get();
      if (cur.exists) q = q.startAfter(cur);
    }
    const snap = await q.get();
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const nextCursor = snap.docs.length === limitNum ? snap.docs[snap.docs.length - 1].id : null;
    res.json({ users, nextCursor });
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
  const reason = (req.body?.reason || '').toString().slice(0, 500);
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, req.params.uid, { forBan: true });
    await createBanPunishment(db, { targetUid: req.params.uid, issuedBy: req.uid, reason });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Admin] ban error:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/** Reset referral onboarding so the user sees “who told you” again (API-only). */
router.post('/users/:uid/referral-reset', async (req, res) => {
  try {
    const db = getAdminFirestore();
    await db.collection('users').doc(req.params.uid).update({
      hasCompletedReferral: false,
      referrals: admin.firestore.FieldValue.delete(),
      referralFoundMyself: admin.firestore.FieldValue.delete(),
      referralCompletedAt: admin.firestore.FieldValue.delete(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Admin] referral-reset:', err);
    res.status(500).json({ error: 'Failed to reset referral state' });
  }
});

router.post('/users/:uid/unban', requirePermission('ban_users'), async (req, res) => {
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, req.params.uid, { forBan: true });
    await clearBanPunishment(getAdminFirestore(), req.params.uid);
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
