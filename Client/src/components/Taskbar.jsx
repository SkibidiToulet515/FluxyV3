import { NavLink, useLocation } from 'react-router-dom';
import {
  Home, Gamepad2, Globe, MessageCircle, Settings, ShieldAlert, ShieldCheck, Gavel, Heart,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { isGamesSectionPath, isProxySectionPath } from '../config/subjects';
import InclidesBalancePill from './inclides/InclidesBalancePill';
import './Taskbar.css';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home', match: (p) => p === '/' },
  { to: '/library', icon: Heart, label: 'Library', match: (p) => p.startsWith('/library') },
  { to: '/shop', icon: ShoppingBag, label: 'Shop', match: (p) => p.startsWith('/shop') },
  { to: '/games', icon: Gamepad2, label: 'Games', match: isGamesSectionPath },
  { to: '/history', icon: Globe, label: 'Proxy', match: isProxySectionPath },
  { to: '/chat', icon: MessageCircle, label: 'Chat', match: (p) => p === '/chat' },
  { to: '/settings', icon: Settings, label: 'Settings', match: (p) => p === '/settings' },
  { to: '/moderation', icon: Gavel, label: 'Moderation', match: (p) => p === '/moderation' },
];

export default function Taskbar() {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const showMod = hasPermission('access_moderator_panel');
  const showAdmin = hasPermission('access_admin_panel');

  return (
    <nav className="taskbar glass-bg">
      <div className="taskbar-inclides">
        <InclidesBalancePill compact />
      </div>
      <div className="taskbar-links">
      {NAV_ITEMS.map(({ to, icon: Icon, label, match }) => {
        const active = match(location.pathname);
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={() => `taskbar-link ${active ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        );
      })}
      {showMod && (
        <NavLink
          to="/moderator"
          className={({ isActive }) =>
            `taskbar-link taskbar-link-mod ${isActive ? 'active' : ''}`
          }
        >
          <ShieldCheck size={20} />
          <span>Mod</span>
        </NavLink>
      )}
      {showAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `taskbar-link taskbar-link-admin ${isActive ? 'active' : ''}`
          }
        >
          <ShieldAlert size={20} />
          <span>Admin</span>
        </NavLink>
      )}
      </div>
    </nav>
  );
}
