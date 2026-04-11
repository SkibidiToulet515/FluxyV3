import { NavLink } from 'react-router-dom';
import { Home, Gamepad2, MessageCircle, Globe, Settings, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import './Taskbar.css';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/games', icon: Gamepad2, label: 'Games' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/proxy', icon: Globe, label: 'Web Tools' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Taskbar() {
  const { hasPermission } = useAuth();
  const showMod = hasPermission('access_moderator_panel');
  const showAdmin = hasPermission('access_admin_panel');

  return (
    <nav className="taskbar glass-bg">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `taskbar-link ${isActive ? 'active' : ''}`
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
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
    </nav>
  );
}
