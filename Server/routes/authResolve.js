import { Router } from 'express';
import { getAdminFirestore } from '../config/firebase.js';

const router = Router();

/**
 * Pre-login: map username -> Auth email (Firestore rules block client reads while logged out).
 */
router.post('/resolve-username', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection('users').where('username', '==', username).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({ found: false });
    }
    const data = snap.docs[0].data();
    const email = data.email;
    if (!email || typeof email !== 'string') {
      return res.status(404).json({ found: false });
    }
    return res.json({ found: true, email });
  } catch (err) {
    console.error('[auth/resolve-username]', err);
    return res.status(500).json({ error: 'Lookup failed' });
  }
});

export default router;
