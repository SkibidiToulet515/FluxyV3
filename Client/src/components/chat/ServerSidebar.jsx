import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function ServerSidebar() {
  const navigate = useNavigate();

  return (
    <div className="dc-server-bar">
      <div className="dc-server-logo" title="Fluxy">
        <span>F</span>
      </div>
      <div className="dc-server-divider" />

      <button
        className="dc-server-icon active"
        title="Fluxy Community"
      >
        <span className="dc-server-pill" />
        <div className="dc-server-avatar" style={{ '--server-color': 'var(--accent)' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>FC</span>
        </div>
      </button>

      <div className="dc-server-divider" />

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
    </div>
  );
}
