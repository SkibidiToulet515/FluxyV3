/**
 * Homepage / content configuration (Admin SDK writes).
 */
import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';

const router = express.Router();
const DOC = 'homepage';

router.get('/cms/homepage', async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ config: null });
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('appConfig').doc(DOC).get();
    if (!snap.exists) {
      return res.json({
        config: {
          featuredIds: [],
          sectionOrder: ['continue', 'featured', 'trending', 'recommended', 'favorites', 'new'],
          hiddenSections: [],
          marksNew: {},
        },
      });
    }
    res.json({ config: snap.data() });
  } catch (err) {
    console.error('[CMS] get:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

router.patch('/cms/homepage', requireAuth, requirePermission('access_admin_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Unavailable' });
  const body = req.body || {};
  try {
    const db = getAdminFirestore();
    const ref = db.collection('appConfig').doc(DOC);
    const ts = admin.firestore.FieldValue.serverTimestamp();
    const patch = { updatedAt: ts, updatedBy: req.uid };
    if (Array.isArray(body.featuredIds)) {
      patch.featuredIds = body.featuredIds.map((x) => String(x).trim()).filter(Boolean).slice(0, 40);
    }
    if (Array.isArray(body.sectionOrder)) {
      patch.sectionOrder = body.sectionOrder.map((x) => String(x).trim()).filter(Boolean).slice(0, 20);
    }
    if (Array.isArray(body.hiddenSections)) {
      patch.hiddenSections = body.hiddenSections.map((x) => String(x).trim()).filter(Boolean);
    }
    if (body.marksNew && typeof body.marksNew === 'object') {
      patch.marksNew = body.marksNew;
    }
    await ref.set(patch, { merge: true });
    const snap = await ref.get();
    res.json({ ok: true, config: snap.data() });
  } catch (err) {
    console.error('[CMS] patch:', err);
    res.status(500).json({ error: 'Failed to save' });
  }
});

export default router;
