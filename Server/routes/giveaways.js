/**
 * Giveaways: CRUD (admin), active giveaway (auth), enter, winners, eligibility preview.
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';
import {
  defaultEligibility,
  defaultRequirementRules,
  normalizeEligibility,
  normalizeRequirementRules,
} from '../lib/giveawaySchema.js';
import { userMatchesEligibility, userMeetsEntryRequirements } from '../lib/giveawayEligibility.js';

const router = express.Router();

function gwCol(db) {
  return db.collection('giveaways');
}

function entryId(giveawayId, userId) {
  return `${giveawayId}_${userId}`;
}

function publicGiveawayFields(d, id, extras = {}) {
  return {
    id,
    title: d.title || '',
    description: d.description || '',
    longMessage: d.longMessage || '',
    prize: d.prize || '',
    prizeImageUrl: d.prizeImageUrl || null,
    buttonText: d.buttonText || 'Enter giveaway',
    successText: d.successText || "You're in! Good luck.",
    closedText: d.closedText || 'This giveaway has ended.',
    winnerAnnouncementText: d.winnerAnnouncementText || '',
    requirementRules: d.requirementRules || defaultRequirementRules(),
    endAt: d.endAt || null,
    startAt: d.startAt || null,
    winnerCount: d.winnerCount ?? 1,
    winnerMode: d.winnerMode || 'random',
    status: d.status || 'draft',
    winners: Array.isArray(d.winners) ? d.winners : [],
    ...extras,
  };
}

/** GET /api/giveaways/active — current user: one active published giveaway (not dismissed). */
router.get('/giveaways/active', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ giveaway: null });
  try {
    const db = getAdminFirestore();
    const nowMs = Date.now();
    const snap = await gwCol(db).where('status', '==', 'published').limit(25).get();

    const userSnap = await db.collection('users').doc(req.uid).get();
    const dismissed = userSnap.exists ? userSnap.data().dismissedGiveawayIds || [] : [];

    const candidates = snap.docs
      .map((doc) => ({ id: doc.id, d: doc.data() }))
      .filter(({ d }) => d.endAt && d.endAt.toMillis() > nowMs)
      .filter(({ d }) => !d.startAt || d.startAt.toMillis() <= nowMs)
      .sort((a, b) => a.d.endAt.toMillis() - b.d.endAt.toMillis());

    for (const { id, d } of candidates) {
      if (dismissed.includes(id)) continue;

      const entRef = db.collection('giveawayEntries').doc(entryId(id, req.uid));
      const ent = await entRef.get();

      return res.json({
        giveaway: publicGiveawayFields(d, id, {
          hasEntered: ent.exists(),
          entryDisqualified: ent.exists() ? ent.data().disqualified === true : false,
        }),
      });
    }
    res.json({ giveaway: null });
  } catch (err) {
    console.error('[Giveaways] active:', err);
    res.status(500).json({ error: 'Failed to load giveaway' });
  }
});

router.use(requireAuth);

/** Admin: list giveaways */
router.get('/giveaways', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const snap = await gwCol(db).orderBy('createdAt', 'desc').limit(100).get();
    const giveaways = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ giveaways });
  } catch (err) {
    console.error('[Giveaways] list:', err);
    res.status(500).json({ error: 'Failed to list' });
  }
});

/** Admin: create */
router.post('/giveaways', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const body = req.body || {};
  try {
    const db = getAdminFirestore();
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const eligibility = normalizeEligibility(body.eligibility);
    const requirementRules = normalizeRequirementRules(body.requirementRules);
    const ref = gwCol(db).doc();
    await ref.set({
      title: String(body.title || '').slice(0, 120),
      description: String(body.description || '').slice(0, 400),
      longMessage: String(body.longMessage || '').slice(0, 8000),
      prize: String(body.prize || '').slice(0, 200),
      prizeImageUrl: body.prizeImageUrl ? String(body.prizeImageUrl).slice(0, 2000) : null,
      buttonText: String(body.buttonText || 'Enter giveaway').slice(0, 80),
      successText: String(body.successText || '').slice(0, 400),
      closedText: String(body.closedText || '').slice(0, 400),
      winnerAnnouncementText: String(body.winnerAnnouncementText || '').slice(0, 800),
      eligibility,
      requirementRules,
      winnerMode: body.winnerMode === 'manual' ? 'manual' : 'random',
      winnerCount: Math.min(50, Math.max(1, parseInt(String(body.winnerCount || '1'), 10) || 1)),
      status: 'draft',
      winners: [],
      startAt: body.startAt ? admin.firestore.Timestamp.fromDate(new Date(body.startAt)) : null,
      endAt: body.endAt ? admin.firestore.Timestamp.fromDate(new Date(body.endAt)) : null,
      createdBy: req.uid,
      createdAt: ts,
      updatedAt: ts,
    });
    res.status(201).json({ ok: true, id: ref.id });
  } catch (err) {
    console.error('[Giveaways] create:', err);
    res.status(500).json({ error: 'Failed to create' });
  }
});

