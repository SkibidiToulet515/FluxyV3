/** Mirrors Server/config/permissions.js — single list for UI. */

export const OWNER_ROLE_KEY = 'owner';

/** Permissions only assignable by holders of protect_owner (mirrors Server/lib/rbac.js). */
export const OWNER_ONLY_PERMISSION_KEYS = ['protect_owner'];

export const PERMISSION_KEYS = [
  'access_moderator_panel',
  'access_admin_panel',
  'manage_users',
  'ban_users',
  'moderate_chat',
  'manage_games',
  'manage_roles',
  'assign_low_roles',
  'assign_high_roles',
  'create_roles',
  'delete_roles',
  'protect_owner',
];

export const PERMISSION_LABELS = {
  access_moderator_panel: 'Moderator Panel',
  access_admin_panel: 'Admin Panel',
  manage_users: 'User moderation (warn, mute, reports)',
  ban_users: 'Ban / unban accounts',
  moderate_chat: 'Delete chat messages',
  manage_games: 'Manage games library',
  manage_roles: 'Legacy: full role management (superseded by granular)',
  assign_low_roles: 'Assign low-privilege roles (e.g. Moderator)',
  assign_high_roles: 'Assign high-privilege roles (e.g. Administrator)',
  create_roles: 'Create & edit custom roles',
  delete_roles: 'Delete custom roles',
  protect_owner: 'Owner safeguards (assign Owner, edit protected roles)',
};

export const TIER_LABELS = {
  owner: 'Owner',
  high: 'High privilege',
  low: 'Standard',
};
