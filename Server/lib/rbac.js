/**
 * Central RBAC: permissions, tiers, role assignment, and role-definition mutations.
 * Used by API routes; keep Firestore rules aligned (see firestore.rules).
 */

import {
  PERMISSION_KEYS as CONFIG_PERMISSION_KEYS,
  OWNER_ROLE_KEY,
  getDefaultRoleDefinitions,
} from '../config/permissions.js';

export { OWNER_ROLE_KEY };

/** @typedef {'low' | 'high' | 'owner'} PrivilegeTier */

/** Re-export canonical keys from config (single source of truth). */
export const PERMISSION_KEYS = CONFIG_PERMISSION_KEYS;

/** Which permissions imply "high" privilege when assigning a role or granting caps */
export const HIGH_TIER_PERMISSIONS = new Set([
  'access_admin_panel',
  'manage_roles',
  'assign_high_roles',
  'create_roles',
  'delete_roles',
  'ban_users',
  'protect_owner',
]);

export const OWNER_ONLY_PERMISSIONS = new Set(['protect_owner']);

/**
 * Legacy: manage_roles on old documents grants full role UI capabilities except protect_owner.
 */
export function expandLegacyManageRoles(perms) {
  if (!perms || typeof perms !== 'object') return { ...perms };
  const p = { ...perms };
  if (p.manage_roles === true) {
    p.assign_low_roles = true;
    p.assign_high_roles = true;
    p.create_roles = true;
    p.delete_roles = true;
  }
  return p;
}

export function sanitizePermissions(input) {
  const out = {};
  for (const k of PERMISSION_KEYS) {
    if (input && Object.prototype.hasOwnProperty.call(input, k)) {
      out[k] = Boolean(input[k]);
    }
  }
  return out;
}

/** Full permission map after PATCH: keys present in patch override; others keep existing. */
export function mergePermissionPatch(existingPerms, patchInput) {
  const ex = existingPerms || {};
  const raw = patchInput && typeof patchInput === 'object' ? patchInput : {};
  const out = {};
  for (const k of PERMISSION_KEYS) {
    out[k] = Object.prototype.hasOwnProperty.call(raw, k) ? Boolean(raw[k]) : Boolean(ex[k]);
  }
  return out;
}

/** Effective permission map for an actor (after legacy expansion). */
export function effectivePermissions(raw) {
  return expandLegacyManageRoles(raw || {});
}

/**
 * Tier of a role from its stored privilegeTier or from permission contents.
 */
export function computePrivilegeTierFromPermissions(perms) {
  const p = effectivePermissions(perms);
  if (p.protect_owner === true) return 'owner';
  for (const k of HIGH_TIER_PERMISSIONS) {
    if (p[k] === true) return 'high';
  }
  return 'low';
}

export function tierRank(tier) {
  if (tier === 'owner') return 3;
  if (tier === 'high') return 2;
  return 1;
}

export function roleDocTier(roleData, roleKey) {
  if (roleKey === OWNER_ROLE_KEY) return 'owner';
  const stored = roleData?.privilegeTier;
  if (stored === 'owner' || stored === 'high' || stored === 'low') return stored;
  return computePrivilegeTierFromPermissions(roleData?.permissions || {});
}

/**
 * Permissions the actor is allowed to grant when creating/editing a custom role.
 * Owner (protect_owner) may grant anything; others only permissions they hold, never protect_owner.
 */
export function grantablePermissionKeys(actorEffectivePerms) {
  const a = effectivePermissions(actorEffectivePerms);
  if (a.protect_owner === true) return [...PERMISSION_KEYS];
  const keys = [];
  for (const k of PERMISSION_KEYS) {
    if (k === 'protect_owner') continue;
    if (OWNER_ONLY_PERMISSIONS.has(k)) continue;
    if (a[k] === true) keys.push(k);
  }
  return keys;
}

