import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import {
  Users, Gamepad2, Shield, Search, Trash2, Edit3, Plus,
  Ban, ShieldCheck, ShieldAlert, UserCheck, Loader2, X, Check,
  Eye, EyeOff, Star, AlertTriangle, Crown, Gift, BarChart3, LayoutGrid, Sparkles,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../utils/AuthContext';
import {
  getAllGameDocs, createGameDoc, updateGameDoc, deleteGameDoc,
} from '../services/firestore';
import { apiJson, fetchAdminUsersPage } from '../services/apiClient';
import {
  PERMISSION_KEYS, PERMISSION_LABELS, OWNER_ROLE_KEY, TIER_LABELS, BUILTIN_ROLE_KEYS,
} from '../utils/permissions';
import { roleTierFromDefinition, tierRank } from '../lib/rbacClient';
import { normalizeFirestoreGameUrlInput } from '../utils/gamePlayUrl';
import { SUBJECT_KEYS } from '../config/subjects';
import Header from '../components/Header';
import GiveawaysAdminTab from './admin/GiveawaysAdminTab';
import AnalyticsTab from './admin/AnalyticsTab';
import HomepageCmsTab from './admin/HomepageCmsTab';
import InclidesAdminTab from './admin/InclidesAdminTab';
import './AdminPanel.css';

const ROLE_ICONS = { admin: ShieldAlert, mod: ShieldCheck, user: UserCheck, owner: Crown };

function roleColor(key) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#22d3ee', '#34d399'];
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}
const CATEGORIES = [
  'Uncategorized', 'Action', 'Adventure', 'Puzzle', 'Racing',
  'Sports', 'Strategy', 'Arcade', 'Shooting', 'Simulation', 'RPG', 'Other',
];

export default function AdminPanel() {
  const { onMenuToggle } = useOutletContext();
  const { hasPermission, loading } = useAuth();
  const [tab, setTab] = useState('users');

  if (loading) return null;
  if (!hasPermission('access_admin_panel')) return <Navigate to="/" replace />;

  return (
    <div className="admin-page animate-fade-in">
      <Header title="Admin Panel" onMenuClick={onMenuToggle} />

      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          <Users size={16} /> Users
        </button>
        <button className={`admin-tab ${tab === 'games' ? 'active' : ''}`} onClick={() => setTab('games')}>
          <Gamepad2 size={16} /> Games
        </button>
        <button className={`admin-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>
          <Shield size={16} /> Roles
        </button>
        <button className={`admin-tab ${tab === 'giveaways' ? 'active' : ''}`} onClick={() => setTab('giveaways')}>
          <Gift size={16} /> Giveaways
        </button>
        <button className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`} onClick={() => setTab('analytics')}>
          <BarChart3 size={16} /> Analytics
        </button>
        <button className={`admin-tab ${tab === 'cms' ? 'active' : ''}`} onClick={() => setTab('cms')}>
          <LayoutGrid size={16} /> Homepage
        </button>
        <button className={`admin-tab ${tab === 'inclides' ? 'active' : ''}`} onClick={() => setTab('inclides')}>
          <Sparkles size={16} /> Inclides
        </button>
      </div>

      {tab === 'users' && <UserManagement />}
      {tab === 'games' && <GameManagement />}
      {tab === 'roles' && <RoleManagement />}
      {tab === 'giveaways' && <GiveawaysAdminTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'cms' && <HomepageCmsTab />}
      {tab === 'inclides' && <InclidesAdminTab />}
    </div>
  );
}

// ─── User Management ──────────────────────────────────────────────────────────

