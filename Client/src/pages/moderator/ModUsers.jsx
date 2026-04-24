import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Loader2, Ban, Mic, Lock, Unlock, StickyNote,
} from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { apiJson } from '../../services/apiClient';
import { OWNER_ROLE_KEY } from '../../lib/rbacClient';
import formatTime from './formatTime';

function modTargetOwnerLocked(u, actorHasProtectOwner) {
  if (actorHasProtectOwner) return false;
  if (u.role === OWNER_ROLE_KEY) return true;
  return u.rolePrivilegeTier === 'owner';
}

function ModUserNotesPanel({ uid, displayUsername, onClose }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLocalErr('');
    try {
      const data = await apiJson(`/api/moderation/users/${encodeURIComponent(uid)}/notes`);
      setNotes(data.notes || []);
    } catch (e) {
      setLocalErr(e.message || 'Failed to load notes');
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setLocalErr('');
    try {
      await apiJson(`/api/moderation/users/${encodeURIComponent(uid)}/notes`, {
        method: 'POST',
        body: { body },
      });
      setText('');
      await load();
    } catch (e) {
      setLocalErr(e.message || 'Could not save note');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mod-modal glass-card mod-user-notes">
      <h4>Staff notes</h4>
      <p className="admin-muted mod-notes-target">
        <strong>{displayUsername || uid}</strong>
        <span className="mod-notes-uid-hint"> · internal id</span>{' '}
        <code className="mod-notes-uid">{uid}</code>
      </p>
      {localErr && <p className="admin-error-banner">{localErr}</p>}
      {loading ? (
        <div className="admin-loading">
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      ) : (
        <ul className="mod-notes-list">
          {notes.map((n) => (
            <li key={n.id} className="mod-notes-item">
              <p className="mod-notes-body">{n.body}</p>
              <span className="admin-muted mod-notes-meta">
                {formatTime(n.createdAt)}
                {n.authorUid ? ` · ${n.authorUid.slice(0, 8)}…` : ''}
              </span>
            </li>
          ))}
          {notes.length === 0 && (
            <li className="admin-muted">No notes yet.</li>
          )}
        </ul>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add an internal note (visible to moderators)"
        rows={3}
        className="mod-modal-textarea"
      />
      <div className="mod-modal-actions">
        <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-primary admin-btn-sm"
          onClick={addNote}
          disabled={busy || !text.trim()}
        >
          {busy ? 'Saving…' : 'Add note'}
        </button>
      </div>
    </div>
  );
}

export default function ModUsers() {
  const { hasPermission } = useAuth();
  const actorHasProtectOwner = hasPermission('protect_owner');
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [warnUid, setWarnUid] = useState(null);
  const [warnReason, setWarnReason] = useState('');
  const [actionBusy, setActionBusy] = useState(null);
  const [confirmBan, setConfirmBan] = useState(null);
  const [notesTarget, setNotesTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const q = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      const data = await apiJson(`/api/moderation/users${q}`);
      setUsers(data.users || []);
    } catch (e) {
      setErr(e.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function doWarn() {
    if (!warnUid) return;
    setActionBusy(warnUid);
    try {
      await apiJson(`/api/moderation/users/${warnUid}/warn`, {
        method: 'POST',
        body: { reason: warnReason },
      });
      setWarnUid(null);
      setWarnReason('');
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionBusy(null);
    }
  }

  async function doMute(uid, minutes) {
    setActionBusy(uid);
    try {
      await apiJson(`/api/moderation/users/${uid}/mute`, { method: 'POST', body: { minutes } });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionBusy(null);
    }
  }

  async function doUnmute(uid) {
    setActionBusy(uid);
    try {
      await apiJson(`/api/moderation/users/${uid}/unmute`, { method: 'POST' });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionBusy(null);
    }
  }

  async function doRestrict(uid, restricted) {
    setActionBusy(uid);
    try {
      await apiJson(`/api/moderation/users/${uid}/restrict`, {
        method: 'POST',
        body: { restricted, note: restricted ? 'Chat restricted by moderator' : '' },
      });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionBusy(null);
    }
  }

  async function doBan(uid) {
    setActionBusy(uid);
    try {
      await apiJson(`/api/moderation/users/${uid}/ban`, { method: 'POST' });
      setConfirmBan(null);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionBusy(null);
    }
  }

  async function doUnban(uid) {
    setActionBusy(uid);
    try {
      await apiJson(`/api/moderation/users/${uid}/unban`, { method: 'POST' });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setActionBusy(null);
    }
  }

  const canBan = hasPermission('ban_users');

  const ownerLockedHint = 'Protected Owner account \u2014 only the site owner can moderate this user.';

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Users size={20} />
        <div>
          <h3>User moderation</h3>
          <p>Search, warn, mute, restrict{canBan ? ', ban' : ''}</p>
        </div>
      </div>
      {err && <p className="admin-error-banner">{err}</p>}
      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {notesTarget && (
        <ModUserNotesPanel
          uid={notesTarget.uid}
          displayUsername={notesTarget.username}
          onClose={() => setNotesTarget(null)}
        />
      )}

      {warnUid && (
        <div className="mod-modal glass-card">
          <h4>Warn user</h4>
          <textarea
            value={warnReason}
            onChange={(e) => setWarnReason(e.target.value)}
            placeholder="Reason (visible in history)"
            rows={3}
            className="mod-modal-textarea"
          />
          <div className="mod-modal-actions">
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setWarnUid(null)}>Cancel</button>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={doWarn} disabled={actionBusy}>
              Send warning
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : (
        <div className="admin-table-wrap mod-users-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Flags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const ownerLocked = modTargetOwnerLocked(u, actorHasProtectOwner);
                const isOwnerTier = u.role === OWNER_ROLE_KEY || u.rolePrivilegeTier === 'owner';
                return (
                <tr key={u.uid} className={ownerLocked ? 'mod-user-row-owner' : ''}>
                  <td>
                    <div className="admin-user-cell">
                      <span>{u.username || u.uid}</span>
                      {isOwnerTier && (
                        <span className="admin-badge-owner" title="Protected Owner-tier account">Owner</span>
                      )}
                      {u.banned && <span className="admin-badge admin-badge-ban">Banned</span>}
                    </div>
                    <span className="admin-muted admin-email-sub">{u.email}</span>
                  </td>
                  <td>{u.role || 'user'}</td>
                  <td className="admin-muted">
                    W:{u.warnings?.length || 0}
                    {u.mutedUntil ? ' · Muted' : ''}
                    {u.chatRestricted ? ' · Restricted' : ''}
                  </td>
                  <td>
                    <div className="mod-action-row">
                      {ownerLocked && (
                        <span className="mod-owner-lock-hint" title={ownerLockedHint}>Protected</span>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-xs"
                        disabled={!!actionBusy || ownerLocked}
                        title={ownerLocked ? ownerLockedHint : 'Staff notes'}
                        onClick={() => setNotesTarget({ uid: u.uid, username: u.username || u.uid })}
                      >
                        <StickyNote size={12} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-xs"
                        disabled={!!actionBusy || u.banned || ownerLocked}
                        title={ownerLocked ? ownerLockedHint : undefined}
                        onClick={() => setWarnUid(u.uid)}
                      >
                        Warn
                      </button>
                      <select
                        className="mod-mute-select"
                        disabled={!!actionBusy || u.banned || ownerLocked}
                        title={ownerLocked ? ownerLockedHint : undefined}
                        defaultValue=""
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          e.target.value = '';
                          if (m) doMute(u.uid, m);
                        }}
                      >
                        <option value="">Mute…</option>
                        <option value="15">15 min</option>
                        <option value="60">1 h</option>
                        <option value="360">6 h</option>
                        <option value="1440">24 h</option>
                        <option value="10080">7 d</option>
                      </select>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-xs"
                        disabled={!!actionBusy || ownerLocked}
                        title={ownerLocked ? ownerLockedHint : 'Unmute'}
                        onClick={() => doUnmute(u.uid)}
                      >
                        <Mic size={12} />
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost admin-btn-xs"
                        disabled={!!actionBusy || u.banned || ownerLocked}
                        title={ownerLocked ? ownerLockedHint : (u.chatRestricted ? 'Lift restriction' : 'Restrict chat')}
                        onClick={() => doRestrict(u.uid, !u.chatRestricted)}
                      >
                        {u.chatRestricted ? <Unlock size={12} /> : <Lock size={12} />}
                      </button>
                      {canBan && !u.banned && (
                        confirmBan === u.uid ? (
                          <>
                            <span className="admin-confirm-text">Ban?</span>
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger admin-btn-xs"
                              disabled={ownerLocked}
                              onClick={() => doBan(u.uid)}
                            >
                              Yes
                            </button>
                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setConfirmBan(null)}>No</button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger admin-btn-xs"
                            disabled={!!actionBusy || ownerLocked}
                            title={ownerLocked ? ownerLockedHint : undefined}
                            onClick={() => setConfirmBan(u.uid)}
                          >
                            <Ban size={12} />
                          </button>
                        )
                      )}
                      {canBan && u.banned && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-success admin-btn-xs"
                          disabled={!!actionBusy || ownerLocked}
                          title={ownerLocked ? ownerLockedHint : undefined}
                          onClick={() => doUnban(u.uid)}
                        >
                          Unban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={4} className="admin-empty">No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
