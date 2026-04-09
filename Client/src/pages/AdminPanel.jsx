import { useState, useEffect, useCallback } from 'react';
import { useOutletContext, Navigate } from 'react-router-dom';
import {
  Users, Gamepad2, Shield, Search, Trash2, Edit3, Plus,
  Ban, ShieldCheck, ShieldAlert, UserCheck, Loader2, X, Check,
  Eye, EyeOff, Star, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import {
  getAllUsers, setUserRole, banUser, unbanUser,
  getAllGameDocs, createGameDoc, updateGameDoc, deleteGameDoc,
} from '../services/firestore';
import Header from '../components/Header';
import './AdminPanel.css';

const ROLE_OPTIONS = ['user', 'mod', 'admin'];
const ROLE_COLORS = { admin: '#ef4444', mod: '#f59e0b', user: '#6366f1' };
const ROLE_ICONS = { admin: ShieldAlert, mod: ShieldCheck, user: UserCheck };
const CATEGORIES = [
  'Uncategorized', 'Action', 'Adventure', 'Puzzle', 'Racing',
  'Sports', 'Strategy', 'Arcade', 'Shooting', 'Simulation', 'RPG', 'Other',
];

export default function AdminPanel() {
  const { onMenuToggle } = useOutletContext();
  const { isAdmin, isMod, loading } = useAuth();
  const [tab, setTab] = useState('users');

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

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
      </div>

      {tab === 'users' && <UserManagement />}
      {tab === 'games' && <GameManagement />}
      {tab === 'roles' && <RoleManagement />}
    </div>
  );
}

// ─── User Management ──────────────────────────────────────────────────────────

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleBan(uid, banned) {
    if (banned) await unbanUser(uid);
    else await banUser(uid);
    setConfirm(null);
    load();
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
          <p>{users.length} registered users</p>
        </div>
      </div>

      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading users...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const RIcon = ROLE_ICONS[u.role] || UserCheck;
                return (
                  <tr key={u.uid} className={u.banned ? 'banned-row' : ''}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar" style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}>
                          {(u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <span>{u.username || 'Unknown'}</span>
                        {u.banned && <span className="admin-badge admin-badge-ban">Banned</span>}
                      </div>
                    </td>
                    <td className="admin-muted">{u.email}</td>
                    <td>
                      <span className="admin-role-pill" style={{ color: ROLE_COLORS[u.role] }}>
                        <RIcon size={12} /> {u.role || 'user'}
                      </span>
                    </td>
                    <td><span className={`admin-status admin-status-${u.status || 'offline'}`}>{u.status || 'offline'}</span></td>
                    <td>
                      {confirm === u.uid ? (
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
      )}
    </section>
  );
}

// ─── Game Management ──────────────────────────────────────────────────────────

function GameManagement() {
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
    g.category?.toLowerCase().includes(search.toLowerCase())
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
          onSave={async (data) => { await createGameDoc(data); setCreating(false); load(); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {editing && (
        <GameForm
          initial={editing}
          onSave={async (data) => { await updateGameDoc(editing.id, data); setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading games...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Category</th><th>Plays</th><th>Visible</th><th>Actions</th></tr>
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
                <tr><td colSpan={5} className="admin-empty">No games found</td></tr>
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
  const [description, setDescription] = useState(initial?.description || '');
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [featured, setFeatured] = useState(initial?.featured || false);
  const [visible, setVisible] = useState(initial?.visible !== false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), category, description: description.trim(), thumbnail: thumbnail.trim(), url: url.trim(), featured, visible });
    setSaving(false);
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
        <label className="span-2">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={2} />
        </label>
        <label>
          <span>Thumbnail URL</span>
          <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://..." />
        </label>
        <label>
          <span>Game URL / Path</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/games/MyGame.html" />
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
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !title.trim()}>
          {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {initial ? 'Save Changes' : 'Create Game'}
        </button>
      </div>
    </form>
  );
}

// ─── Role Management ──────────────────────────────────────────────────────────

function RoleManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleConfirm, setRoleConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRoleChange(uid, newRole) {
    await setUserRole(uid, newRole);
    setRoleConfirm(null);
    load();
  }

  const filtered = users.filter((u) =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    admin: users.filter((u) => u.role === 'admin').length,
    mod: users.filter((u) => u.role === 'mod').length,
    user: users.filter((u) => !u.role || u.role === 'user').length,
  };

  return (
    <section className="admin-section glass-card">
      <div className="admin-section-header">
        <Shield size={20} />
        <div>
          <h3>Role Management</h3>
          <p>Assign permissions to users</p>
        </div>
      </div>

      <div className="admin-role-stats">
        {ROLE_OPTIONS.map((r) => (
          <div key={r} className="admin-role-stat" style={{ borderColor: ROLE_COLORS[r] }}>
            <span className="admin-role-stat-count">{stats[r] || 0}</span>
            <span className="admin-role-stat-label">{r}s</span>
          </div>
        ))}
      </div>

      <div className="admin-search">
        <Search size={14} />
        <input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="admin-loading"><Loader2 size={20} className="spin" /> Loading...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>User</th><th>Current Role</th><th>Change Role</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const RIcon = ROLE_ICONS[u.role] || UserCheck;
                return (
                  <tr key={u.uid}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar" style={{ background: ROLE_COLORS[u.role] || '#6366f1' }}>
                          {(u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{u.username || 'Unknown'}</span>
                          <span className="admin-muted admin-email-sub">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="admin-role-pill" style={{ color: ROLE_COLORS[u.role] }}>
                        <RIcon size={12} /> {u.role || 'user'}
                      </span>
                    </td>
                    <td>
                      {roleConfirm?.uid === u.uid ? (
                        <div className="admin-confirm-row">
                          <AlertTriangle size={13} className="admin-warn-icon" />
                          <span className="admin-confirm-text">Set to <strong>{roleConfirm.role}</strong>?</span>
                          <button className="admin-btn admin-btn-primary admin-btn-xs" onClick={() => handleRoleChange(u.uid, roleConfirm.role)}>Confirm</button>
                          <button className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => setRoleConfirm(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="admin-role-btns">
                          {ROLE_OPTIONS.map((r) => (
                            <button
                              key={r}
                              className={`admin-btn admin-btn-xs ${u.role === r ? 'admin-btn-active' : 'admin-btn-ghost'}`}
                              style={u.role === r ? { color: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] } : {}}
                              disabled={u.role === r}
                              onClick={() => setRoleConfirm({ uid: u.uid, role: r })}
                            >
                              {r}
                            </button>
                          ))}
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
      )}
    </section>
  );
}
