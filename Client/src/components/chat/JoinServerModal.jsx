import { useState } from 'react';
import { X, LogIn } from 'lucide-react';
import { useServerInvite } from '../../services/firestore';

export default function JoinServerModal({ uid, onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      const serverId = await useServerInvite(trimmed, uid);
      onJoined?.(serverId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to join server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Join a Server</h3>
          <button className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-modal-body">
          <p className="dc-modal-hint dc-join-server-hint">
            Every invite is tied to a single server. Enter the code you received — you will join that
            server only; codes never work across different servers.
          </p>
          <label className="dc-modal-label">Invite code</label>
          <input
            className="dc-modal-input"
            placeholder="Enter invite code…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          {error && <div className="dc-modal-error">{error}</div>}
          <div className="dc-modal-actions">
            <button className="dc-modal-cancel" onClick={onClose}>Cancel</button>
            <button className="dc-modal-submit" disabled={!code.trim() || loading} onClick={handleJoin}>
              <LogIn size={14} />
              {loading ? 'Joining…' : 'Join Server'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
