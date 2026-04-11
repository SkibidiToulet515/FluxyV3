/**
 * Client-side RBAC helpers (mirror Server/lib/rbac.js legacy expansion for UI checks).
 * Security is enforced on the server and in Firestore rules.
 */

import { PERMISSION_KEYS, OWNER_ROLE_KEY, OWNER_ONLY_PERMISSION_KEYS } from '../utils/permissions';

export { OWNER_ROLE_KEY };

export function expandLegacyManageRoles(perms) {
  if (!perms || typeof perms !== 'object') return {};
  const p = { ...perms };
  if (p.manage_roles === true) {
    p.assign_low_roles = true;
    p.assign_high_roles = true;
    p.create_roles = true;
    p.delete_roles = true;
  }
  return p;
}

export function tierRank(tier) {
  if (tier === 'owner') return 3;
  if (tier === 'high') return 2;
  return 1;
}

export function roleTierFromDefinition(roleDef) {
  if (!roleDef) return 'low';
  if (roleDef.key === OWNER_ROLE_KEY) return 'owner';
  const t = roleDef.privilegeTier;
  if (t === 'owner' || t === 'high' || t === 'low') return t;
  const p = expandLegacyManageRoles(roleDef.permissions || {});
  if (p.protect_owner) return 'owner';
  const highKeys = new Set([
    'access_admin_panel',
    'manage_roles',
    'assign_high_roles',
    'create_roles',
    'delete_roles',
    'ban_users',
    'protect_owner',
  ]);
  for (const k of PERMISSION_KEYS) {
    if (highKeys.has(k) && p[k]) return 'high';
  }
  return 'low';
}

export function grantablePermissionKeys(actorEffectivePerms) {
  const a = expandLegacyManageRoles(actorEffectivePerms);
  if (a.protect_owner === true) return [...PERMISSION_KEYS];
  const ownerOnly = new Set(OWNER_ONLY_PERMISSION_KEYS);
  const keys = [];
  for (const k of PERMISSION_KEYS) {
    if (ownerOnly.has(k)) continue;
    if (a[k] === true) keys.push(k);
  }
  return keys;
}
