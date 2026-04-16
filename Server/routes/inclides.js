/**
 * Inclides — virtual currency (server-authoritative balance, transactions, shop, daily rewards).
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';
import { notifyUser } from '../lib/userNotifications.js';

const router = express.Router();

const DEFAULT_CONFIG = {
  baseReward: 50,
  midTierStreakMin: 4,
  midTierStreakMax: 7,
  midTierMult: 1.2,
  highTierStreakMin: 8,
  highTierMult: 1.5,
  highTierBonus: 25,
  shopItems: [
    {
      id: 'aurora-ring',
      name: 'Aurora ring',
      description: 'A soft gradient ring around your avatar.',
      price: 280,
      kind: 'profile_flair',
    },
    {
      id: 'nebula-badge',
      name: 'Nebula badge',
      description: 'A compact badge beside your name.',
      price: 150,
      kind: 'badge',
    },
    {
      id: 'pulse-trail',
      name: 'Pulse trail',
      description: 'Subtle motion accent on your profile hero.',
      price: 420,
      kind: 'profile_flair',
    },
    {
      id: 'orbit-dots',
      name: 'Orbit dots',
      description: 'Minimal floating dots for your card.',
      price: 200,
      kind: 'profile_flair',
    },
  ],
};

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function yesterdayUtcDayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function getConfig(db) {
  const snap = await db.collection('appConfig').doc('inclides').get();
  const raw = snap.exists ? snap.data() : {};
  const shopItems = Array.isArray(raw.shopItems) && raw.shopItems.length ? raw.shopItems : DEFAULT_CONFIG.shopItems;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    shopItems,
  };
}

function rewardAmountForStreak(streak, cfg) {
  const base = Number(cfg.baseReward) || DEFAULT_CONFIG.baseReward;
  const midMin = Number(cfg.midTierStreakMin) || 4;
  const midMax = Number(cfg.midTierStreakMax) || 7;
  const highMin = Number(cfg.highTierStreakMin) || 8;
  const midMult = Number(cfg.midTierMult) || 1.2;
  const highMult = Number(cfg.highTierMult) || 1.5;
  const highBonus = Number(cfg.highTierBonus) || 25;
  if (streak >= highMin) return Math.round(base * highMult + highBonus);
  if (streak >= midMin && streak <= midMax) return Math.round(base * midMult);
  return Math.round(base);
}

function userInclidesDefaults() {
  return {
    inclidesBalance: 0,
    inclidesStreak: 0,
    inclidesLastClaimDayKey: null,
    inclidesOwnedItemIds: [],
    inclidesEquippedItemId: null,
  };
}

// ─── Public (auth) ───────────────────────────────────────────────────────────

router.get('/inclides/me', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const cfg = await getConfig(db);
    const ref = db.collection('users').doc(req.uid);
    const snap = await ref.get();
    const u = snap.exists ? snap.data() : {};
    const today = utcDayKey();
    const last = u.inclidesLastClaimDayKey || null;
    const streak = Number(u.inclidesStreak) || 0;
    const balance = Number(u.inclidesBalance) || 0;
    const claimedToday = last === today;
    const y = yesterdayUtcDayKey();
    let streakAfterNextClaim = streak;
    if (!claimedToday) {
      streakAfterNextClaim = last === y ? streak + 1 : 1;
    }
    const previewAmount = claimedToday ? 0 : rewardAmountForStreak(streakAfterNextClaim, cfg);
    res.json({
      balance,
      streak,
      lastClaimDayKey: last,
      canClaimToday: !claimedToday,
      nextStreakIfClaim: streakAfterNextClaim,
      previewNextReward: previewAmount,
      ownedItemIds: Array.isArray(u.inclidesOwnedItemIds) ? u.inclidesOwnedItemIds : [],
      equippedItemId: u.inclidesEquippedItemId || null,
    });
  } catch (err) {
    console.error('[Inclides] me:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/inclides/daily-claim', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const db = getAdminFirestore();
  const cfg = await getConfig(db);
  const today = utcDayKey();
  const userRef = db.collection('users').doc(req.uid);

  try {
    const out = await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const u = snap.exists ? snap.data() : {};
      const balance = Number(u.inclidesBalance) || 0;
      const streakWas = Number(u.inclidesStreak) || 0;
      const last = u.inclidesLastClaimDayKey || null;
      if (last === today) {
        const err = new Error('Already claimed today');
        err.code = 'ALREADY_CLAIMED';
        throw err;
      }
      let newStreak = 1;
      if (last === yesterdayUtcDayKey()) newStreak = streakWas + 1;
      else newStreak = 1;
      const amount = rewardAmountForStreak(newStreak, cfg);
      const newBal = balance + amount;
      t.set(
        userRef,
        {
          inclidesBalance: newBal,
          inclidesStreak: newStreak,
          inclidesLastClaimDayKey: today,
        },
        { merge: true },
      );
      const txRef = userRef.collection('inclidesTransactions').doc();
      t.set(txRef, {
        type: 'earn',
        amountSigned: amount,
        source: 'daily_reward',
        balanceAfter: newBal,
        meta: { streak: newStreak, dayKey: today },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { amount, newStreak, newBal };
    });
    await notifyUser(req.uid, {
      type: 'inclides_daily',
      title: 'Daily Inclides',
      body: `+${out.amount} Inclides · ${out.newStreak}-day streak`,
      meta: { link: '/wallet' },
    });
    res.json({
      ok: true,
      earned: out.amount,
      streak: out.newStreak,
      balance: out.newBal,
    });
  } catch (err) {
    if (err.code === 'ALREADY_CLAIMED') {
      return res.status(409).json({ error: 'Already claimed today' });
    }
    console.error('[Inclides] daily-claim:', err);
    res.status(500).json({ error: 'Failed to claim' });
  }
});

router.get('/inclides/transactions', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const lim = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '40'), 10) || 40));
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('users')
      .doc(req.uid)
      .collection('inclidesTransactions')
      .orderBy('createdAt', 'desc')
      .limit(lim)
      .get();
    const transactions = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        type: x.type,
        amountSigned: x.amountSigned,
        source: x.source,
        balanceAfter: x.balanceAfter,
        meta: x.meta || {},
        createdAt: x.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    res.json({ transactions });
  } catch (err) {
    console.error('[Inclides] transactions:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/inclides/shop', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const cfg = await getConfig(db);
    res.json({ items: cfg.shopItems || [] });
  } catch (err) {
    console.error('[Inclides] shop:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/inclides/purchase', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const itemId = (req.body?.itemId || '').toString().trim();
  if (!itemId) return res.status(400).json({ error: 'itemId required' });
  const db = getAdminFirestore();
  const cfg = await getConfig(db);
  const item = (cfg.shopItems || []).find((x) => x.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  const price = Number(item.price);
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'Invalid price' });

  const userRef = db.collection('users').doc(req.uid);
  try {
    const out = await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      if (!snap.exists) throw new Error('NO_USER');
      const u = snap.data();
      const balance = Number(u.inclidesBalance) || 0;
      const owned = Array.isArray(u.inclidesOwnedItemIds) ? u.inclidesOwnedItemIds : [];
      if (owned.includes(itemId)) {
        const err = new Error('Owned');
        err.code = 'OWNED';
        throw err;
      }
      if (balance < price) {
        const err = new Error('Insufficient');
        err.code = 'INSUFFICIENT';
        throw err;
      }
      const newBal = balance - price;
      const newOwned = [...owned, itemId];
      t.update(userRef, {
        inclidesBalance: newBal,
        inclidesOwnedItemIds: newOwned,
      });
      const txRef = userRef.collection('inclidesTransactions').doc();
      t.set(txRef, {
        type: 'spend',
        amountSigned: -price,
        source: 'shop_purchase',
        balanceAfter: newBal,
        meta: { itemId, itemName: item.name || itemId },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { newBal, price, itemName: item.name || itemId };
    });
    await notifyUser(req.uid, {
      type: 'inclides_purchase',
      title: 'Purchase complete',
      body: `-${out.price} Inclides · ${out.itemName}`,
      meta: { link: '/inventory' },
    });
    res.json({ ok: true, balance: out.newBal, itemId });
  } catch (err) {
    if (err.code === 'OWNED') return res.status(409).json({ error: 'Already owned' });
    if (err.code === 'INSUFFICIENT') {
      return res.status(402).json({ error: 'Not enough Inclides' });
    }
    console.error('[Inclides] purchase:', err);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

router.post('/inclides/equip', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const itemId = req.body?.itemId === null || req.body?.itemId === ''
    ? null
    : (req.body?.itemId || '').toString().trim();
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(req.uid);
  try {
    const snap = await userRef.get();
    if (!snap.exists) return res.status(404).json({ error: 'User not found' });
    const owned = Array.isArray(snap.data().inclidesOwnedItemIds)
      ? snap.data().inclidesOwnedItemIds
      : [];
    if (itemId && !owned.includes(itemId)) {
      return res.status(403).json({ error: 'You do not own this item' });
    }
    await userRef.update({ inclidesEquippedItemId: itemId || null });
    res.json({ ok: true, equippedItemId: itemId || null });
  } catch (err) {
    console.error('[Inclides] equip:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

router.post('/inclides/admin/grant', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const targetUid = (req.body?.targetUid || '').toString().trim();
  const rawAmt = req.body?.amount;
  const amount = typeof rawAmt === 'number' ? rawAmt : parseInt(String(rawAmt || '0'), 10);
  const note = (req.body?.note || '').toString().slice(0, 200);
  if (!targetUid || !Number.isFinite(amount) || amount === 0) {
    return res.status(400).json({ error: 'targetUid and non-zero amount required' });
  }
  const db = getAdminFirestore();
  const ref = db.collection('users').doc(targetUid);
  try {
    const newBal = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const u = snap.exists ? snap.data() : userInclidesDefaults();
      const balance = Number(u.inclidesBalance) || 0;
      const next = balance + amount;
      if (next < 0) {
        const err = new Error('NEG');
        err.code = 'NEGATIVE';
        throw err;
      }
      t.set(
        ref,
        { inclidesBalance: next },
        { merge: true },
      );
      const txRef = ref.collection('inclidesTransactions').doc();
      t.set(txRef, {
        type: amount > 0 ? 'earn' : 'spend',
        amountSigned: amount,
        source: 'admin_adjust',
        balanceAfter: next,
        meta: { note, byUid: req.uid },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return next;
    });
    await notifyUser(targetUid, {
      type: 'inclides_admin',
      title: amount > 0 ? 'Inclides received' : 'Inclides adjusted',
      body:
        amount > 0
          ? `+${amount} Inclides`
          : `${amount} Inclides`,
      meta: { link: '/wallet' },
    });
    res.json({ ok: true, balance: newBal });
  } catch (err) {
    if (err.code === 'NEGATIVE') return res.status(400).json({ error: 'Would result in negative balance' });
    console.error('[Inclides] admin grant:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/inclides/admin/leaderboard', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const lim = Math.min(100, Math.max(5, parseInt(String(req.query.limit || '30'), 10) || 30));
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection('users')
      .orderBy('inclidesBalance', 'desc')
      .limit(lim)
      .get();
    const rows = snap.docs.map((d) => ({
      uid: d.id,
      username: d.data().username || d.id.slice(0, 8),
      inclidesBalance: Number(d.data().inclidesBalance) || 0,
    }));
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('[Inclides] leaderboard:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/inclides/admin/transactions-recent', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const lim = Math.min(200, Math.max(10, parseInt(String(req.query.limit || '80'), 10) || 80));
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collectionGroup('inclidesTransactions')
      .orderBy('createdAt', 'desc')
      .limit(lim)
      .get();
    const transactions = await Promise.all(
      snap.docs.map(async (d) => {
        const uid = d.ref.parent.parent.id;
        let username = uid.slice(0, 8);
        try {
          const u = await db.collection('users').doc(uid).get();
          if (u.exists) username = u.data().username || username;
        } catch {
          /* ignore */
        }
        const x = d.data();
        return {
          id: d.id,
          uid,
          username,
          type: x.type,
          amountSigned: x.amountSigned,
          source: x.source,
          balanceAfter: x.balanceAfter,
          meta: x.meta || {},
          createdAt: x.createdAt?.toDate?.()?.toISOString() || null,
        };
      }),
    );
    res.json({ transactions });
  } catch (err) {
    console.error('[Inclides] admin tx:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/inclides/admin/config', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const body = req.body || {};
  try {
    const db = getAdminFirestore();
    const ref = db.collection('appConfig').doc('inclides');
    const patch = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.uid,
    };
    const numKeys = [
      'baseReward',
      'midTierStreakMin',
      'midTierStreakMax',
      'midTierMult',
      'highTierStreakMin',
      'highTierMult',
      'highTierBonus',
    ];
    numKeys.forEach((k) => {
      if (body[k] != null && body[k] !== '') {
        const n = Number(body[k]);
        if (Number.isFinite(n)) patch[k] = n;
      }
    });
    if (Array.isArray(body.shopItems)) {
      patch.shopItems = body.shopItems
        .filter((x) => x && x.id)
        .map((x) => ({
          id: String(x.id).slice(0, 64),
          name: String(x.name || x.id).slice(0, 80),
          description: String(x.description || '').slice(0, 300),
          price: Math.max(0, Math.round(Number(x.price) || 0)),
          kind: String(x.kind || 'profile_flair').slice(0, 40),
        }))
        .slice(0, 40);
    }
    await ref.set(patch, { merge: true });
    const snap = await ref.get();
    res.json({ ok: true, config: snap.data() });
  } catch (err) {
    console.error('[Inclides] admin config:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/inclides/admin/config', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const cfg = await getConfig(db);
    res.json({ config: cfg });
  } catch (err) {
    console.error('[Inclides] get config:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
