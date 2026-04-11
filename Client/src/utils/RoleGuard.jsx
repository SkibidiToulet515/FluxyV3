import { useAuth } from './AuthContext';

export function RequireRole({ minRole, children, fallback = null }) {
  const { hasRole, loading } = useAuth();
  if (loading) return null;
  if (!hasRole(minRole)) return fallback;
  return children;
}

/** Gate on a single permission from roleDefinitions (preferred for new routes). */
export function RequirePermission({ permission, children, fallback = null }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return null;
  if (!hasPermission(permission)) return fallback;
  return children;
}

export function AdminOnly({ children, fallback = null }) {
  return <RequirePermission permission="access_admin_panel" fallback={fallback}>{children}</RequirePermission>;
}

export function ModOnly({ children, fallback = null }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return null;
  if (!hasPermission('access_moderator_panel') && !hasPermission('access_admin_panel')) return fallback;
  return children;
}
