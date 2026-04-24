import { useState } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Flag, ScrollText, Shield, Gamepad2, Gavel,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import Header from '../components/Header';
import { GameManagement } from './AdminPanel';
import AppealsStaffPanel from '../components/appeals/AppealsStaffPanel';
import ModOverview from './moderator/ModOverview';
import ModUsers from './moderator/ModUsers';
import ModReports from './moderator/ModReports';
import ModLogs from './moderator/ModLogs';
import ModRolesInfo from './moderator/ModRolesInfo';
import './ModeratorPanel.css';

export default function ModeratorPanel() {
  const { onMenuToggle } = useOutletContext();
  const { hasPermission, loading } = useAuth();
  const [tab, setTab] = useState('overview');

  if (loading) return null;
  if (!hasPermission('access_moderator_panel')) {
    return <Navigate to="/" replace />;
  }

  const showGames = hasPermission('manage_games');

  return (
    <div className="mod-page animate-fade-in">
      <Header title="Moderator Panel" onMenuClick={onMenuToggle} />

      <div className="mod-tabs admin-tabs">
        <button type="button" className={`admin-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          <LayoutDashboard size={16} /> Overview
        </button>
        <button type="button" className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Users size={16} /> Users
        </button>
        <button type="button" className={`admin-tab ${tab === 'appeals' ? 'active' : ''}`} onClick={() => setTab('appeals')}>
          <Gavel size={16} /> Appeals
        </button>
        <button type="button" className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          <Flag size={16} /> Reports
        </button>
        <button type="button" className={`admin-tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          <ScrollText size={16} /> Logs
        </button>
        <button type="button" className={`admin-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          <Shield size={16} /> Roles
        </button>
        {showGames && (
          <button type="button" className={`admin-tab ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
            <Gamepad2 size={16} /> Games
          </button>
        )}
      </div>

      {tab === 'overview' && <ModOverview />}
      {tab === 'users' && <ModUsers />}
      {tab === 'appeals' && <AppealsStaffPanel />}
      {tab === 'reports' && <ModReports />}
      {tab === 'logs' && <ModLogs />}
      {tab === 'roles' && <ModRolesInfo />}
      {tab === 'games' && showGames && <GameManagement />}
    </div>
  );
}
