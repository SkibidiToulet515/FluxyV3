import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady, getUserPermissions } from '../config/firebase.js';
import { assertCanModifyTargetUser } from '../lib/rbac.js';
import { fingerprintLegacyWarning, syntheticBanId, syntheticMuteId } from '../lib/punishmentUtils.js';
import { notifyUser } from '../lib/userNotifications.js';
import { clearBanPunishment, clearMutePunishment } from '../lib/moderationPunishments.js';

const router = express.Router();

const MIN_APPEAL_LEN = 40;
const MAX_APPEAL_LEN = 8000;
const COOLDOWN_SAME_PUNISHMENT_MS = 12 * 60 * 60 * 1000;
const MAX_APPEALS_PER_WEEK = 10;

const OPEN_STATUSES = ['pending', 'under_review'];
const TERMINAL = ['accepted', 'denied', 'modified'];

function dbReady(res) {
  if (!isFirebaseAdminReady()) {
    res.status(503).json({ error: 'Appeals unavailable' });
    return false;
  }
  return true;
}

function tsToIso(v) {
  if (!v) return null;
  if (v.toDate) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return typeof v === 'string' ? v : null;
}

async function writeModerationLog(actorUid, action, details = {}, targetUid = null) {
  const db = getAdminFirestore();
  await db.collection('moderationLogs').add({
    actorUid,
    targetUid,
    action,
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function isIndexError(err) {
  const c = err?.code;
  return c === 9 || c === 'failed-precondition' || String(err?.message || '').includes('index');
}

async function hasOpenAppeal(db, punishmentId) {
  try {
    const snap = await db
      .collection('appeals')
      .where('punishmentId', '==', punishmentId)
      .where('status', 'in', OPEN_STATUSES)
      .limit(1)
      .get();
    return !snap.empty;
  } catch (err) {
    if (isIndexError(err)) {
      console.warn('[Appeals] hasOpenAppeal index query failed; scanning (slow):', err.message);
      const loose = await db
        .collection('appeals')
        .where('punishmentId', '==', punishmentId)
        .limit(25)
        .get();
      return loose.docs.some((d) => OPEN_STATUSES.includes(d.data().status));
    }
    throw err;
  }
}

async function notifyStaffNewAppeal(db, actorUid, appealId, ptype) {
  try {
    const snap = await db.collection('users').where('role', 'in', ['mod', 'admin', 'owner']).limit(45).get();
    const results = await Promise.allSettled(
      snap.docs.map((d) => {
        if (d.id === actorUid) return Promise.resolve();
        return notifyUser(d.id, {
          type: 'appeal_received',
          title: 'New appeal',
          body: `A user submitted an appeal (${ptype}).`,
          appealId,
        });
      }),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      console.warn('[Appeals] notifyStaffNewAppeal: some notifications failed', failed.length);
    }
  } catch (e) {
    console.warn('[Appeals] notifyStaffNewAppeal:', e?.message || e);
  }
}

/** Resolve punishment doc or synthetic legacy reference */
async function resolvePunishment(db, userId, punishmentId) {
  if (punishmentId.startsWith('legacy-w-')) {
    const uref = db.collection('users').doc(userId);
    const us = await uref.get();
    const u = us.data() || {};
    const warnings = Array.isArray(u.warnings) ? u.warnings : [];
    const fp = punishmentId.slice('legacy-w-'.length);
    const match = warnings.find((w) => !w.id && fingerprintLegacyWarning(w) === fp);
    if (!match) return { error: 'Warning not found' };
    return {
      synthetic: true,
      id: punishmentId,
      userId,
      type: 'warning',
      reason: match.reason || '',
      issuedBy: match.by || null,
      issuedAt: match.at || null,
      expiresAt: null,
      active: true,
      legacyWarning: match,
    };
  }
  if (punishmentId.startsWith('synthetic-ban-')) {
    const us = await db.collection('users').doc(userId).get();
    const u = us.data() || {};
    if (!u.banned) return { error: 'No active ban' };
    return {
      synthetic: true,
      id: punishmentId,
      userId,
      type: 'ban',
      reason: u.banReason || u.moderationNote || 'No reason on file.',
      issuedBy: u.banIssuedBy || null,
      issuedAt: u.banIssuedAt || null,
      expiresAt: null,
      active: true,
    };
  }
  if (punishmentId.startsWith('synthetic-mute-')) {
    const us = await db.collection('users').doc(userId).get();
    const u = us.data() || {};
    const mu = u.mutedUntil;
    if (!mu) return { error: 'Not muted' };
    const until = mu.toDate ? mu.toDate() : new Date(mu);
    if (until.getTime() <= Date.now()) return { error: 'Mute expired' };
    return {
      synthetic: true,
      id: punishmentId,
      userId,
      type: 'mute',
      reason: u.muteReason || 'No reason on file.',
      issuedBy: u.muteIssuedBy || null,
      issuedAt: u.muteIssuedAt || null,
      expiresAt: until.toISOString(),
      active: true,
    };
  }

  const pref = db.collection('punishments').doc(punishmentId);
  const ps = await pref.get();
  if (ps.exists) {
    const p = ps.data();
    if (p.userId !== userId) return { error: 'Forbidden' };
    if (!p.active) return { error: 'Punishment is no longer active' };
    return { synthetic: false, id: punishmentId, ...p };
  }

  const uSnap = await db.collection('users').doc(userId).get();
  const u = uSnap.data() || {};
  const warnings = Array.isArray(u.warnings) ? u.warnings : [];
  const w = warnings.find((x) => x.id === punishmentId);
  if (w) {
    return {
      synthetic: true,
      id: punishmentId,
      userId,
      type: 'warning',
      reason: w.reason || '',
      issuedBy: w.by || null,
      issuedAt: w.at || null,
      expiresAt: null,
      active: true,
      warningEntry: w,
    };
  }

  return { error: 'Punishment not found' };
}

router.use(requireAuth);

/** List appealable punishments for the signed-in user */
router.get('/eligible', async (req, res) => {
  if (!dbReady(res)) return;
  const uid = req.uid;
  try {
    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(uid).get();
    const u = userSnap.data() || {};
    const eligible = [];

    const punishSnap = await db
      .collection('punishments')
      .where('userId', '==', uid)
      .where('active', '==', true)
      .get();

    const punishmentDocs = punishSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const seenBan = punishmentDocs.some((p) => p.type === 'ban');
    const seenMute = punishmentDocs.some((p) => p.type === 'mute');

    for (const p of punishmentDocs) {
      const open = await hasOpenAppeal(db, p.id);
      if (open) continue;
      const cool = await checkCooldown(db, uid, p.id);
      if (!cool.ok) continue;

      eligible.push(formatPunishmentOut(p));
    }

    if (u.banned && !seenBan) {
      const sid = syntheticBanId(uid);
      if (!(await hasOpenAppeal(db, sid)) && (await checkCooldown(db, uid, sid)).ok) {
        eligible.push({
          id: sid,
          type: 'ban',
          reason: u.banReason || u.moderationNote || 'No reason on file.',
          issuedBy: u.banIssuedBy || null,
          issuedAt: u.banIssuedAt || null,
          expiresAt: null,
          synthetic: true,
        });
      }
    }

    const mu = u.mutedUntil;
    if (mu && !seenMute) {
      const until = mu.toDate ? mu.toDate() : new Date(mu);
      if (until.getTime() > Date.now()) {
        const sid = syntheticMuteId(uid);
        if (!(await hasOpenAppeal(db, sid)) && (await checkCooldown(db, uid, sid)).ok) {
          eligible.push({
            id: sid,
            type: 'mute',
            reason: u.muteReason || 'No reason on file.',
            issuedBy: u.muteIssuedBy || null,
            issuedAt: u.muteIssuedAt || null,
            expiresAt: until.toISOString(),
            synthetic: true,
          });
        }
      }
    }

    const warnings = Array.isArray(u.warnings) ? u.warnings : [];
    for (const w of warnings) {
      const punishmentId = w.id ? w.id : `legacy-w-${fingerprintLegacyWarning(w)}`;
      if (w.id && punishmentDocs.some((pd) => pd.id === w.id)) continue;

      if (await hasOpenAppeal(db, punishmentId)) continue;
      if (!(await checkCooldown(db, uid, punishmentId)).ok) continue;

      if (!w.id) {
        eligible.push({
          id: punishmentId,
          type: 'warning',
          reason: w.reason || '',
          issuedBy: w.by || null,
          issuedAt: w.at || null,
          expiresAt: null,
          synthetic: true,
          legacy: true,
        });
      } else if (!punishmentDocs.some((pd) => pd.id === w.id)) {
        eligible.push({
          id: w.id,
          type: 'warning',
          reason: w.reason || '',
          issuedBy: w.by || null,
          issuedAt: w.at || null,
          expiresAt: null,
          synthetic: true,
          legacy: false,
        });
      }
    }

    res.json({ punishments: dedupeEligible(eligible) });
  } catch (err) {
    console.error('[Appeals] eligible:', err);
    res.status(500).json({ error: 'Failed to load punishments' });
  }
});

function dedupeEligible(list) {
  const m = new Map();
  list.forEach((x) => {
    if (!m.has(x.id)) m.set(x.id, x);
  });
  return [...m.values()];
}

function formatPunishmentOut(p) {
  return {
    id: p.id,
    type: p.type,
    reason: p.reason || '',
    issuedBy: p.issuedBy || null,
    issuedAt: tsToIso(p.issuedAt) || p.issuedAt || null,
    expiresAt: p.expiresAt ? tsToIso(p.expiresAt) : p.expiresAt || null,
    synthetic: p.synthetic || false,
    legacy: p.legacy || false,
  };
}

async function checkCooldown(db, userId, punishmentId) {
  try {
    const snap = await db
      .collection('appeals')
      .where('userId', '==', userId)
      .where('punishmentId', '==', punishmentId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return { ok: true };
    const last = snap.docs[0].data();
    const st = last.status;
    if (OPEN_STATUSES.includes(st)) return { ok: false, reason: 'open' };
    const created = last.createdAt?.toDate?.();
    if (!created) return { ok: true };
    if (Date.now() - created.getTime() < COOLDOWN_SAME_PUNISHMENT_MS) {
      return { ok: false, reason: 'cooldown' };
    }
    return { ok: true };
  } catch (err) {
    if (isIndexError(err)) {
      console.warn('[Appeals] checkCooldown index query failed; lenient allow:', err.message);
      return { ok: true };
    }
    throw err;
  }
}

async function checkWeeklyCap(db, userId) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const snap = await db
      .collection('appeals')
      .where('userId', '==', userId)
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(weekAgo))
      .get();
    if (snap.size >= MAX_APPEALS_PER_WEEK) {
      return { ok: false, error: 'Too many appeals this week. Try again later.' };
    }
    return { ok: true };
  } catch (err) {
    if (isIndexError(err)) {
      console.warn('[Appeals] checkWeeklyCap index query failed; skipping cap:', err.message);
      return { ok: true };
    }
    throw err;
  }
}

/** User's appeal history */
router.get('/me', async (req, res) => {
  if (!dbReady(res)) return;
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('appeals')
      .where('userId', '==', req.uid)
      .orderBy('createdAt', 'desc')
      .limit(80)
      .get();
    const appeals = snap.docs.map((d) => serializeAppeal(d.id, d.data(), { includeInternal: false }));
    res.json({ appeals });
  } catch (err) {
    console.error('[Appeals] me:', err);
    res.status(500).json({ error: 'Failed to load appeals' });
  }
});

