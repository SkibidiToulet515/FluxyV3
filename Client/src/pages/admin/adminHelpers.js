import { ShieldAlert, ShieldCheck, UserCheck, Crown } from 'lucide-react';
import { roleTierFromDefinition, tierRank } from '../../lib/rbacClient';
import { OWNER_ROLE_KEY } from '../../utils/permissions';

export const ROLE_ICONS = { admin: ShieldAlert, mod: ShieldCheck, user: UserCheck, owner: Crown };

export function roleColor(key) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#22d3ee', '#34d399'];
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export const CATEGORIES = [
  'Uncategorized', 'Action', 'Adventure', 'Puzzle', 'Racing',
  'Sports', 'Strategy', 'Arcade', 'Shooting', 'Simulation', 'RPG', 'Other',
];

export function resolveRoleDef(roleList, key) {
  return roleList.find((r) => r.key === key) || { key };
}

export function isRoleAssignDisabled(targetUser, newRoleDef, roleList, hasPerm) {
  const oldDef = resolveRoleDef(roleList, targetUser.role || 'user');
  const oldTier = roleTierFromDefinition(oldDef);
  const newTier = roleTierFromDefinition(newRoleDef);
  if ((oldTier === 'owner' || newTier === 'owner') && !hasPerm('protect_owner')) return true;
  if (newRoleDef.key === OWNER_ROLE_KEY && !hasPerm('protect_owner')) return true;
  const high = tierRank(oldTier) >= 2 || tierRank(newTier) >= 2;
  if (high && !hasPerm('protect_owner')) {
    if (!hasPerm('assign_high_roles') && !hasPerm('manage_roles')) return true;
  } else if (!hasPerm('protect_owner')) {
    if (!hasPerm('assign_low_roles') && !hasPerm('manage_roles')) return true;
  }
  return false;
}

export function buildRoleChangeWarnings(targetUser, newRoleDef, roleList) {
  const warnings = [];
  const oldDef = resolveRoleDef(roleList, targetUser.role || 'user');
  const oldTier = roleTierFromDefinition(oldDef);
  const newTier = roleTierFromDefinition(newRoleDef);
  if (newRoleDef.key === OWNER_ROLE_KEY) {
    warnings.push('Assigning the Owner role: only use for true platform ownership.');
  }
  if (oldTier === 'owner' || newTier === 'owner') {
    warnings.push('This change involves the Owner tier (heavily restricted).');
  }
  if (tierRank(newTier) >= 2 && tierRank(oldTier) < 2) {
    warnings.push('Promoting to a high-privilege role (admin-level access).');
  }
  if (tierRank(oldTier) >= 2 && tierRank(newTier) < 2) {
    warnings.push('Demoting from a high-privilege role.');
  }
  if (newRoleDef.protected || newRoleDef.system) {
    warnings.push('Target role is system or protected metadata.');
  }
  return warnings;
}
