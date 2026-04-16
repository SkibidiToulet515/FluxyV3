import { Router } from 'express';
import { verifyToken, getAdminFirestore } from '../config/firebase.js';

const router = Router();

/** Only allow CSS custom property keys and safe string values (no url(), @import, etc.). */
function sanitizeCustomTheme(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!/^--[a-zA-Z0-9_-]+$/.test(k)) continue;
    if (typeof v !== 'string') continue;
    const s = v.trim().slice(0, 400);
    if (!s) continue;
    if (/url\s*\(|expression\s*\(|@import|javascript:|data:\s*text\/html/i.test(s)) continue;
    out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

async function authenticate(req, res) {
  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  try {
    const decoded = await verifyToken(auth);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

router.get('/export', async (req, res) => {
  const uid = await authenticate(req, res);
  if (!uid) return;

  try {
    const db = getAdminFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.exists ? userSnap.data() : {};

    const friendsSnap = await db.collection('friends')
      .where('users', 'array-contains', uid)
      .where('status', '==', 'accepted')
      .get();
    const friends = friendsSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, otherUid: data.users?.find((u) => u !== uid) || null };
    });

    const serversSnap = await db.collection('servers')
      .where('members', 'array-contains', uid)
      .get();
    const servers = serversSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));

    const groupsSnap = await db.collection('groupChats')
      .where('members', 'array-contains', uid)
      .get();
    const groups = groupsSnap.docs.map((d) => ({ id: d.id, name: d.data().name }));

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      uid,
      profile: {
        username: userData.username || '',
        bio: userData.bio || '',
        status: userData.status || 'online',
        avatar: userData.avatar || null,
      },
      settings: {
        customTheme: userData.customTheme || null,
        backgroundUrl: userData.backgroundUrl || null,
        backgroundType: userData.backgroundType || null,
      },
      friends,
      servers,
      groups,
    };

    res.json(exportData);
  } catch (err) {
    console.error('[Export] Error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

router.post('/import', async (req, res) => {
  const uid = await authenticate(req, res);
  if (!uid) return;

  const data = req.body;
  if (!data || data.version !== 1) {
    return res.status(400).json({ error: 'Invalid export format' });
  }

  try {
    const db = getAdminFirestore();
    const updates = {};

    if (data.profile?.bio && typeof data.profile.bio === 'string') {
      updates.bio = data.profile.bio.slice(0, 500);
    }
    if (data.settings?.customTheme != null) {
      const sanitized = sanitizeCustomTheme(data.settings.customTheme);
      if (sanitized) updates.customTheme = sanitized;
    }

    if (Object.keys(updates).length > 0) {
      await db.doc(`users/${uid}`).update(updates);
    }

    res.json({ success: true, fieldsUpdated: Object.keys(updates) });
  } catch (err) {
    console.error('[Import] Error:', err.message);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
