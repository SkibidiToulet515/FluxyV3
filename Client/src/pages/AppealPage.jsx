import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import AppealCenter from '../components/appeals/AppealCenter';

/** Limited surface for banned users (appeal + sign out). */
export default function AppealPage() {
  const { account, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && account && !account.isBanned) {
      navigate('/moderation', { replace: true });
    }
  }, [loading, account, navigate]);

  if (!loading && account && !account.isBanned) return null;
  return <AppealCenter variant="banned" />;
}