/** Submit appeal */
router.post('/', async (req, res) => {
  if (!dbReady(res)) return;
  const uid = req.uid;
  const punishmentId = (req.body?.punishmentId || '').toString().trim();
  const appealMessage = (req.body?.appealMessage || '').toString().trim();
  const perspectiveMessage = (req.body?.perspectiveMessage || '').toString().slice(0, 2000);
  const whyRemoveMessage = (req.body?.whyRemoveMessage || '').toString().slice(0, 2000);
  const evidenceLinks = (req.body?.evidenceLinks || '').toString().slice(0, 2000);
  const confirmAck = req.body?.confirmAck === true;

  if (!punishmentId) return res.status(400).json({ error: 'punishmentId required' });
  if (appealMessage.length < MIN_APPEAL_LEN) {
    return res.status(400).json({ error: `Appeal message must be at least ${MIN_APPEAL_LEN} characters` });
  }
  if (appealMessage.length > MAX_APPEAL_LEN) return res.status(400).json({ error: 'Appeal message too long' });
  if (!confirmAck) {
    return res.status(400).json({ error: 'You must acknowledge false or spam appeals may be denied' });
  }

  try {
    const db = getAdminFirestore();
    const cap = await checkWeeklyCap(db, uid);
    if (!cap.ok) return res.status(429).json({ error: cap.error });

    if (await hasOpenAppeal(db, punishmentId)) {
      return res.status(409).json({ error: 'An appeal is already open for this punishment' });
    }

    const cool = await checkCooldown(db, uid, punishmentId);
    if (!cool.ok && cool.reason === 'cooldown') {
      return res.status(429).json({ error: 'Wait before submitting another appeal for this punishment' });
    }

    const resolved = await resolvePunishment(db, uid, punishmentId);
    if (resolved.error) return res.status(400).json({ error: resolved.error });

    const punishmentReason = resolved.reason || '';
    const appealRef = db.collection('appeals').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    await appealRef.set({
      userId: uid,
      punishmentId,
      punishmentType: resolved.type,
      punishmentReason,
      issuedBy: resolved.issuedBy || null,
      issuedAtSnapshot: resolved.issuedAt || null,
      expiresAtSnapshot: resolved.expiresAt || null,
      appealMessage,
      perspectiveMessage: perspectiveMessage || null,
      whyRemoveMessage: whyRemoveMessage || null,
      evidenceLinks: evidenceLinks || null,
      confirmAck: true,
      status: 'pending',
      staffResponse: null,
      internalNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      modificationSummary: null,
      createdAt: now,
      updatedAt: now,
    });

    const pRef = db.collection('punishments').doc(punishmentId);
    const pSnap = await pRef.get();
    if (pSnap.exists) {
      await pRef.update({
        appealOpen: true,
        lastAppealId: appealRef.id,
        updatedAt: now,
      });
    }

    try {
      await notifyUser(uid, {
        type: 'appeal_submitted',
        title: 'Appeal submitted',
        body: 'Your appeal was received and will be reviewed by staff.',
        appealId: appealRef.id,
      });
    } catch (e) {
      console.warn('[Appeals] notify submitter:', e?.message || e);
    }

    try {
      await notifyStaffNewAppeal(db, uid, appealRef.id, resolved.type);
    } catch (e) {
      console.warn('[Appeals] notify staff:', e?.message || e);
    }

    try {
      await writeModerationLog(uid, 'appeal_submitted', { appealId: appealRef.id, punishmentId }, uid);
    } catch (e) {
      console.warn('[Appeals] moderation log:', e?.message || e);
    }

    res.json({ ok: true, appealId: appealRef.id });
  } catch (err) {
    console.error('[Appeals] create:', err);
    const msg = err?.message || 'Failed to submit appeal';
    const code = err?.code;
    res.status(500).json({
      error: msg.length < 220 ? msg : 'Failed to submit appeal',
      code: code || undefined,
    });
  }
});