/** Admin: update draft */
router.patch('/giveaways/:id', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  const body = req.body || {};
  try {
    const db = getAdminFirestore();
    const ref = gwCol(db).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    if (snap.data().status === 'ended') return res.status(400).json({ error: 'Giveaway ended' });

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (body.title != null) updates.title = String(body.title).slice(0, 120);
    if (body.description != null) updates.description = String(body.description).slice(0, 400);
    if (body.longMessage != null) updates.longMessage = String(body.longMessage).slice(0, 8000);
    if (body.prize != null) updates.prize = String(body.prize).slice(0, 200);
    if (body.prizeImageUrl !== undefined) updates.prizeImageUrl = body.prizeImageUrl ? String(body.prizeImageUrl).slice(0, 2000) : null;
    if (body.buttonText != null) updates.buttonText = String(body.buttonText).slice(0, 80);
    if (body.successText != null) updates.successText = String(body.successText).slice(0, 400);
    if (body.closedText != null) updates.closedText = String(body.closedText).slice(0, 400);
    if (body.winnerAnnouncementText != null) updates.winnerAnnouncementText = String(body.winnerAnnouncementText).slice(0, 800);
    if (body.eligibility != null) updates.eligibility = normalizeEligibility(body.eligibility);
    if (body.requirementRules != null) updates.requirementRules = normalizeRequirementRules(body.requirementRules);
    if (body.winnerMode != null) updates.winnerMode = body.winnerMode === 'manual' ? 'manual' : 'random';
    if (body.winnerCount != null) updates.winnerCount = Math.min(50, Math.max(1, parseInt(String(body.winnerCount), 10) || 1));
    if (body.startAt !== undefined) {
      updates.startAt = body.startAt ? admin.firestore.Timestamp.fromDate(new Date(body.startAt)) : null;
    }
    if (body.endAt !== undefined) {
      updates.endAt = body.endAt ? admin.firestore.Timestamp.fromDate(new Date(body.endAt)) : null;
    }

    await ref.update(updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Giveaways] patch:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/** Admin: publish (ends other published giveaways that overlap) */
router.post('/giveaways/:id/publish', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  try {
    const db = getAdminFirestore();
    const ref = gwCol(db).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Not found' });
    const d = snap.data();
    if (!d.endAt) return res.status(400).json({ error: 'Set end date before publishing' });

    const batch = db.batch();
    const others = await gwCol(db).where('status', '==', 'published').get();
    others.docs.forEach((doc) => {
      if (doc.id !== id) {
        batch.update(doc.ref, { status: 'ended', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });
    batch.update(ref, {
      status: 'published',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    console.error('[Giveaways] publish:', err);
    res.status(500).json({ error: 'Failed to publish' });
  }
});

router.post('/giveaways/:id/end', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  try {
    const db = getAdminFirestore();
    await gwCol(db).doc(id).update({
      status: 'ended',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Giveaways] end:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

/** Admin: preview eligible user count (samples up to maxScan users) */
router.post('/giveaways/preview-eligibility', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const eligibility = normalizeEligibility(req.body?.eligibility);
  const maxScan = Math.min(15000, Math.max(100, parseInt(String(req.body?.maxScan || '5000'), 10) || 5000));
  try {
    const db = getAdminFirestore();
    let matched = 0;
    let scanned = 0;
    const qs = await db.collection('users').orderBy('usernameLower').limit(maxScan).get();
    for (const doc of qs.docs) {
      scanned += 1;
      const r = await userMatchesEligibility(db, doc.id, doc.data(), eligibility);
      if (r.ok) matched += 1;
    }
    res.json({ matched, scanned, capped: qs.size >= maxScan });
  } catch (err) {
    console.error('[Giveaways] preview:', err);
    res.status(500).json({ error: 'Preview failed' });
  }
});

/** Enter giveaway */
router.post('/giveaways/:id/enter', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  const { acceptedTerms } = req.body || {};
  try {
    const db = getAdminFirestore();
    const auth = admin.auth();
    const gref = gwCol(db).doc(id);
    const gsnap = await gref.get();
    if (!gsnap.exists) return res.status(404).json({ error: 'Giveaway not found' });
    const g = gsnap.data();
    if (g.status !== 'published') return res.status(400).json({ error: 'Giveaway is not active' });
    const now = Date.now();
    if (g.endAt && g.endAt.toMillis() < now) return res.status(400).json({ error: 'Giveaway ended' });
    if (g.startAt && g.startAt.toMillis() > now) return res.status(400).json({ error: 'Giveaway not started' });

    const reqRules = normalizeRequirementRules(g.requirementRules);
    if (reqRules.mustAcceptTerms && !acceptedTerms) {
      return res.status(400).json({ error: 'You must accept the terms', code: 'TERMS' });
    }

    const userRef = db.collection('users').doc(req.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(400).json({ error: 'Profile missing' });
    const userData = userSnap.data();

    const elig = normalizeEligibility(g.eligibility);
    const eligRes = await userMatchesEligibility(db, req.uid, userData, elig);
    if (!eligRes.ok) {
      return res.status(403).json({ error: 'You are not eligible for this giveaway', code: eligRes.code });
    }

    const reqRes = await userMeetsEntryRequirements(auth, db, req.uid, userData, reqRules);
    if (!reqRes.ok) {
      return res.status(403).json({ error: 'Requirements not met', code: reqRes.code });
    }

    const eid = entryId(id, req.uid);
    const eref = db.collection('giveawayEntries').doc(eid);
    const existing = await eref.get();
    if (existing.exists && !existing.data().disqualified) {
      return res.status(400).json({ error: 'Already entered', code: 'DUPLICATE' });
    }

    const ts = admin.firestore.FieldValue.serverTimestamp();
    await eref.set({
      giveawayId: id,
      userId: req.uid,
      username: userData.username || '',
      enteredAt: ts,
      isEligibleSnapshot: true,
      disqualified: false,
      metadata: { eligCode: eligRes.ok ? 'ok' : eligRes.code },
    });

    res.json({ ok: true, message: g.successText || "You're in!" });
  } catch (err) {
    console.error('[Giveaways] enter:', err);
    res.status(500).json({ error: 'Failed to enter' });
  }
});

/** Dismiss modal (don't show again) */
router.post('/giveaways/:id/dismiss', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  try {
    const db = getAdminFirestore();
    await db
      .collection('users')
      .doc(req.uid)
      .update({ dismissedGiveawayIds: admin.firestore.FieldValue.arrayUnion(id) });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Giveaways] dismiss:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

/** Admin: list entries */
router.get('/giveaways/:id/entries', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('giveawayEntries').where('giveawayId', '==', id).get();
    const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ entries });
  } catch (err) {
    console.error('[Giveaways] entries:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

/** Random winner pick */
router.post('/giveaways/:id/pick-winners', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  const allowRepeat = Boolean(req.body?.allowRepeat);
  try {
    const db = getAdminFirestore();
    const gref = gwCol(db).doc(id);
    const gsnap = await gref.get();
    if (!gsnap.exists) return res.status(404).json({ error: 'Not found' });
    const g = gsnap.data();
    if (g.winnerMode === 'manual') {
      return res.status(400).json({ error: 'This giveaway uses manual winners' });
    }
    const want = Math.min(50, Math.max(1, g.winnerCount || 1));

    const snap = await db.collection('giveawayEntries').where('giveawayId', '==', id).get();
    let pool = snap.docs
      .map((d) => d.data())
      .filter((e) => e.disqualified !== true && e.isEligibleSnapshot !== false)
      .map((e) => e.userId);

    const prev = new Set(Array.isArray(g.winners) ? g.winners : []);
    if (!allowRepeat) pool = pool.filter((uid) => !prev.has(uid));
    if (pool.length === 0) return res.status(400).json({ error: 'No eligible entrants' });

    const picked = [];
    while (picked.length < want && pool.length > 0) {
      const i = Math.floor(Math.random() * pool.length);
      picked.push(pool[i]);
      pool.splice(i, 1);
    }

    const replace = req.body?.replace !== false;
    const nextWinners = replace ? picked : [...new Set([...(g.winners || []), ...picked])];

    await gref.update({
      winners: nextWinners,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true, winners: picked });
  } catch (err) {
    console.error('[Giveaways] pick:', err);
    res.status(500).json({ error: 'Failed to pick' });
  }
});

/** Admin: set winners manually */
router.post('/giveaways/:id/winners', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { id } = req.params;
  const uids = Array.isArray(req.body?.userIds) ? req.body.userIds.map(String) : [];
  try {
    const db = getAdminFirestore();
    await gwCol(db)
      .doc(id)
      .update({ winners: uids, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Giveaways] set winners:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/giveaway-entries/:entryId/disqualify', requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { entryId } = req.params;
  try {
    const db = getAdminFirestore();
    await db.collection('giveawayEntries').doc(entryId).update({
      disqualified: true,
      disqualifyReason: String(req.body?.reason || 'admin').slice(0, 200),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[Giveaways] disqualify:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