export function assertPermissionsWithinGrantable(desiredPerms, actorEffectivePerms) {
  const allowed = new Set(grantablePermissionKeys(actorEffectivePerms));
  const d = sanitizePermissions(desiredPerms);
  for (const k of PERMISSION_KEYS) {
    if (!d[k]) continue;
    if (!allowed.has(k)) {
      const err = new Error(`Not allowed to grant permission: ${k}`);
      err.code = 'FORBIDDEN_GRANT';
      throw err;
    }
  }
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 */
export async function loadRoleDefinition(db, roleKey) {
  const snap = await db.collection('roleDefinitions').doc(roleKey).get();
  if (!snap.exists) return null;
  return { key: snap.id, ...snap.data() };
}

/**
 * Can actorUid assign targetUid to newRoleKey?
 */
export async function assertCanAssignUserRole(db, actorUid, targetUid, newRoleKey) {
  if (!actorUid || !targetUid) {
    const e = new Error('Invalid actor or target');
    e.code = 'INVALID';
    throw e;
  }
  if (actorUid === targetUid) {
    const e = new Error('Cannot change your own role through this action');
    e.code = 'SELF_ROLE';
    throw e;
  }

  const [actorUser, targetUser, newRole, actorRoleDef] = await Promise.all([
    db.collection('users').doc(actorUid).get(),
    db.collection('users').doc(targetUid).get(),
    db.collection('roleDefinitions').doc(newRoleKey).get(),
    db.collection('roleDefinitions').doc((await db.collection('users').doc(actorUid).get()).data()?.role || 'user').get(),
  ]);

  if (!newRole.exists) {
    const e = new Error('Unknown role');
    e.code = 'UNKNOWN_ROLE';
    throw e;
  }

  const actorRoleKey = actorUser.exists ? actorUser.data().role || 'user' : 'user';
  const actorPerms = effectivePermissions(actorRoleDef.exists ? actorRoleDef.data().permissions : {});

  const oldRoleKey = targetUser.exists ? targetUser.data().role || 'user' : 'user';
  const [oldDefSnap, newDefSnap] = await Promise.all([
    db.collection('roleDefinitions').doc(oldRoleKey).get(),
    Promise.resolve(newRole),
  ]);
  const oldTier = roleDocTier(oldDefSnap.exists ? oldDefSnap.data() : {}, oldRoleKey);
  const newTier = roleDocTier(newDefSnap.exists ? newDefSnap.data() : {}, newRoleKey);

  const touchesOwner = oldTier === 'owner' || newTier === 'owner';
  if (touchesOwner && !actorPerms.protect_owner) {
    const e = new Error('Only the protected Owner can change Owner role assignments');
    e.code = 'OWNER_PROTECTED';
    throw e;
  }

  const needsHigh = tierRank(oldTier) >= 2 || tierRank(newTier) >= 2;
  if (needsHigh && !actorPerms.protect_owner) {
    if (!actorPerms.assign_high_roles && !actorPerms.manage_roles) {
      const e = new Error('Missing permission to assign high-privilege roles');
      e.code = 'ASSIGN_HIGH_REQUIRED';
      throw e;
    }
  } else if (!needsHigh && !actorPerms.protect_owner) {
    if (!actorPerms.assign_low_roles && !actorPerms.manage_roles) {
      const e = new Error('Missing permission to assign this role');
      e.code = 'ASSIGN_LOW_REQUIRED';
      throw e;
    }
  }

  // Cannot assign owner role without protect_owner
  if (newRoleKey === OWNER_ROLE_KEY && !actorPerms.protect_owner) {
    const e = new Error('Only Owner can assign the Owner role');
    e.code = 'OWNER_ASSIGN';
    throw e;
  }
}

export async function assertCanModifyTargetUser(db, actorUid, targetUid, { forBan = false } = {}) {
  const targetUser = await db.collection('users').doc(targetUid).get();
  if (!targetUser.exists) return;
  const roleKey = targetUser.data().role || 'user';
  const def = await loadRoleDefinition(db, roleKey);
  const tier = roleDocTier(def || {}, roleKey);
  if (tier === 'owner') {
    const actorRoleKey = (await db.collection('users').doc(actorUid).get()).data()?.role || 'user';
    const actorDef = await loadRoleDefinition(db, actorRoleKey);
    const actorPerms = effectivePermissions(actorDef?.permissions || {});
    if (!actorPerms.protect_owner) {
      const e = new Error('This account is protected (Owner)');
      e.code = 'TARGET_OWNER_PROTECTED';
      throw e;
    }
  }
}

/**
 * Creating a new role document
 */
export async function assertCanCreateRole(db, actorUid, desiredPermissions) {
  const actorUser = await db.collection('users').doc(actorUid).get();
  const rk = actorUser.exists ? actorUser.data().role || 'user' : 'user';
  const actorDef = await loadRoleDefinition(db, rk);
  const actorPerms = effectivePermissions(actorDef?.permissions || {});
  if (!actorPerms.create_roles && !actorPerms.manage_roles) {
    const e = new Error('Missing permission to create roles');
    e.code = 'CREATE_ROLES';
    throw e;
  }
  assertPermissionsWithinGrantable(desiredPermissions, actorPerms);
  const tier = computePrivilegeTierFromPermissions(desiredPermissions);
  if (tier === 'high' && !actorPerms.assign_high_roles && !actorPerms.manage_roles && !actorPerms.protect_owner) {
    const e = new Error('Cannot create a high-privilege role without assign_high_roles');
    e.code = 'HIGH_ROLE_CREATE';
    throw e;
  }
  if (tier === 'owner') {
    const e = new Error('Invalid role configuration');
    e.code = 'INVALID_TIER';
    throw e;
  }
}

export async function assertCanUpdateRoleDefinition(db, actorUid, roleKey, { permissions: newPerms } = {}) {
  const existing = await loadRoleDefinition(db, roleKey);
  if (!existing) {
    const e = new Error('Role not found');
    e.code = 'NOT_FOUND';
    throw e;
  }
  const actorUser = await db.collection('users').doc(actorUid).get();
  const ark = actorUser.exists ? actorUser.data().role || 'user' : 'user';
  const actorDef = await loadRoleDefinition(db, ark);
  const actorPerms = effectivePermissions(actorDef?.permissions || {});

  if (existing.protected === true || roleKey === OWNER_ROLE_KEY) {
    if (!actorPerms.protect_owner) {
      const e = new Error('This role is protected and can only be changed by Owner');
      e.code = 'ROLE_PROTECTED';
      throw e;
    }
  } else {
    if (!actorPerms.create_roles && !actorPerms.manage_roles) {
      const e = new Error('Missing permission to edit roles');
      e.code = 'EDIT_ROLE';
      throw e;
    }
  }

    if (newPerms != null) {
    if (existing.system === true && !actorPerms.protect_owner) {
      const e = new Error('Cannot change permissions of built-in roles');
      e.code = 'SYSTEM_ROLE_PERMS';
      throw e;
    }
    assertPermissionsWithinGrantable(newPerms, actorPerms);
    const mergedTier = computePrivilegeTierFromPermissions(newPerms);
    if (mergedTier === 'high' && !actorPerms.assign_high_roles && !actorPerms.manage_roles && !actorPerms.protect_owner) {
      const e = new Error('Cannot elevate role to high tier without assign_high_roles');
      e.code = 'HIGH_ROLE_PATCH';
      throw e;
    }
    if (roleKey === OWNER_ROLE_KEY) {
      if (computePrivilegeTierFromPermissions(newPerms) !== 'owner') {
        const e = new Error('Cannot strip Owner safeguards from the Owner role');
        e.code = 'OWNER_ROLE_WEAKEN';
        throw e;
      }
    }
  }
}

export async function assertCanDeleteRoleDefinition(db, actorUid, roleKey) {
  const defaults = getDefaultRoleDefinitions();
  if (defaults[roleKey]) {
    const e = new Error('Cannot delete built-in role');
    e.code = 'BUILTIN_DELETE';
    throw e;
  }
  if (roleKey === OWNER_ROLE_KEY) {
    const e = new Error('Cannot delete the Owner role');
    e.code = 'OWNER_DELETE';
    throw e;
  }
  const existing = await loadRoleDefinition(db, roleKey);
  if (!existing) {
    const e = new Error('Role not found');
    e.code = 'NOT_FOUND';
    throw e;
  }

  const actorUser = await db.collection('users').doc(actorUid).get();
  const ark = actorUser.exists ? actorUser.data().role || 'user' : 'user';
  const actorDef = await loadRoleDefinition(db, ark);
  const actorPerms = effectivePermissions(actorDef?.permissions || {});

  if (existing.protected === true) {
    if (!actorPerms.protect_owner) {
      const e = new Error('Cannot delete protected role');
      e.code = 'PROTECTED_DELETE';
      throw e;
    }
  } else if (!actorPerms.delete_roles && !actorPerms.manage_roles) {
    const e = new Error('Missing permission to delete roles');
    e.code = 'DELETE_ROLES';
    throw e;
  }
}

