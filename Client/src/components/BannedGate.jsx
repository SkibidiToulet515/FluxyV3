import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

/** Blocks the main app for banned accounts (they use `/appeal` only). */
export default function BannedGate({ children }) {
  const { account, loading, profile } = useAuth();
  if (loading) return null;
  if (profile?.banned || account?.isBanned) {
    return <Navigate to="/appeal" replace />;
  }
  return children;
}
