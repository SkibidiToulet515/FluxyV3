import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';
import { assertCanModifyTargetUser, roleDocTier, OWNER_ROLE_KEY } from '../lib/rbac.js';
import {
  createWarningPunishment,
  createMutePunishment,
  clearMutePunishment,
  createBanPunishment,
  clearBanPunishment,
} from '../lib/moderationPunishments.js';

const router = express.Router();

function dbReady(res) {
  if (!isFirebaseAdminReady()) {
    res.status(503).json({ error: 'Server moderation unavailable' });
    return false;
  }
  return true;
}

async function writeLog(actorUid, action, details = {}, targetUid = null) {
  const db = getAdminFirestore();
  await db.collection('moderationLogs').add({
    actorUid,
    targetUid,
    action,
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

router.use(requireAuth);

router.get('/users', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  try {
    const db = getAdminFirestore();
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const snap = await db.collection('users').limit(500).get();
    let users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    if (q) {
      users = users.filter(
        (u) =>
          u.username?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.uid?.toLowerCase().includes(q),
      );
    }
    const uniqueRoleKeys = [...new Set(users.map((u) => u.role || 'user'))];
    const roleRefs = uniqueRoleKeys.map((k) => db.collection('roleDefinitions').doc(k));
    const roleSnaps = roleRefs.length ? await db.getAll(...roleRefs) : [];
    const tierByRoleKey = {};
    roleSnaps.forEach((doc, i) => {
      const key = uniqueRoleKeys[i];
      if (doc.exists) {
        tierByRoleKey[key] = roleDocTier(doc.data(), key);
      } else {
        tierByRoleKey[key] = key === OWNER_ROLE_KEY ? 'owner' : 'low';
      }
    });
    users = users.map((u) => ({
      ...u,
      rolePrivilegeTier: tierByRoleKey[u.role || 'user'] || 'low',
    }));
    res.json({ users });
  } catch (err) {
    console.error('[Moderation] list users:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users/:uid/warn', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { uid } = req.params;
  if (uid === req.uid) return res.status(400).json({ error: 'Cannot warn yourself' });
  const reason = (req.body?.reason || '').toString().slice(0, 500);
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, uid);
    await createWarningPunishment(db, { targetUid: uid, issuedBy: req.uid, reason });
    await writeLog(req.uid, 'warn', { reason }, uid);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Moderation] warn:', err);
    res.status(500).json({ error: 'Failed to warn user' });
  }
});

router.post('/users/:uid/mute', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { uid } = req.params;
  if (uid === req.uid) return res.status(400).json({ error: 'Cannot mute yourself' });
  const minutes = Math.min(Math.max(Number(req.body?.minutes) || 60, 1), 10080);
  const reason = (req.body?.reason || '').toString().slice(0, 500);
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, uid);
    const until = new Date(Date.now() + minutes * 60 * 1000);
    await createMutePunishment(db, {
      targetUid: uid,
      issuedBy: req.uid,
      reason,
      until,
    });
    await writeLog(req.uid, 'mute', { minutes, until: until.toISOString(), reason }, uid);
    res.json({ ok: true, until: until.toISOString() });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Moderation] mute:', err);
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

router.post('/users/:uid/unmute', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { uid } = req.params;
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, uid);
    await clearMutePunishment(db, uid);
    await writeLog(req.uid, 'unmute', {}, uid);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Moderation] unmute:', err);
    res.status(500).json({ error: 'Failed to unmute user' });
  }
});

router.post('/users/:uid/ban', requirePermission('ban_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { uid } = req.params;
  if (uid === req.uid) return res.status(400).json({ error: 'Cannot ban yourself' });
  const reason = (req.body?.reason || '').toString().slice(0, 500);
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, uid);
    await createBanPunishment(db, { targetUid: uid, issuedBy: req.uid, reason });
    await writeLog(req.uid, 'ban', { reason }, uid);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Moderation] ban:', err);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:uid/unban', requirePermission('ban_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { uid } = req.params;
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, uid);
    await clearBanPunishment(db, uid);
    await writeLog(req.uid, 'unban', {}, uid);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Moderation] unban:', err);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

router.post('/users/:uid/restrict', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { uid } = req.params;
  if (uid === req.uid) return res.status(400).json({ error: 'Cannot restrict yourself' });
  const restricted = Boolean(req.body?.restricted);
  const note = (req.body?.note || '').toString().slice(0, 300);
  try {
    const db = getAdminFirestore();
    await assertCanModifyTargetUser(db, req.uid, uid);
    await db.collection('users').doc(uid).update({
      chatRestricted: restricted,
      ...(note ? { moderationNote: note } : {}),
    });
    await writeLog(req.uid, restricted ? 'restrict_chat' : 'unrestrict_chat', { note }, uid);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Moderation] restrict:', err);
    res.status(500).json({ error: 'Failed to update restriction' });
  }
});

router.get('/logs', requirePermission('access_moderator_panel'), async (req, res) => {
  if (!dbReady(res)) return;
  const limit = Math.min(Number(req.query.limit) || 80, 200);
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('moderationLogs')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ logs });
  } catch (err) {
    console.error('[Moderation] logs:', err);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

router.get('/reports', requirePermission('access_moderator_panel'), async (req, res) => {
  if (!dbReady(res)) return;
  try {
    const db = getAdminFirestore();
    const status = (req.query.status || 'open').toString();
    let snap;
    if (status === 'all') {
      snap = await db.collection('reports').orderBy('createdAt', 'desc').limit(100).get();
    } else {
      snap = await db
        .collection('reports')
        .where('status', '==', status)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
    }
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ reports });
  } catch (err) {
    console.error('[Moderation] reports:', err);
    res.status(500).json({ error: 'Failed to load reports' });
  }
});

router.patch('/reports/:id', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const { id } = req.params;
  const status = (req.body?.status || '').toString();
  if (!['open', 'reviewing', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const db = getAdminFirestore();
    await db.collection('reports').doc(id).update({
      status,
      resolvedBy: req.uid,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await writeLog(req.uid, 'report_status', { reportId: id, status });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Moderation] report patch:', err);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

router.get('/users/:uid/notes', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('moderationUserNotes')
      .where('targetUid', '==', req.params.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const notes = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        body: x.body || '',
        authorUid: x.authorUid,
        createdAt: x.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    res.json({ notes });
  } catch (err) {
    console.error('[Moderation] notes list:', err);
    res.status(500).json({ error: 'Failed to load notes' });
  }
});

router.post('/users/:uid/notes', requirePermission('manage_users'), async (req, res) => {
  if (!dbReady(res)) return;
  const body = (req.body?.body || '').toString().slice(0, 2000);
  if (!body.trim()) return res.status(400).json({ error: 'body required' });
  try {
    const db = getAdminFirestore();
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const ref = await db.collection('moderationUserNotes').add({
      targetUid: req.params.uid,
      authorUid: req.uid,
      body,
      createdAt: ts,
    });
    await writeLog(req.uid, 'mod_note', { noteId: ref.id, preview: body.slice(0, 120) }, req.params.uid);
    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[Moderation] note add:', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

export default router;