function UserManagement() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [usersCursor, setUsersCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);
  const canBan = hasPermission('ban_users');
  const canModerateOwnerBan = hasPermission('protect_owner');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users: page, nextCursor } = await fetchAdminUsersPage({ limit: 150 });
      setUsers(page);
      setUsersCursor(nextCursor);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!usersCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { users: page, nextCursor } = await fetchAdminUsersPage({
        limit: 150,
        cursor: usersCursor,
      });
      setUsers((prev) => [...prev, ...page]);
      setUsersCursor(nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [usersCursor, loadingMore]);

  useEffect(() => { load(); }, [load]);

  async function handleBan(uid, banned) {
    try {
      if (banned) {
        await apiJson(`/api/admin/users/${uid}/unban`, { method: 'POST' });
      } else {
        await apiJson(`/api/admin/users/${uid}/ban`, { method: 'POST' });
      }
      setConfirm(null);
      load();
    } catch (e) {
      alert(e?.message || 'Action failed (check Owner protection / rules).');
    }
  }

  function banActionState(u) {
    if (!canBan) return { blocked: true, label: '—' };
    if (u.role === OWNER_ROLE_KEY && !canModerateOwnerBan) {
      return { blocked: true, label: 'Protected', title: 'Owner accounts require Owner safeguards to ban or unban' };
    }
    return { blocked: false };
  }

  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Users size={20} />
        <div>
          <h3>User Management</h3>
          <p>
            {users.length} user{users.length === 1 ? '' : 's'} loaded
            {usersCursor ? ' — more available' : ''}
          </p>
        </div>
      </div>

      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading users...</div>
      ) : (
        <>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const RIcon = ROLE_ICONS[u.role] || UserCheck;
                const banSt = banActionState(u);
                return (
                  <tr key={u.uid} className={u.banned ? 'banned-row' : ''}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar" style={{ background: roleColor(u.role) }}>
                          {(u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span>{u.username || 'Unknown'}</span>
                        {u.banned && <span className="admin-badge admin-badge-ban">Banned</span>}
                      </div>
                    </td>
                    <td className="admin-muted">{u.email}</td>
                    <td>
                      <span className="admin-role-pill" style={{ color: roleColor(u.role) }}>
                        <RIcon size={12} /> {u.role || 'user'}
                      </span>
                    </td>
                    <td><span className={`admin-status admin-status-${u.status || 'offline'}`}>{u.status || 'offline'}</span></td>
                    <td>
                      {banSt.blocked ? (
                        <span className="admin-muted" title={banSt.title}>{banSt.label}</span>
                      ) : confirm === u.uid ? (
                        <div className="admin-confirm-row">
                          <span className="admin-confirm-text">{u.banned ? 'Unban?' : 'Ban?'}</span>
                          <button className="admin-btn admin-btn-danger admin-btn-xs" onClick={() => handleBan(u.uid, u.banned)}>Yes</button>
                          <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setConfirm(null)}>No</button>
                        </div>
                      ) : (
                        <button
                          className={`admin-btn ${u.banned ? 'admin-btn-success' : 'admin-btn-danger'} admin-btn-sm`}
                          onClick={() => setConfirm(u.uid)}
                          title={u.banned ? 'Unban' : 'Ban'}
                        >
                          <Ban size={13} /> {u.banned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="admin-empty">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {usersCursor ? (
          <div className="admin-load-more">
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? <Loader2 size={14} className="spin" /> : null}
              {loadingMore ? ' Loading…' : 'Load more users'}
            </button>
          </div>
        ) : null}
        </>
      )}
    </section>
  );
}

// ─── Game Management ──────────────────────────────────────────────────────────

export function GameManagement() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllGameDocs();
    setGames(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id) {
    await deleteGameDoc(id);
    setDeleteConfirm(null);
    load();
  }

  const filtered = games.filter((g) =>
    g.title?.toLowerCase().includes(search.toLowerCase()) ||
    g.category?.toLowerCase().includes(search.toLowerCase()) ||
    (g.subject && g.subject.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Gamepad2 size={20} />
        <div>
          <h3>Game Management</h3>
          <p>{games.length} games in database</p>
        </div>
        <button className="admin-btn admin-btn-primary admin-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setCreating(true)}>
          <Plus size={14} /> Add Game
        </button>
      </div>

      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search games..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {creating && (
        <GameForm
          onSave={async (data, gameFile) => {
            await createGameDoc(data, gameFile || null);
            setCreating(false);
            load();
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <GameForm
          initial={editing}
          onSave={async (data, gameFile) => {
            await updateGameDoc(editing.id, data, gameFile || null);
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading games...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Subject</th><th>Plays</th><th>Visible</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id}>
                  <td>
                    <div className="admin-game-cell">
                      {g.thumbnail && <img src={g.thumbnail} alt="" className="admin-game-thumb" />}
                      <div>
                        <span className="admin-game-title">{g.title || g.id}</span>
                        {g.featured && <Star size={11} className="admin-featured-star" />}
                      </div>
                    </div>
                  </td>
                  <td><span className="admin-category-pill">{g.category || 'Uncategorized'}</span></td>
                  <td><span className="admin-category-pill">{g.subject || '—'}</span></td>
                  <td className="admin-muted">{g.plays ?? 0}</td>
                  <td>{g.visible !== false ? <Eye size={14} className="admin-visible" /> : <EyeOff size={14} className="admin-hidden" />}</td>
                  <td>
                    <div className="admin-actions-row">
                      <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setEditing(g)} title="Edit">
                        <Edit3 size={13} />
                      </button>
                      {deleteConfirm === g.id ? (
                        <>
                          <button className="admin-btn admin-btn-danger admin-btn-xs" onClick={() => handleDelete(g.id)}>Delete</button>
                          <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className="admin-btn admin-btn-danger admin-btn-xs" onClick={() => setDeleteConfirm(g.id)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="admin-empty">No games found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GameForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'Uncategorized');
  const [subject, setSubject] = useState(initial?.subject || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [gameFile, setGameFile] = useState(null);
  const [featured, setFeatured] = useState(initial?.featured || false);
  const [visible, setVisible] = useState(initial?.visible !== false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const urlTrim = url.trim();
    if (!initial && !urlTrim && !gameFile) return;
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          category,
          subject: subject || null,
          description: description.trim(),
          thumbnail: thumbnail.trim(),
          url: normalizeFirestoreGameUrlInput(urlTrim),
          featured,
          visible,
        },
        gameFile || undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-game-form glass-card" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <h4>{initial ? 'Edit Game' : 'Add New Game'}</h4>
        <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="admin-form-grid">
        <label>
          <span>Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Game title" required />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Auto (infer from title)</option>
            {SUBJECT_KEYS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={2} />
        </label>
        <label>
          <span>Thumbnail URL</span>
          <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://..." />
        </label>
        <label className="span-2">
          <span>Game HTML file (Firebase Storage)</span>
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => setGameFile(e.target.files?.[0] || null)}
          />
          <span className="admin-form-hint">
            Optional if you set a URL below. Mods/admins only; max ~100MB. Re-upload replaces the file in Storage.
          </span>
        </label>
        <label className="span-2">
          <span>Game URL / Path</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="games/MyGame.html or external https://…" />
          <span className="admin-form-hint">
            For UGS library games use <code>games/FileName.html</code> (not the API URL — those hit LFS stubs). Leave empty when uploading a file.
          </span>
        </label>
        <div className="admin-form-toggles">
          <label className="admin-toggle-label">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <Star size={13} /> Featured
          </label>
          <label className="admin-toggle-label">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            <Eye size={13} /> Visible
          </label>
        </div>
      </div>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={
            saving
            || !title.trim()
            || (!initial && !url.trim() && !gameFile)
          }
        >
          {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {initial ? 'Save Changes' : 'Create Game'}
        </button>
      </div>
    </form>
  );
}

// ─── Role Management ──────────────────────────────────────────────────────────

function resolveRoleDef(roleList, key) {
  return roleList.find((r) => r.key === key) || { key };
}

function isRoleAssignDisabled(targetUser, newRoleDef, roleList, hasPerm) {
  const oldDef = resolveRoleDef(roleList, targetUser.role || 'user');
  const oldTier = roleTierFromDefinition(oldDef);
  const newTier = roleTierFromDefinition(newRoleDef);
  if ((oldTier === 'owner' || newTier === 'owner') && !hasPerm('protect_owner')) return true;
  if (newRoleDef.key === OWNER_ROLE_KEY && !hasPerm('protect_owner')) return true;
  const high = tierRank(oldTier) >= 2 || tierRank(newTier) >= 2;
  if (high && !hasPerm('protect_owner')) {
    if (!hasPerm('assign_high_roles') && !hasPerm('manage_roles')) return true;
  } else if (!hasPerm('protect_owner')) {
    if (!hasPerm('assign_low_roles') && !hasPerm('manage_roles')) return true;
  }
  return false;
}

function buildRoleChangeWarnings(targetUser, newRoleDef, roleList) {
  const warnings = [];
  const oldDef = resolveRoleDef(roleList, targetUser.role || 'user');
  const oldTier = roleTierFromDefinition(oldDef);
  const newTier = roleTierFromDefinition(newRoleDef);
  if (newRoleDef.key === OWNER_ROLE_KEY) {
    warnings.push('Assigning the Owner role: only use for true platform ownership.');
  }
  if (oldTier === 'owner' || newTier === 'owner') {
    warnings.push('This change involves the Owner tier (heavily restricted).');
  }
  if (tierRank(newTier) >= 2 && tierRank(oldTier) < 2) {
    warnings.push('Promoting to a high-privilege role (admin-level access).');
  }
  if (tierRank(oldTier) >= 2 && tierRank(newTier) < 2) {
    warnings.push('Demoting from a high-privilege role.');
  }
  if (newRoleDef.protected || newRoleDef.system) {
    warnings.push('Target role is system or protected metadata.');
  }
  return warnings;
}

function RoleManagement() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [usersCursor, setUsersCursor] = useState(null);
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false);
  const [roleList, setRoleList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleConfirm, setRoleConfirm] = useState(null);
  const [roleErr, setRoleErr] = useState('');

  const loadRoles = useCallback(async () => {
    const snap = await getDocs(collection(db, 'roleDefinitions'));
    const list = snap.docs
      .map((d) => ({ key: d.id, ...d.data() }))
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.key.localeCompare(b.key));
    setRoleList(list);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users: page, nextCursor } = await fetchAdminUsersPage({ limit: 150 });
      setUsers(page);
      setUsersCursor(nextCursor);
      await loadRoles();
    } finally {
      setLoading(false);
    }
  }, [loadRoles]);

  const loadMoreUsers = useCallback(async () => {
    if (!usersCursor || loadingMoreUsers) return;
    setLoadingMoreUsers(true);
    try {
      const { users: page, nextCursor } = await fetchAdminUsersPage({
        limit: 150,
        cursor: usersCursor,
      });
      setUsers((prev) => [...prev, ...page]);
      setUsersCursor(nextCursor);
    } finally {
      setLoadingMoreUsers(false);
    }
  }, [usersCursor, loadingMoreUsers]);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(uid, newRoleKey) {
    setRoleErr('');
    try {
      await apiJson(`/api/admin/users/${uid}/role`, { method: 'POST', body: { role: newRoleKey } });
      setRoleConfirm(null);
      load();
    } catch (e) {
      setRoleErr(e?.message || e?.details?.error || 'Failed to assign role');
    }
  }

  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = roleList.reduce((acc, r) => {
    acc[r.key] = users.filter((u) => (u.role || 'user') === r.key).length;
    return acc;
  }, {});

  const canAssignAny = hasPermission('assign_low_roles')
    || hasPermission('assign_high_roles')
    || hasPermission('manage_roles')
    || hasPermission('protect_owner');
  const canCreateRoles = hasPermission('create_roles') || hasPermission('manage_roles');
  const canDeleteCustomRoles = hasPermission('delete_roles') || hasPermission('protect_owner');

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Shield size={20} />
        <div>
          <h3>Role Management</h3>
          <p>
            Assign roles via secured API — Owner and high-privilege changes are guarded server-side.
            Per-role counts below reflect loaded users only (use Load more in the table).
          </p>
        </div>
      </div>

      {roleErr && <p className="admin-error-banner">{roleErr}</p>}

      <div className="admin-role-stats">
        {roleList.map((r) => (
          <div key={r.key} className="admin-role-stat" style={{ borderColor: roleColor(r.key) }}>
            <span className="admin-role-stat-count">{stats[r.key] || 0}</span>
            <span className="admin-role-stat-label">
              {r.displayName || r.key}
              {r.protected && <span className="admin-badge admin-badge-owner" title="Protected role">Owner-prot</span>}
              {r.privilegeTier && (
                <span className="admin-tier-pill" title="Privilege tier">{TIER_LABELS[r.privilegeTier] || r.privilegeTier}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {canCreateRoles && (
        <CustomRoleCreator
          onCreated={() => { loadRoles(); load(); }}
        />
      )}

      {canDeleteCustomRoles && (
        <CustomRolesList
          roleList={roleList}
          stats={stats}
          hasProtectOwner={hasPermission('protect_owner')}
          onDeleted={() => { loadRoles(); load(); }}
        />
      )}

      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading...</div>
      ) : (
        <>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>User</th><th>Current Role</th><th>Change Role</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const RIcon = ROLE_ICONS[u.role] || UserCheck;
                const targetOwnerLocked = roleTierFromDefinition(resolveRoleDef(roleList, u.role || 'user')) === 'owner'
                  && !hasPermission('protect_owner');
                return (
                  <tr key={u.uid}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar" style={{ background: roleColor(u.role) }}>
                          {(u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{u.username || 'Unknown'}</span>
                          <span className="admin-muted admin-email-sub">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="admin-role-pill" style={{ color: roleColor(u.role) }}>
                        <RIcon size={12} /> {u.role || 'user'}
                        {targetOwnerLocked && (
                          <span className="admin-badge admin-badge-owner" title="Only Owner can change this account role">Locked</span>
                        )}
                      </span>
                    </td>
                    <td>
                      {!canAssignAny ? (
                        <span className="admin-muted">Requires assign_low_roles, assign_high_roles, or legacy manage_roles</span>
                      ) : targetOwnerLocked ? (
                        <span className="admin-muted">Owner account — use Owner session to reassign</span>
                      ) : roleConfirm?.uid === u.uid ? (
                        <div className="admin-role-confirm-block glass-card">
                          <div className="admin-confirm-row" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <AlertTriangle size={13} className="admin-warn-icon" />
                            <div>
                              <p className="admin-confirm-text">
                                Set <strong>{u.username || u.uid}</strong> to <strong>{roleConfirm.displayName}</strong> ({roleConfirm.roleKey})?
                              </p>
                              {roleConfirm.warnings?.length > 0 && (
                                <ul className="admin-warn-list">
                                  {roleConfirm.warnings.map((w) => <li key={w}>{w}</li>)}
                                </ul>
                              )}
                            </div>
                          </div>
                          <div className="admin-confirm-actions">
                            <button type="button" className="admin-btn admin-btn-primary admin-btn-xs" onClick={() => handleRoleChange(u.uid, roleConfirm.roleKey)}>Confirm change</button>
                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setRoleConfirm(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-role-btns admin-role-btns-wrap">
                          {roleList.map((r) => {
                            const disabled = u.role === r.key
                              || isRoleAssignDisabled(u, r, roleList, hasPermission);
                            return (
                              <button
                                key={r.key}
                                type="button"
                                className={`admin-btn admin-btn-xs ${u.role === r.key ? 'admin-btn-active' : 'admin-btn-ghost'}`}
                                style={u.role === r.key ? { color: roleColor(r.key), borderColor: roleColor(r.key) } : {}}
                                disabled={disabled}
                                title={r.description || r.key}
                                onClick={() => setRoleConfirm({
                                  uid: u.uid,
                                  roleKey: r.key,
                                  displayName: r.displayName || r.key,
                                  warnings: buildRoleChangeWarnings(u, r, roleList),
                                })}
                              >
                                {r.protected && <Crown size={11} style={{ marginRight: 4, opacity: 0.9 }} />}
                                {r.displayName || r.key}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="admin-empty">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {usersCursor ? (
          <div className="admin-load-more">
            <button
              type="button"
              className="admin-btn admin-btn-ghost admin-btn-sm"
              disabled={loadingMoreUsers}
              onClick={loadMoreUsers}
            >
              {loadingMoreUsers ? <Loader2 size={14} className="spin" /> : null}
              {loadingMoreUsers ? ' Loading…' : 'Load more users'}
            </button>
          </div>
        ) : null}
        </>
      )}
    </section>
  );
}

function CustomRolesList({ roleList, stats, hasProtectOwner, onDeleted }) {
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

function CustomRoleCreator({ onCreated }) {
  const [key, setKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState(() =>
    Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])),
  );
  const [grantable, setGrantable] = useState(PERMISSION_KEYS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dangerAck, setDangerAck] = useState(false);

  useEffect(() => {
    apiJson('/api/roles')
      .then((d) => setGrantable(Array.isArray(d.grantablePermissions) ? d.grantablePermissions : PERMISSION_KEYS))
      .catch(() => setGrantable(PERMISSION_KEYS));
  }, []);

  function togglePerm(p) {
    if (!grantable.includes(p)) return;
    setPerms((prev) => ({ ...prev, [p]: !prev[p] }));
  }

  const highSelected = tierRank(roleTierFromDefinition({ key: 'custom', permissions: perms })) >= 2;

  async function handleCreate(e) {
    e.preventDefault();
    setMsg('');
    if (highSelected && !dangerAck) {
      setMsg('Acknowledge high-privilege role creation below.');
      return;
    }
    setSaving(true);
    try {
      await apiJson('/api/roles', {
        method: 'POST',
        body: {
          key: key.trim().toLowerCase(),
          displayName: displayName.trim(),
          description: description.trim(),
          permissions: perms,
        },
      });
      setKey('');
      setDisplayName('');
      setDescription('');
      setPerms(Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])));
      setDangerAck(false);
      onCreated?.();
      setMsg('Role created.');
    } catch (err) {
      setMsg(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-custom-role glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
      <h4 className="admin-custom-role-title">Create custom role</h4>
      <p className="admin-form-hint" style={{ marginBottom: '0.75rem' }}>
        Permissions you cannot grant are hidden. High-privilege roles require confirmation. Server enforces limits.
      </p>
      <form className="admin-form-grid" onSubmit={handleCreate}>
        <label>
          <span>Role key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="support_staff" required />
        </label>
        <label>
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Support Staff" required />
        </label>
        <label className="span-2">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </label>
        <div className="span-2 admin-perm-grid">
          {PERMISSION_KEYS.filter((p) => grantable.includes(p)).map((p) => (
            <label key={p} className="admin-toggle-label">
              <input type="checkbox" checked={!!perms[p]} onChange={() => togglePerm(p)} />
              {PERMISSION_LABELS[p] || p}
            </label>
          ))}
        </div>
        {highSelected && (
          <label className="span-2 admin-toggle-label admin-danger-ack">
            <input type="checkbox" checked={dangerAck} onChange={(e) => setDangerAck(e.target.checked)} />
            I understand this role may include admin-level capabilities
          </label>
        )}
        {msg && <p className="span-2 admin-muted">{msg}</p>}
        <div className="span-2">
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
            Create role
          </button>
        </div>
      </form>
    </div>
  );
}
