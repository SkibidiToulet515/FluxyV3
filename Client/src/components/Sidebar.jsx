import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  Home, Gamepad2, Globe, MessageCircle, Settings,
  ChevronLeft, ChevronRight, LogOut, Circle, ShieldAlert, ShieldCheck, Gavel, Heart,
  ShoppingBag, Package, Wallet,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import InclidesBalancePill from './inclides/InclidesBalancePill';
import { useAuth } from '../utils/AuthContext';
import { isGamesSectionPath, isProxySectionPath } from '../config/subjects';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', match: (p) => p === '/' },
  { to: '/library', icon: Heart, label: 'Library', match: (p) => p.startsWith('/library') },
  { to: '/shop', icon: ShoppingBag, label: 'Shop', match: (p) => p.startsWith('/shop') },
  { to: '/inventory', icon: Package, label: 'Inventory', match: (p) => p.startsWith('/inventory') },
  { to: '/wallet', icon: Wallet, label: 'Inclides', match: (p) => p.startsWith('/wallet') },
  {
    to: '/games',
    icon: Gamepad2,
    label: 'Games',
    match: isGamesSectionPath,
  },
  {
    to: '/history',
    icon: Globe,
    label: 'Proxy',
    match: isProxySectionPath,
  },
  { to: '/chat', icon: MessageCircle, label: 'Chat', match: (p) => p === '/chat' },
  { to: '/settings', icon: Settings, label: 'Settings', match: (p) => p === '/settings' },
  { to: '/moderation', icon: Gavel, label: 'Moderation', match: (p) => p === '/moderation' },
];

const STATUS_COLORS = {
  online: '#34d399',
  idle: '#fbbf24',
  dnd: '#ef4444',
  offline: '#71717a',
};

export default function Sidebar({ collapsed, onToggle, account, onLogout }) {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const showMod = hasPermission('access_moderator_panel');
  const showAdmin = hasPermission('access_admin_panel');
  const statusColor = STATUS_COLORS[account?.status || 'offline'];

  return (
    <>
      {!collapsed && <div className="sidebar-overlay" onClick={onToggle} />}
      <aside className={`sidebar glass-bg ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo" title="Home">
            <img
              className="logo-mark"
              src="/brand/fluxy-mark.svg"
              alt=""
              width={34}
              height={34}
            />
            <span className="logo-text">
              <span className="logo-text-flux">flux</span>
              <span className="logo-text-y">y</span>
            </span>
          </Link>
          <div className="sidebar-header-actions">
            <InclidesBalancePill compact />
            <NotificationBell />
            <button
              className="sidebar-collapse-btn"
              onClick={onToggle}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, icon: Icon, label, match }) => {
            const active = match(location.pathname);
            return (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={() => `sidebar-link ${active ? 'active' : ''}`}
                title={collapsed ? label : undefined}
              >
                <Icon size={20} />
                <span className="sidebar-label">{label}</span>
              </NavLink>
            );
          })}
          {showMod && (
            <NavLink
              to="/moderator"
              className={({ isActive }) =>
                `sidebar-link sidebar-link-mod ${isActive ? 'active' : ''}`
              }
              title={collapsed ? 'Moderator' : undefined}
            >
              <ShieldCheck size={20} />
              <span className="sidebar-label">Moderator</span>
            </NavLink>
          )}
          {showAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-link sidebar-link-admin ${isActive ? 'active' : ''}`
              }
              title={collapsed ? 'Admin' : undefined}
            >
              <ShieldAlert size={20} />
              <span className="sidebar-label">Admin</span>
            </NavLink>
          )}
        </nav>

        {account && (
          <div className="sidebar-account">
            <div className="sidebar-avatar-wrap">
              <div
                className="sidebar-avatar"
                style={{ background: account.color || 'var(--accent)' }}
              >
                {account.username.charAt(0).toUpperCase()}
              </div>
              <span
                className="sidebar-status-dot"
                style={{ background: statusColor }}
              />
            </div>
            <div className="sidebar-account-info">
              <span className="sidebar-username">{account.username}</span>
              <span className="sidebar-status-text">
                <Circle size={8} fill={statusColor} stroke="none" />
                {account.status || 'online'}
              </span>
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={onLogout}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