/**
 * Staff: list appeals (register before /:id).
 * GET /api/appeals?status=&punishmentType=&sort=&limit=
 */
router.get('/', requirePermission('access_moderator_panel'), async (req, res) => {
  if (!dbReady(res)) return;
  const status = (req.query.status || '').toString();
  const ptype = (req.query.punishmentType || '').toString();
  const sort = (req.query.sort || 'newest').toString();
  const limit = Math.min(Number(req.query.limit) || 60, 120);

  try {
    const db = getAdminFirestore();
    let q = db.collection('appeals').orderBy('createdAt', sort === 'oldest' ? 'asc' : 'desc').limit(limit);

    if (status && status !== 'all') {
      q = db
        .collection('appeals')
        .where('status', '==', status)
        .orderBy('createdAt', sort === 'oldest' ? 'asc' : 'desc')
        .limit(limit);
    }

    const snap = await q.get();
    let rows = snap.docs.map((d) => serializeAppeal(d.id, d.data()));
    if (ptype && ['ban', 'mute', 'warning'].includes(ptype)) {
      rows = rows.filter((r) => r.punishmentType === ptype);
    }
    res.json({ appeals: rows });
  } catch (err) {
    console.error('[Appeals] list:', err);
    res.status(500).json({ error: 'Failed to list appeals' });
  }
});

