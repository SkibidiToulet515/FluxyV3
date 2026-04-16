/**
 * Session/play analytics and admin dashboard metrics (Admin SDK).
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady, verifyToken } from '../config/firebase.js';

const router = express.Router();

async function optionalUid(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const d = await verifyToken(h.slice(7));
  return d?.uid || null;
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** POST /api/analytics/play — record a game play (optional auth: attributes to user when signed in). */
router.post('/analytics/play', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ ok: false });
  const gameId = (req.body?.gameId || '').toString().trim();
  if (!gameId) return res.status(400).json({ error: 'gameId required' });
  const uid = await optionalUid(req);
  try {
    const db = getAdminFirestore();
    const dk = dayKey();
    const dailyRef = db.collection('platformAnalytics').doc('daily').collection('days').doc(dk);
    const gameRef = db.collection('games').doc(gameId);
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const inc1 = admin.firestore.FieldValue.increment(1);

    const batch = db.batch();
    batch.set(
      dailyRef,
      { date: dk, gamePlays: inc1, updatedAt: ts },
      { merge: true },
    );
    batch.set(gameRef, { plays: inc1, lastPlayed: ts, updatedAt: ts }, { merge: true });
    if (uid) {
      const userRef = db.collection('users').doc(uid);
      batch.set(
        userRef,
        {
          totalGamePlays: inc1,
          lastPlayedAt: ts,
          lastPlayedGameId: gameId,
        },
        { merge: true },
      );
    }
    await batch.commit();
    res.json({ ok: true });
  } catch (err) {
    console.error('[Analytics] play:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

/** POST /api/analytics/session — lightweight page/session ping. */
router.post('/analytics/session', requireAuth, async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ ok: false });
  try {
    const db = getAdminFirestore();
    const dk = dayKey();
    const dailyRef = db.collection('platformAnalytics').doc('daily').collection('days').doc(dk);
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const inc1 = admin.firestore.FieldValue.increment(1);
    await dailyRef.set(
      {
        date: dk,
        sessions: inc1,
        updatedAt: ts,
      },
      { merge: true },
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[Analytics] session:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/analytics/dashboard', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  try {
    const db = getAdminFirestore();
    const [usersCount, lastDays, reviewsAgg, allGamesSnap] = await Promise.all([
      db.collection('users').count().get().then((c) => c.data().count).catch(() => null),
      db
        .collection('platformAnalytics')
        .doc('daily')
        .collection('days')
        .orderBy('date', 'desc')
        .limit(14)
        .get()
        .catch(() => null),
      aggregateReviewStats(db),
      db.collection('games').get().catch(() => null),
    ]);

    const topGames = allGamesSnap
      ? allGamesSnap.docs
          .map((d) => ({
            id: d.id,
            name: d.data().name || d.id,
            plays: d.data().plays || 0,
            category: d.data().category || '',
          }))
          .sort((a, b) => (b.plays || 0) - (a.plays || 0))
          .slice(0, 15)
      : [];

    const daily = lastDays
      ? lastDays.docs.map((d) => {
          const x = d.data();
          return {
            date: d.id,
            sessions: x.sessions || 0,
            gamePlays: x.gamePlays || 0,
          };
        })
      : [];

    res.json({
      userCount: usersCount,
      topGames,
      dailyActivity: daily,
      reviews: reviewsAgg,
    });
  } catch (err) {
    console.error('[Analytics] admin:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

async function aggregateReviewStats(db) {
  try {
    const games = await db.collection('games').limit(200).get();
    let totalReviews = 0;
    let sumAvg = 0;
    let n = 0;
    games.docs.forEach((doc) => {
      const c = doc.data().ratingCount || 0;
      if (c > 0) {
        totalReviews += c;
        const s = doc.data().ratingSum || 0;
        sumAvg += s / c;
        n += 1;
      }
    });
    return {
      totalReviews,
      avgRatingAcrossGames: n > 0 ? Math.round((sumAvg / n) * 10) / 10 : null,
    };
  } catch {
    return { totalReviews: 0, avgRatingAcrossGames: null };
  }
}

export default router;
