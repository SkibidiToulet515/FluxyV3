import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import { BUILTIN_ROLE_KEYS } from '../../utils/permissions';

export default function CustomRolesList({ roleList, stats, hasProtectOwner, onDeleted }) {
  const custom = roleList.filter((r) => !BUILTIN_ROLE_KEYS.includes(r.key));
  const [pendingDelete, setPendingDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    setMsg('');
    try {
      const data = await apiJson(`/api/roles/${encodeURIComponent(pendingDelete.key)}`, { method: 'DELETE' });
      setPendingDelete(null);
      const note =
        data.reassigned > 0
          ? ` Deleted; ${data.reassigned} account(s) set to Member.`
          : ' Role deleted.';
      setMsg(note);
      onDeleted?.();
    } catch (e) {
      setMsg(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  if (custom.length === 0 && !pendingDelete && !msg) {
    return (
      <div className="admin-custom-role glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <h4 className="admin-custom-role-title">Custom roles</h4>
        <p className="admin-muted" style={{ margin: 0 }}>
          No custom roles yet. Built-in roles (Member, Moderator, Administrator, Owner) cannot be removed here.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-custom-role glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
      <h4 className="admin-custom-role-title">Custom roles</h4>
      <p className="admin-form-hint" style={{ marginBottom: '0.75rem' }}>
        Remove roles you added for the platform. Built-in roles cannot be deleted.
        {hasProtectOwner
          ? ' As Owner, deleting a role that still has members moves them to Member automatically.'
          : ' If users are still assigned to a role, reassign them before deleting (or sign in as Owner).'}
      </p>
      {msg && <p className="admin-muted" style={{ marginBottom: '0.5rem' }}>{msg}</p>}
      {custom.length > 0 && (
        <ul className="admin-custom-role-list">
          {custom.map((r) => {
            const n = stats[r.key] || 0;
            return (
              <li key={r.key} className="admin-custom-role-row">
                <div>
                  <strong>{r.displayName || r.key}</strong>
                  <span className="admin-muted" style={{ marginLeft: 8 }}>({r.key})</span>
                  <span className="admin-role-stat-count" style={{ marginLeft: 8 }} title="Accounts with this role">
                    {n}
                  </span>
                  <span className="admin-muted" style={{ fontSize: '0.75rem' }}> users</span>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-xs admin-btn-danger"
                  onClick={() => {
                    setMsg('');
                    setPendingDelete({
                      key: r.key,
                      displayName: r.displayName || r.key,
                      userCount: n,
                    });
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {pendingDelete && (
        <div className="admin-role-confirm-block glass-card" style={{ marginTop: '0.75rem' }}>
          <p className="admin-confirm-text">
            Delete <strong>{pendingDelete.displayName}</strong> ({pendingDelete.key})?
            {pendingDelete.userCount > 0 && (
              <>
                {' '}
                <strong>{pendingDelete.userCount}</strong> user(s) have this role.
                {!hasProtectOwner && ' Reassign them first, or cancel.'}
                {hasProtectOwner && ' They will be moved to Member (user).'}
              </>
            )}
          </p>
          <div className="admin-confirm-actions">
            <button
              type="button"
              className="admin-btn admin-btn-danger admin-btn-xs"
              disabled={busy || (pendingDelete.userCount > 0 && !hasProtectOwner)}
              onClick={confirmDelete}
            >
              {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              {pendingDelete.userCount > 0 && hasProtectOwner ? ' Delete & move to Member' : ' Delete role'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-xs"
              disabled={busy}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
