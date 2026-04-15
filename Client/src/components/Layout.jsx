import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Taskbar from './Taskbar';
import ReferralOnboarding from './ReferralOnboarding';
import ModerationWarningsModal from './ModerationWarningsModal';
import GiveawayModal from './giveaway/GiveawayModal';
import { useAuth } from '../utils/AuthContext';
import { getLayoutMode } from '../utils/api';
import './Layout.css';

export default function Layout() {
  const [layoutMode, setLayoutMode] = useState(getLayoutMode);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { account, logout } = useAuth();
  const showReferralOnboarding = Boolean(account?.needsReferralOnboarding);

  useEffect(() => {
    const handler = () => setLayoutMode(getLayoutMode());
    window.addEventListener('fluxy-layout-change', handler);
    return () => window.removeEventListener('fluxy-layout-change', handler);
  }, []);

  const isSidebar = layoutMode === 'sidebar';

  return (
    <div className={`layout ${isSidebar ? 'layout-sidebar' : 'layout-taskbar'}`}>
      {showReferralOnboarding && <ReferralOnboarding />}
      {!showReferralOnboarding && <ModerationWarningsModal />}
      {!showReferralOnboarding && <GiveawayModal />}
      {isSidebar ? (
        <Sidebar
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen((p) => !p)}
          account={account}
          onLogout={logout}
        />
      ) : (
        <Taskbar />
      )}
      <main
        className={`layout-content ${
          isSidebar
            ? sidebarOpen
              ? 'with-sidebar'
              : 'with-sidebar-collapsed'
            : 'with-taskbar'
        }`}
      >
        <Outlet context={{ onMenuToggle: () => setSidebarOpen((p) => !p) }} />
      </main>
    </div>
  );
}