/** Staff + owning user */
router.get('/:id', async (req, res) => {
  if (!dbReady(res)) return;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('appeals').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const data = snap.data();
    const { permissions } = await getUserPermissions(req.uid);
    const isStaff = permissions.access_moderator_panel || permissions.access_admin_panel;
    if (!isStaff && data.userId !== req.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userSnap = await db.collection('users').doc(data.userId).get();
    const user = userSnap.exists ? { uid: userSnap.id, ...userSnap.data() } : null;

    const punishment = await resolvePunishment(db, data.userId, data.punishmentId);

    res.json({
      appeal: serializeAppeal(snap.id, data, { includeInternal: isStaff }),
      userSummary: user
        ? {
            uid: user.uid,
            username: user.username,
            email: user.email,
            role: user.role,
            banned: user.banned === true,
            warningsCount: Array.isArray(user.warnings) ? user.warnings.length : 0,
            mutedUntil: user.mutedUntil ? tsToIso(user.mutedUntil) : null,
          }
        : null,
      punishment,
      moderationHistory: user
        ? {
            warnings: Array.isArray(user.warnings) ? user.warnings : [],
            banned: user.banned === true,
            mutedUntil: user.mutedUntil ? tsToIso(user.mutedUntil) : null,
            chatRestricted: user.chatRestricted === true,
          }
        : null,
    });
  } catch (err) {
    console.error('[Appeals] get:', err);
    res.status(500).json({ error: 'Failed to load appeal' });
  }
});

