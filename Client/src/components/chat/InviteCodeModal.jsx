import { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { createServerInvite } from '../../services/firestore';

export default function InviteCodeModal({ server, onClose }) {
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const serverId = server.id;
    const serverName = server.name;
    let cancelled = false;
    setInvite(null);
    setError('');
    setCopied(false);
    setLoading(true);
    (async () => {
      try {
        const res = await createServerInvite(serverId, serverName);
        if (!cancelled) setInvite(res);
      } catch (e) {
        if (!cancelled) {
          setInvite(null);
          setError(e.message || 'Failed to create invite');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [server.id, server.name]);

  const code = invite?.code ?? null;

  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal dc-invite-code-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Server invite</h3>
          <button type="button" className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-modal-body">
          <p className="dc-invite-code-hint">
            This invite is valid for <strong>{server.name}</strong> only. Anyone with the code can join
            that server — it will not grant access to any other community.
          </p>
          {loading && (
            <div className="dc-invite-code-loading"><Loader2 className="spin" size={22} /></div>
          )}
          {error && <div className="dc-modal-error">{error}</div>}
          {!loading && invite && (
            <div
              className="dc-invite-result dc-invite-result-lg"
              key={`${server.id}-${invite.code}`}
              aria-live="polite"
            >
              <code className="dc-invite-code">{invite.code}</code>
              <button type="button" className="dc-invite-copy" onClick={copy} title="Copy">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          )}
          {!loading && invite && (
            <p className="dc-invite-firestore-bind">
              Joins <strong>{invite.boundServerName || server.name}</strong>
              {invite.boundServerId && invite.boundServerId !== server.id ? (
                <span className="dc-invite-bind-warn"> (data mismatch — contact support)</span>
              ) : null}
            </p>
          )}
          <button type="button" className="dc-modal-submit" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
