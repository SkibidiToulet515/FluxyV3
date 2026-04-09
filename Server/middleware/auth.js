import { verifyToken, getUserRole } from '../config/firebase.js';

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
