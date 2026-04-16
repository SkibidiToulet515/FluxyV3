/**
 * Referral code + stats for the signed-in user (Admin SDK).
 */
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';

const router = express.Router();

function makeCodeFromUid(uid) {
  const slice = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  const prefix = 'FX';
  return `${prefix}-${slice || 'USER'}`;
}

router.get('/referral/me', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const ref = db.collection('users').doc(req.uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Profile not found' });
    let code = snap.data()?.referralCode;
    if (!code) {
      code = makeCodeFromUid(req.uid);
      await ref.update({ referralCode: code });
    }
    let referralSignups = snap.data()?.referralSignups ?? 0;
    const counted = await db
      .collection('users')
      .where('referrals', 'array-contains', req.uid)
      .count()
      .get()
      .then((c) => c.data().count)
      .catch(() => referralSignups);
    referralSignups = typeof counted === 'number' ? counted : referralSignups;
    const base = (req.headers.origin || process.env.CLIENT_ORIGIN?.split(',')?.[0] || '').replace(/\/$/, '');
    const inviteUrl = base ? `${base}/login?ref=${encodeURIComponent(code)}` : null;
    res.json({
      code,
      inviteUrl,
      referralSignups,
      referralsYouSelected: Array.isArray(snap.data()?.referrals) ? snap.data().referrals : [],
    });
  } catch (err) {
    console.error('[Referral] me:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
