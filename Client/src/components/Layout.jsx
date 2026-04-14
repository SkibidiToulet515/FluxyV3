import { useState, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import Taskbar from './Taskbar';
import { useAuth } from '../utils/AuthContext';
import { getLayoutMode } from '../utils/api';
import './Layout.css';

export default function Layout() {
  const [params] = useSearchParams();
  const windowMode = params.get('mode') === 'window';
  const [layoutMode, setLayoutMode] = useState(getLayoutMode);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { account, logout } = useAuth();

  useEffect(() => {
    const handler = () => setLayoutMode(getLayoutMode());
    window.addEventListener('fluxy-layout-change', handler);
    return () => window.removeEventListener('fluxy-layout-change', handler);
  }, []);

  const isSidebar = layoutMode === 'sidebar';

  if (windowMode) {
    return <Outlet context={{ onMenuToggle: () => {} }} />;
  }

  return (
    <div className={`layout ${isSidebar ? 'layout-sidebar' : 'layout-taskbar'}`}>
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
