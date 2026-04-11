/**
 * Canonical permission keys and default roleDefinitions shape (Firestore).
 * Server RBAC helpers live in ../lib/rbac.js
 */

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

export const OWNER_ROLE_KEY = 'owner';

function blankPermissions() {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false]));
}

function allPermissionsTrue() {
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, true]));
}

/** Default built-in roles keyed by user.role (roleDefinitions document id). */
export function getDefaultRoleDefinitions() {
  const none = blankPermissions();
  const ownerPerms = allPermissionsTrue();

  const adminPerms = {
    ...none,
    access_moderator_panel: true,
    access_admin_panel: true,
    manage_users: true,
    ban_users: true,
    moderate_chat: true,
    manage_games: true,
    manage_roles: true,
    assign_low_roles: true,
    assign_high_roles: true,
    create_roles: true,
    delete_roles: true,
  };

  const modPerms = {
    ...none,
    access_moderator_panel: true,
    manage_users: true,
    moderate_chat: true,
    manage_games: true,
  };

  return {
    user: {
      key: 'user',
      displayName: 'Member',
      description: 'Default account',
      system: true,
      protected: false,
      privilegeTier: 'low',
      order: 0,
      permissions: { ...none },
    },
    mod: {
      key: 'mod',
      displayName: 'Moderator',
      description: 'Community moderation',
      system: true,
      protected: false,
      privilegeTier: 'low',
      order: 1,
      permissions: modPerms,
    },
    admin: {
      key: 'admin',
      displayName: 'Administrator',
      description: 'Full platform management except Owner safeguards',
      system: true,
      protected: false,
      privilegeTier: 'high',
      order: 100,
      permissions: adminPerms,
    },
    [OWNER_ROLE_KEY]: {
      key: OWNER_ROLE_KEY,
      displayName: 'Owner',
      description: 'Highest authority; can manage Owner role and assignments',
      system: true,
      protected: true,
      privilegeTier: 'owner',
      order: 1000,
      permissions: ownerPerms,
    },
  };
}

export function isValidRoleKey(key) {
  if (typeof key !== 'string') return false;
  return /^[a-z][a-z0-9_]{1,39}$/.test(key);
}
