import express from 'express';
import admin from 'firebase-admin';
import { requireAuth, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { getAdminFirestore, getUserPermissions, isFirebaseAdminReady } from '../config/firebase.js';
import { isValidRoleKey, getDefaultRoleDefinitions } from '../config/permissions.js';
import {
  OWNER_ROLE_KEY,
  mergePermissionPatch,
  grantablePermissionKeys,
  assertCanCreateRole,
  assertCanUpdateRoleDefinition,
  assertCanDeleteRoleDefinition,
  computePrivilegeTierFromPermissions,
  effectivePermissions,
} from '../lib/rbac.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('access_moderator_panel'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Roles unavailable' });
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('roleDefinitions').get();
    const roles = snap.docs
      .map((d) => ({ key: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.key.localeCompare(b.key));
    const { permissions } = await getUserPermissions(req.uid);
    res.json({
      roles,
      grantablePermissions: grantablePermissionKeys(permissions),
    });
  } catch (err) {
    console.error('[Roles] list:', err);
    res.status(500).json({ error: 'Failed to list roles' });
  }
});

router.post('/', requireAnyPermission('create_roles', 'manage_roles'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Roles unavailable' });
  const key = (req.body?.key || '').toString().trim().toLowerCase();
  const displayName = (req.body?.displayName || '').toString().trim().slice(0, 80);
  const description = (req.body?.description || '').toString().trim().slice(0, 300);
  if (!isValidRoleKey(key)) {
    return res.status(400).json({ error: 'Invalid role key (lowercase letters, numbers, underscore; 2–40 chars)' });
  }
  if (!displayName) {
    return res.status(400).json({ error: 'displayName required' });
  }
  if (key === OWNER_ROLE_KEY) {
    return res.status(400).json({ error: 'Cannot create Owner role' });
  }
  const defaults = getDefaultRoleDefinitions();
  if (defaults[key]) {
    return res.status(400).json({ error: 'Key conflicts with built-in role' });
  }
  try {
    const db = getAdminFirestore();
    const permissions = mergePermissionPatch({}, req.body?.permissions || {});
    await assertCanCreateRole(db, req.uid, permissions);
    const ref = db.collection('roleDefinitions').doc(key);
    const existing = await ref.get();
    if (existing.exists) {
      return res.status(409).json({ error: 'Role key already exists' });
    }
    const privilegeTier = computePrivilegeTierFromPermissions(permissions);
    const ts = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({
      key,
      displayName,
      description,
      system: false,
      protected: false,
      order: Number(req.body?.order) || 50,
      permissions,
      privilegeTier,
      createdAt: ts,
      updatedAt: ts,
    });
    res.status(201).json({ ok: true, key });
  } catch (err) {
    if (err.code) {
      return res.status(err.code === 'FORBIDDEN_GRANT' || err.code === 'HIGH_ROLE_CREATE' ? 403 : 400).json({
        error: err.message,
        code: err.code,
      });
    }
    console.error('[Roles] create:', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

router.patch('/:key', requireAnyPermission('create_roles', 'manage_roles'), async (req, res) => {
  if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Roles unavailable' });
  const { key } = req.params;
  try {
    const db = getAdminFirestore();
    const ref = db.collection('roleDefinitions').doc(key);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Role not found' });

    let mergedPermissions = undefined;
    if (req.body.permissions != null) {
      mergedPermissions = mergePermissionPatch(snap.data().permissions, req.body.permissions);
    }

    await assertCanUpdateRoleDefinition(db, req.uid, key, {
      permissions: mergedPermissions,
    });

    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (req.body.displayName != null) {
      updates.displayName = String(req.body.displayName).trim().slice(0, 80);
    }
    if (req.body.description != null) {
      updates.description = String(req.body.description).trim().slice(0, 300);
    }
    if (req.body.order != null) {
      updates.order = Number(req.body.order) || 50;
    }
    if (mergedPermissions != null) {
      updates.permissions = mergedPermissions;
      updates.privilegeTier = computePrivilegeTierFromPermissions(mergedPermissions);
    }
    await ref.update(updates);
    res.json({ ok: true });
  } catch (err) {
    if (err.code) {
      const status =
        err.code === 'ROLE_PROTECTED'
          || err.code === 'SYSTEM_ROLE_PERMS'
          || err.code === 'FORBIDDEN_GRANT'
          || err.code === 'OWNER_ROLE_WEAKEN'
          ? 403
          : err.code === 'NOT_FOUND'
            ? 404
            : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error('[Roles] patch:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.delete(
  '/:key',
  requireAnyPermission('delete_roles', 'manage_roles', 'protect_owner'),
  async (req, res) => {
    if (!isFirebaseAdminReady()) return res.status(503).json({ error: 'Roles unavailable' });
    const { key } = req.params;
    try {
      const db = getAdminFirestore();
      await assertCanDeleteRoleDefinition(db, req.uid, key);

      const { permissions } = await getUserPermissions(req.uid);
      const eff = effectivePermissions(permissions);
      const usersSnap = await db.collection('users').where('role', '==', key).get();
      let reassigned = 0;
      if (!usersSnap.empty) {
        if (!eff.protect_owner) {
          return res.status(400).json({
            error:
              'Cannot delete this role while users are assigned to it. Reassign those accounts first, or sign in as Owner to delete the role and move everyone to Member.',
            code: 'ROLE_IN_USE',
            count: usersSnap.size,
          });
        }
        const chunk = 400;
        for (let i = 0; i < usersSnap.docs.length; i += chunk) {
          const batch = db.batch();
          for (const d of usersSnap.docs.slice(i, i + chunk)) {
            batch.update(d.ref, { role: 'user' });
          }
          await batch.commit();
        }
        reassigned = usersSnap.size;
      }

      await db.collection('roleDefinitions').doc(key).delete();
      res.json({ ok: true, reassigned });
    } catch (err) {
      if (err.code) {
        const status =
          err.code === 'NOT_FOUND'
            ? 404
            : err.code === 'BUILTIN_DELETE'
              || err.code === 'OWNER_DELETE'
              || err.code === 'PROTECTED_DELETE'
              || err.code === 'DELETE_ROLES'
              ? 403
              : 400;
        return res.status(status).json({ error: err.message, code: err.code });
      }
      console.error('[Roles] delete:', err);
      res.status(500).json({ error: 'Failed to delete role' });
    }
  },
);

export default router;
