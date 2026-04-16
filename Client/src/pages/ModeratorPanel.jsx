import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Flag, ScrollText, Shield, Gamepad2,
  Search, Loader2, Check, Ban, Mic, Lock, Unlock, Gavel, StickyNote,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { apiJson } from '../services/apiClient';
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../utils/permissions';
import { OWNER_ROLE_KEY } from '../lib/rbacClient';
import Header from '../components/Header';
import { GameManagement } from './AdminPanel';
import AppealsStaffPanel from '../components/appeals/AppealsStaffPanel';
import './ModeratorPanel.css';

function formatTime(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

export default function ModeratorPanel() {
  const { onMenuToggle } = useOutletContext();
  const { hasPermission, loading } = useAuth();
  const [tab, setTab] = useState('overview');

  if (loading) return null;
  if (!hasPermission('access_moderator_panel')) {
    return <Navigate to="/" replace />;
  }

  const showGames = hasPermission('manage_games');

  return (
    <div className="mod-page animate-fade-in">
      <Header title="Moderator Panel" onMenuClick={onMenuToggle} />

      <div className="mod-tabs admin-tabs">
        <button type="button" className={`admin-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
          <LayoutDashboard size={16} /> Overview
        </button>
        <button type="button" className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Users size={16} /> Users
        </button>
        <button type="button" className={`admin-tab ${tab === 'appeals' ? 'active' : ''}`} onClick={() => setTab('appeals')}>
          <Gavel size={16} /> Appeals
        </button>
        <button type="button" className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          <Flag size={16} /> Reports
        </button>
        <button type="button" className={`admin-tab ${tab === 'logs' ? 'active' : ''}`} onClick={() => setTab('logs')}>
          <ScrollText size={16} /> Logs
        </button>
        <button type="button" className={`admin-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          <Shield size={16} /> Roles
        </button>
        {showGames && (
          <button type="button" className={`admin-tab ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
            <Gamepad2 size={16} /> Games
          </button>
        )}
      </div>

      {tab === 'overview' && <ModOverview />}
      {tab === 'users' && <ModUsers />}
      {tab === 'appeals' && <AppealsStaffPanel />}
      {tab === 'reports' && <ModReports />}
      {tab === 'logs' && <ModLogs />}
      {tab === 'roles' && <ModRolesInfo />}
      {tab === 'games' && showGames && <GameManagement />}
    </div>
  );
}

function ModOverview() {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [u, r] = await Promise.all([
          apiJson('/api/moderation/users'),
          apiJson('/api/moderation/reports?status=open'),
        ]);
        if (!cancelled) {
          setUsers(u.users || []);
          setReports(r.reports || []);
        }
      } catch {
        if (!cancelled) {
          setUsers([]);
          setReports([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const warned = users.filter((u) => Array.isArray(u.warnings) && u.warnings.length > 0).length;
  const muted = users.filter((u) => u.mutedUntil).length;
  const restricted = users.filter((u) => u.chatRestricted).length;

  return (
    <section className="admin-section glass-card mod-overview">
      <div className="admin-section-header">
        <LayoutDashboard size={20} />
        <div>
          <h3>Overview</h3>
          <p>Moderation snapshot</p>
        </div>
      </div>
      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : (
        <div className="mod-stat-grid">
          <div className="mod-stat-card">
            <span className="mod-stat-value">{users.length}</span>
            <span className="mod-stat-label">Users (loaded)</span>
          </div>
          <div className="mod-stat-card mod-stat-warn">
            <span className="mod-stat-value">{warned}</span>
            <span className="mod-stat-label">With warnings</span>
          </div>
          <div className="mod-stat-card mod-stat-mute">
            <span className="mod-stat-value">{muted}</span>
            <span className="mod-stat-label">Muted flag set</span>
          </div>
          <div className="mod-stat-card mod-stat-restrict">
            <span className="mod-stat-value">{restricted}</span>
            <span className="mod-stat-label">Chat restricted</span>
          </div>
          <div className="mod-stat-card mod-stat-flag">
            <span className="mod-stat-value">{reports.length}</span>
            <span className="mod-stat-label">Open reports</span>
          </div>
        </div>
      )}
    </section>
  );
}

function modTargetOwnerLocked(u, actorHasProtectOwner) {
  if (actorHasProtectOwner) return false;
  if (u.role === OWNER_ROLE_KEY) return true;
  return u.rolePrivilegeTier === 'owner';
}

function ModUserNotesPanel({ uid, onClose }) {
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
        User ID <code className="mod-notes-uid">{uid}</code>
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

function ModUsers() {
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
  const [notesUid, setNotesUid] = useState(null);

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

  const ownerLockedHint = 'Protected Owner account — only the site owner can moderate this user.';

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

      {notesUid && (
        <ModUserNotesPanel uid={notesUid} onClose={() => setNotesUid(null)} />
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
                        onClick={() => setNotesUid(u.uid)}
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

function ModReports() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson(`/api/moderation/reports?status=${encodeURIComponent(filter)}`);
      setReports(data.reports || []);
      setErr('');
    } catch (e) {
      setErr(e.message || 'Failed');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id, status) {
    try {
      await apiJson(`/api/moderation/reports/${id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Flag size={20} />
        <div>
          <h3>Reports</h3>
          <p>User-submitted issues</p>
        </div>
      </div>
      {err && <p className="admin-error-banner">{err}</p>}
      <div className="mod-filter-row">
        {['open', 'reviewing', 'closed', 'all'].map((f) => (
          <button
            key={f}
            type="button"
            className={`admin-btn admin-btn-xs ${filter === f ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Reporter</th><th>Target</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="admin-muted">{r.reporterUid?.slice(0, 8)}…</td>
                  <td className="admin-muted">{r.targetUsername || r.targetUid || '—'}</td>
                  <td>{r.reason}</td>
                  <td><span className="admin-category-pill">{r.status}</span></td>
                  <td>
                    <div className="mod-action-row">
                      {r.status === 'open' && (
                        <button type="button" className="admin-btn admin-btn-xs admin-btn-ghost" onClick={() => setStatus(r.id, 'reviewing')}>Review</button>
                      )}
                      {r.status !== 'closed' && (
                        <button type="button" className="admin-btn admin-btn-xs admin-btn-primary" onClick={() => setStatus(r.id, 'closed')}>
                          <Check size={12} /> Close
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr><td colSpan={5} className="admin-empty">No reports</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ModLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson('/api/moderation/logs?limit=100');
        if (!cancelled) setLogs(data.logs || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <ScrollText size={20} />
        <div>
          <h3>Moderation log</h3>
          <p>Recent actions (server-recorded)</p>
        </div>
      </div>
      {err && <p className="admin-error-banner">{err}</p>}
      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading…</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table mod-logs-table">
            <thead>
              <tr><th>When</th><th>Action</th><th>Actor</th><th>Target</th><th>Details</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="admin-muted">{formatTime(log.createdAt)}</td>
                  <td><span className="admin-category-pill">{log.action}</span></td>
                  <td className="admin-muted">{log.actorUid?.slice(0, 8)}…</td>
                  <td className="admin-muted">{log.targetUid?.slice(0, 8) || '—'}…</td>
                  <td className="admin-muted mod-log-details">{JSON.stringify(log.details || {})}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="admin-empty">No entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ModRolesInfo() {
  const { roleDefinition, hasPermission } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson('/api/roles');
        if (!cancelled) setRoles(data.roles || []);
      } catch {
        if (!cancelled) setRoles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Shield size={20} />
        <div>
          <h3>Roles &amp; permissions</h3>
          <p>Your effective role and all definitions</p>
        </div>
      </div>

      <div className="mod-your-role glass-card">
        <h4>Your role</h4>
        <p><strong>{roleDefinition?.displayName || roleDefinition?.key || '—'}</strong></p>
        <ul className="mod-perm-list">
          {PERMISSION_KEYS.map((p) => (
            <li key={p} className={hasPermission(p) ? 'mod-perm-on' : 'mod-perm-off'}>
              {hasPermission(p) ? '✓' : '·'} {PERMISSION_LABELS[p] || p}
            </li>
          ))}
        </ul>
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading definitions…</div>
      ) : (
        <div className="mod-roles-grid">
          {roles.map((r) => (
            <div
              key={r.key}
              className={`mod-role-card glass-card${r.protected || r.key === OWNER_ROLE_KEY ? ' mod-role-card-protected' : ''}`}
            >
              <h4>
                {r.displayName || r.key}
                {(r.protected || r.key === OWNER_ROLE_KEY) && (
                  <span className="admin-badge-owner" title="System / protected role">Protected</span>
                )}
              </h4>
              <span className="admin-muted">
                {r.key}{r.system ? ' · system' : ''}
                {r.privilegeTier ? ` · ${r.privilegeTier}` : ''}
              </span>
              <ul className="mod-perm-list compact">
                {PERMISSION_KEYS.filter((p) => r.permissions?.[p]).map((p) => (
                  <li key={p}>{PERMISSION_LABELS[p] || p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
