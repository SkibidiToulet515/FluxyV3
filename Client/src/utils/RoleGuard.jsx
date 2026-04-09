import { useAuth } from './AuthContext';

export function RequireRole({ minRole, children, fallback = null }) {
  const { hasRole, loading } = useAuth();
  if (loading) return null;
  if (!hasRole(minRole)) return fallback;
  return children;
}

export function AdminOnly({ children, fallback = null }) {
  return <RequireRole minRole="admin" fallback={fallback}>{children}</RequireRole>;
}

export function ModOnly({ children, fallback = null }) {
  return <RequireRole minRole="mod" fallback={fallback}>{children}</RequireRole>;
}
