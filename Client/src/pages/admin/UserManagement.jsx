import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Ban, Loader2 } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { apiJson, fetchAdminUsersPage } from '../../services/apiClient';
import { OWNER_ROLE_KEY } from '../../utils/permissions';
import { ROLE_ICONS, roleColor } from './adminHelpers';

export default function UserManagement() {
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
                const RIcon = ROLE_ICONS[u.role] || ROLE_ICONS.user;
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
