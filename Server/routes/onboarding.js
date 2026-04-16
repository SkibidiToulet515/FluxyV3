/**
 * Referral onboarding: searchable user directory + save referral choices (Admin SDK).
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAuth } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/users?q=&limit=
 * Searchable list of users (for "who referred you"). Excludes the current user.
 * When q is empty, returns the first `limit` users alphabetically by usernameLower.
 */
router.get('/users', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Service unavailable' });
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const limit = Math.min(80, Math.max(1, parseInt(String(req.query.limit || '40'), 10) || 40));
  try {
    const db = getAdminFirestore();
    let snap;
    if (q.length === 0) {
      snap = await db.collection('users').orderBy('usernameLower').limit(limit + 5).get();
    } else {
      snap = await db
        .collection('users')
        .where('usernameLower', '>=', q)
        .where('usernameLower', '<=', `${q}\uf8ff`)
        .limit(limit + 5)
        .get();
    }
    const users = snap.docs
      .map((d) => ({
        uid: d.id,
        username: (d.data().username || '').trim() || d.id.slice(0, 8),
      }))
      .filter((u) => u.uid !== req.uid && u.username)
      .slice(0, limit);
    res.json({ users });
  } catch (err) {
    console.error('[Onboarding] list users:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * POST /api/referral
 * Body: { referrals: string[] (uids), foundMyself?: boolean }
 */
router.post('/referral', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Service unavailable' });
  const foundMyself = Boolean(req.body?.foundMyself);
  let referrals = Array.isArray(req.body?.referrals) ? req.body.referrals : [];
  referrals = [...new Set(referrals.map((x) => String(x).trim()).filter(Boolean))];

  if (referrals.length > 2) {
    return res.status(400).json({ error: 'You can choose at most 2 people', code: 'LIMIT' });
  }
  if (foundMyself && referrals.length > 0) {
    return res.status(400).json({ error: 'Remove selected users or uncheck "I found this site myself"', code: 'CONFLICT' });
  }
  if (!foundMyself && referrals.length < 1) {
    return res.status(400).json({
      error: 'Select who told you about this site, or check "I found this site myself"',
      code: 'REQUIRED',
    });
  }
  if (referrals.includes(req.uid)) {
    return res.status(400).json({ error: 'You cannot refer yourself', code: 'SELF' });
  }

  try {
    const db = getAdminFirestore();
    const userRef = db.collection('users').doc(req.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    if (userSnap.data()?.hasCompletedReferral === true) {
      return res.status(400).json({ error: 'Referral step already completed', code: 'DONE' });
    }

    for (const uid of referrals) {
      const other = await db.collection('users').doc(uid).get();
      if (!other.exists) {
        return res.status(400).json({ error: 'One or more selected users no longer exist', code: 'UNKNOWN_USER' });
      }
    }

    const ts = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update({
      referrals: foundMyself ? [] : referrals,
      referralFoundMyself: foundMyself,
      hasCompletedReferral: true,
      referralCompletedAt: ts,
    });
    if (!foundMyself && referrals.length) {
      const inc = admin.firestore.FieldValue.increment(1);
      for (const refUid of referrals) {
        try {
          await db.collection('users').doc(refUid).update({ referralSignups: inc });
        } catch (e) {
          console.warn('[Onboarding] referral increment', refUid, e?.message);
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Onboarding] save referral:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

export default router;
