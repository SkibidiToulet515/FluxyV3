/**
 * Game/app reviews — writes use Admin SDK; Firestore rules deny client writes to reviews/*.
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAuth } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';

const router = express.Router();

const ALLOWED_TAGS = new Set([
  'fun', 'laggy', 'hard', 'good_with_friends', 'underrated',
]);

function clampTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => String(t).toLowerCase().replace(/\s+/g, '_')).filter((t) => ALLOWED_TAGS.has(t)))].slice(0, 5);
}

router.get('/reviews/:gameId', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { gameId } = req.params;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));
  const sort = (req.query.sort || 'recent').toString();
  try {
    const db = getAdminFirestore();
    let q = db.collection('games').doc(gameId).collection('reviews');
    if (sort === 'rating_high') {
      q = q.orderBy('rating', 'desc').orderBy('createdAt', 'desc');
    } else if (sort === 'rating_low') {
      q = q.orderBy('rating', 'asc').orderBy('createdAt', 'desc');
    } else {
      q = q.orderBy('createdAt', 'desc');
    }
    const snap = await q.limit(limit).get();
    const raw = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        authorUid: x.authorUid,
        rating: x.rating,
        text: x.text || '',
        tags: x.tags || [],
        createdAt: x.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: x.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });
    const authorUids = [...new Set(raw.map((r) => r.authorUid).filter(Boolean))];
    const userRefs = authorUids.map((uid) => db.collection('users').doc(uid));
    const userSnaps = userRefs.length ? await db.getAll(...userRefs) : [];
    const authorUsername = {};
    userSnaps.forEach((s, i) => {
      if (s.exists) {
        const u = s.data() || {};
        authorUsername[authorUids[i]] = u.username || u.displayName || 'Member';
      }
    });
    const reviews = raw.map((r) => ({
      ...r,
      authorUsername: authorUsername[r.authorUid] || 'Member',
    }));
    const gameSnap = await db.collection('games').doc(gameId).get();
    const g = gameSnap.exists ? gameSnap.data() : {};
    const ratingSum = g.ratingSum ?? 0;
    const ratingCount = g.ratingCount ?? 0;
    const avg = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null;
    res.json({ reviews, summary: { avg, count: ratingCount, sum: ratingSum } });
  } catch (err) {
    console.error('[Reviews] list:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.post('/reviews', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const gameId = (req.body?.gameId || '').toString().trim();
  const rating = Math.min(5, Math.max(1, parseInt(String(req.body?.rating || '0'), 10) || 0));
  const text = (req.body?.text || '').toString().slice(0, 2000);
  const tags = clampTags(req.body?.tags);
  if (!gameId) return res.status(400).json({ error: 'gameId required' });
  if (!rating) return res.status(400).json({ error: 'rating 1–5 required' });

  const db = getAdminFirestore();
  const gameRef = db.collection('games').doc(gameId);
  const reviewRef = gameRef.collection('reviews').doc(req.uid);
  const ts = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (t) => {
      const [gameSnap, revSnap] = await t.getAll(gameRef, reviewRef);
      if (!gameSnap.exists) {
        throw Object.assign(new Error('Game not found'), { code: 'NOT_FOUND' });
      }
      const prev = revSnap.exists ? revSnap.data() : null;
      const oldRating = prev?.rating || 0;
      const g = gameSnap.data() || {};
      let ratingSum = g.ratingSum ?? 0;
      let ratingCount = g.ratingCount ?? 0;
      if (prev) {
        ratingSum = ratingSum - oldRating + rating;
      } else {
        ratingSum += rating;
        ratingCount += 1;
      }
      t.set(reviewRef, {
        authorUid: req.uid,
        gameId,
        rating,
        text,
        tags,
        createdAt: prev?.createdAt || ts,
        updatedAt: ts,
      });
      t.update(gameRef, { ratingSum, ratingCount, updatedAt: ts });
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Game not found' });
    console.error('[Reviews] create:', err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

router.delete('/reviews/:gameId', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const { gameId } = req.params;
  const db = getAdminFirestore();
  const gameRef = db.collection('games').doc(gameId);
  const reviewRef = gameRef.collection('reviews').doc(req.uid);
  const ts = admin.firestore.FieldValue.serverTimestamp();
  try {
    await db.runTransaction(async (t) => {
      const [gameSnap, revSnap] = await t.getAll(gameRef, reviewRef);
      if (!revSnap.exists) throw Object.assign(new Error('none'), { code: 'NONE' });
      const prev = revSnap.data();
      const g = gameSnap.exists ? gameSnap.data() || {} : {};
      let ratingSum = (g.ratingSum ?? 0) - (prev.rating || 0);
      let ratingCount = (g.ratingCount ?? 1) - 1;
      if (ratingCount < 0) ratingCount = 0;
      if (ratingSum < 0) ratingSum = 0;
      t.delete(reviewRef);
      t.update(gameRef, {
        ratingSum,
        ratingCount,
        updatedAt: ts,
      });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'NONE') return res.status(404).json({ error: 'No review' });
    console.error('[Reviews] delete:', err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
