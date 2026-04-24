import { useState } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import {
  Users, Gamepad2, Shield, Gift, BarChart3, LayoutGrid, Sparkles,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import Header from '../components/Header';
import UserManagement from './admin/UserManagement';
import GameManagement from './admin/GameManagement';
import RoleManagement from './admin/RoleManagement';
import GiveawaysAdminTab from './admin/GiveawaysAdminTab';
import AnalyticsTab from './admin/AnalyticsTab';
import HomepageCmsTab from './admin/HomepageCmsTab';
import InclidesAdminTab from './admin/InclidesAdminTab';
import './AdminPanel.css';

// Re-export GameManagement so ModeratorPanel (and others) can still do:
//   import { GameManagement } from './AdminPanel';
export { GameManagement };

export default function AdminPanel() {
  const { onMenuToggle } = useOutletContext();
  const { hasPermission, loading } = useAuth();
  const [tab, setTab] = useState('users');

  if (loading) return null;
  if (!hasPermission('access_admin_panel')) return <Navigate to="/" replace />;

  return (
    <div className="admin-page animate-fade-in">
      <Header title="Admin Panel" onMenuClick={onMenuToggle} />

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Users size={16} /> Users
        </button>
        <button className={`admin-tab ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
          <Gamepad2 size={16} /> Games
        </button>
        <button className={`admin-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          <Shield size={16} /> Roles
        </button>
        <button className={`admin-tab ${tab === 'giveaways' ? 'active' : ''}`} onClick={() => setTab('giveaways')}>
          <Gift size={16} /> Giveaways
        </button>
        <button className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          <BarChart3 size={16} /> Analytics
        </button>
        <button className={`admin-tab ${tab === 'cms' ? 'active' : ''}`} onClick={() => setTab('cms')}>
          <LayoutGrid size={16} /> Homepage
        </button>
        <button className={`admin-tab ${tab === 'inclides' ? 'active' : ''}`} onClick={() => setTab('inclides')}>
          <Sparkles size={16} /> Inclides
        </button>
      </div>

      {tab === 'users' && <UserManagement />}
      {tab === 'games' && <GameManagement />}
      {tab === 'roles' && <RoleManagement />}
      {tab === 'giveaways' && <GiveawaysAdminTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'cms' && <HomepageCmsTab />}
      {tab === 'inclides' && <InclidesAdminTab />}
    </div>
  );
}