/** Staff: review */
router.post('/:id/review', requirePermission('access_moderator_panel'), async (req, res) => {
  if (!dbReady(res)) return;
  const { id } = req.params;
  const action = (req.body?.action || '').toString(); // accept | deny | modify | mark_review
  const staffResponse = (req.body?.staffResponse || '').toString().slice(0, 2000);
  const internalNotes = (req.body?.internalNotes || '').toString().slice(0, 2000);
  const muteReduceMinutes = req.body?.muteReduceMinutes != null ? Number(req.body.muteReduceMinutes) : null;
  const unban = req.body?.unban === true;
  const removeWarning = req.body?.removeWarning === true;
  if (!['accept', 'deny', 'modify', 'mark_review'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection('appeals').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const a = snap.data();
    if (TERMINAL.includes(a.status)) {
      return res.status(400).json({ error: 'Appeal already resolved' });
    }

    const targetUid = a.userId;
    const punishmentId = a.punishmentId;

    await assertCanModifyTargetUser(db, req.uid, targetUid);

    const now = admin.firestore.FieldValue.serverTimestamp();

    if (action === 'mark_review') {
      await ref.update({
        status: 'under_review',
        internalNotes: internalNotes || a.internalNotes || null,
        updatedAt: now,
      });
      return res.json({ ok: true });
    }

    if (action === 'deny') {
      await ref.update({
        status: 'denied',
        staffResponse: staffResponse || 'Your appeal was denied.',
        internalNotes: internalNotes || null,
        reviewedBy: req.uid,
        reviewedAt: now,
        updatedAt: now,
      });
      await clearPunishmentAppealFlag(db, punishmentId);
      await notifyUser(targetUid, {
        type: 'appeal_denied',
        title: 'Appeal denied',
        body: staffResponse || 'Your appeal was denied.',
        appealId: id,
      });
      await writeModerationLog(req.uid, 'appeal_denied', { appealId: id, targetUid }, targetUid);
      return res.json({ ok: true });
    }

    if (action === 'accept') {
      const outcome = await applyAccept(db, targetUid, punishmentId, a);
      if (outcome.error) return res.status(400).json({ error: outcome.error });
      await ref.update({
        status: 'accepted',
        staffResponse: staffResponse || 'Your appeal was accepted; the punishment has been removed or reduced.',
        internalNotes: internalNotes || null,
        reviewedBy: req.uid,
        reviewedAt: now,
        modificationSummary: outcome.summary || null,
        updatedAt: now,
      });
      await clearPunishmentAppealFlag(db, punishmentId);
      await notifyUser(targetUid, {
        type: 'appeal_accepted',
        title: 'Appeal accepted',
        body: staffResponse || 'Your appeal was accepted.',
        appealId: id,
      });
      await writeModerationLog(req.uid, 'appeal_accepted', { appealId: id, targetUid }, targetUid);
      return res.json({ ok: true });
    }

    if (action === 'modify') {
      const outcome = await applyModify(db, targetUid, punishmentId, a, {
        muteReduceMinutes,
        unban,
        removeWarning,
      });
      if (outcome.error) return res.status(400).json({ error: outcome.error });
      await ref.update({
        status: 'modified',
        staffResponse: staffResponse || 'Your punishment was updated.',
        internalNotes: internalNotes || null,
        reviewedBy: req.uid,
        reviewedAt: now,
        modificationSummary: outcome.summary || null,
        updatedAt: now,
      });
      await clearPunishmentAppealFlag(db, punishmentId);
      await notifyUser(targetUid, {
        type: 'appeal_modified',
        title: 'Punishment updated',
        body: staffResponse || 'Staff modified your punishment.',
        appealId: id,
      });
      await writeModerationLog(req.uid, 'appeal_modified', { appealId: id, targetUid, summary: outcome.summary }, targetUid);
      return res.json({ ok: true });
    }
  } catch (err) {
    if (err.code === 'TARGET_OWNER_PROTECTED') {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error('[Appeals] review:', err);
    res.status(500).json({ error: 'Review failed' });
  }
});

async function clearPunishmentAppealFlag(db, punishmentId) {
  if (
    punishmentId.startsWith('legacy-w-') ||
    punishmentId.startsWith('synthetic-')
  ) {
    return;
  }
  const pref = db.collection('punishments').doc(punishmentId);
  const p = await pref.get();
  if (p.exists) {
    await pref.update({
      appealOpen: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function applyAccept(db, targetUid, punishmentId, appeal) {
  const summary = [];
  const p = await resolvePunishment(db, targetUid, punishmentId);
  if (p.error) return { error: p.error };

  if (p.type === 'ban') {
    await clearBanPunishment(db, targetUid);
    summary.push('Ban removed');
  } else if (p.type === 'mute') {
    await clearMutePunishment(db, targetUid);
    summary.push('Mute cleared');
  } else if (p.type === 'warning') {
    const uref = db.collection('users').doc(targetUid);
    const us = await uref.get();
    const u = us.data() || {};
    const warnings = Array.isArray(u.warnings) ? [...u.warnings] : [];
    let toRemove = null;
    if (p.legacyWarning) {
      toRemove = warnings.find(
        (w) =>
          !w.id &&
          fingerprintLegacyWarning(w) === fingerprintLegacyWarning(p.legacyWarning),
      );
    } else if (appeal.punishmentId.startsWith('legacy-w-')) {
      const fp = appeal.punishmentId.slice('legacy-w-'.length);
      toRemove = warnings.find((w) => !w.id && fingerprintLegacyWarning(w) === fp);
    } else {
      toRemove = warnings.find((w) => w.id === punishmentId || w.id === p.warningEntry?.id);
    }
    if (!toRemove) return { error: 'Could not find warning to remove' };
    await uref.update({
      warnings: admin.firestore.FieldValue.arrayRemove(toRemove),
    });
    if (!p.synthetic && punishmentId && !punishmentId.startsWith('legacy-w')) {
      const pr = db.collection('punishments').doc(punishmentId);
      if ((await pr.get()).exists) {
        await pr.update({
          active: false,
          liftedAt: admin.firestore.FieldValue.serverTimestamp(),
          liftedBy: 'appeal',
        });
      }
    }
    summary.push('Warning removed');
  }

  return { summary: summary.join('. ') };
}

async function applyModify(db, targetUid, punishmentId, appeal, opts) {
  const summary = [];
  const p = await resolvePunishment(db, targetUid, punishmentId);
  if (p.error) return { error: p.error };

  if (opts.unban && p.type === 'ban') {
    await clearBanPunishment(db, targetUid);
    summary.push('Ban removed');
  }

  if (opts.muteReduceMinutes != null && p.type === 'mute') {
    const mins = Math.min(Math.max(Number(opts.muteReduceMinutes) || 0, 5), 10080);
    const until = new Date(Date.now() + mins * 60 * 1000);
    await db.collection('users').doc(targetUid).update({
      mutedUntil: admin.firestore.Timestamp.fromDate(until),
    });
    if (!p.synthetic) {
      await db.collection('punishments').doc(punishmentId).update({
        expiresAt: admin.firestore.Timestamp.fromDate(until),
      });
    }
    summary.push(`Mute shortened (${mins} min from now)`);
  }

  if (opts.removeWarning && p.type === 'warning') {
    const r = await applyAccept(db, targetUid, punishmentId, appeal);
    if (r.error) return r;
    summary.push('Warning removed');
  }

  if (!summary.length) return { error: 'No modification options applied' };
  return { summary: summary.join('. ') };
}

function serializeAppeal(id, data, { includeInternal = false } = {}) {
  const row = {
    id,
    userId: data.userId,
    punishmentId: data.punishmentId,
    punishmentType: data.punishmentType,
    punishmentReason: data.punishmentReason,
    appealMessage: data.appealMessage,
    perspectiveMessage: data.perspectiveMessage,
    whyRemoveMessage: data.whyRemoveMessage,
    evidenceLinks: data.evidenceLinks,
    status: data.status,
    staffResponse: data.staffResponse,
    reviewedBy: data.reviewedBy,
    reviewedAt: tsToIso(data.reviewedAt),
    modificationSummary: data.modificationSummary,
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
  if (includeInternal) row.internalNotes = data.internalNotes;
  return row;
}

export default router;
