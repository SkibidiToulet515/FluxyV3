import { verifyToken, getUserRole, getUserPermissions } from '../config/firebase.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = header.slice(7);
  verifyToken(token).then((decoded) => {
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    req.uid = decoded.uid;
    req.email = decoded.email;
    next();
  });
}

export function requireRole(minRole) {
  const LEVELS = { user: 0, mod: 1, admin: 2 };

  return async (req, res, next) => {
    if (!req.uid) return res.status(401).json({ error: 'Not authenticated' });

    const role = await getUserRole(req.uid);
    if ((LEVELS[role] ?? 0) < (LEVELS[minRole] ?? 0)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    req.role = role;
    next();
  };
}

/** Enforce a single permission from Firestore roleDefinitions (after requireAuth). */
export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.uid) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const { roleKey, permissions } = await getUserPermissions(req.uid);
      req.roleKey = roleKey;
      req.permissions = permissions;
      if (!permissions[permission]) {
        return res.status(403).json({ error: 'Permission denied', required: permission });
      }
      next();
    } catch (err) {
      console.error('[Auth] requirePermission:', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/** True if the user has any of the listed permissions (after legacy manage_roles expansion). */
export function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    if (!req.uid) return res.status(401).json({ error: 'Not authenticated' });
    try {
      const { roleKey, permissions: perms } = await getUserPermissions(req.uid);
      req.roleKey = roleKey;
      req.permissions = perms;
      const ok = permissions.some((p) => perms[p]);
      if (!ok) {
        return res.status(403).json({ error: 'Permission denied', requiredOneOf: permissions });
      }
      next();
    } catch (err) {
      console.error('[Auth] requireAnyPermission:', err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
