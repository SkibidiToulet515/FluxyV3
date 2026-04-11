import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, Compass } from 'lucide-react';
import CreateServerModal from './CreateServerModal';

export default function ServerSidebar({
  servers = [],
  activeServerId,
  onSelectServer,
  onSelectHome,
  uid,
}) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="dc-server-bar">
      <button
        className={`dc-server-logo ${!activeServerId ? 'active' : ''}`}
        title="Home"
        onClick={onSelectHome}
      >
        <span>F</span>
      </button>
      <div className="dc-server-divider" />

      {servers.map((server) => (
        <button
          key={server.id}
          className={`dc-server-icon ${activeServerId === server.id ? 'active' : ''}`}
          title={server.name}
          onClick={() => onSelectServer(server.id, server.channels?.[0]?.id || 'general')}
        >
          <span className="dc-server-pill" />
          <div
            className="dc-server-avatar"
            style={{ '--server-color': 'var(--accent)' }}
          >
            {server.icon ? (
              <img src={server.icon} alt="" className="dc-server-avatar-img" />
            ) : (
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {server.name?.charAt(0)?.toUpperCase() || 'S'}
              </span>
            )}
          </div>
        </button>
      ))}

      <div className="dc-server-divider" />

      <button
        className="dc-server-icon"
        title="Create Server"
        onClick={() => setShowCreate(true)}
      >
        <span className="dc-server-pill" />
        <div className="dc-server-avatar dc-server-add">
          <Plus size={20} />
        </div>
      </button>

      <button
        className="dc-server-icon"
        onClick={() => navigate('/')}
        title="Back to Dashboard"
      >
        <span className="dc-server-pill" />
        <div className="dc-server-avatar">
          <Home size={20} />
        </div>
      </button>

      {showCreate && (
        <CreateServerModal
          onClose={() => setShowCreate(false)}
          uid={uid}
        />
      )}
    </div>
  );
}
