import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Search, Loader2, AlertTriangle, Crown,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../utils/AuthContext';
import { apiJson, fetchAdminUsersPage } from '../../services/apiClient';
import { TIER_LABELS } from '../../utils/permissions';
import { roleTierFromDefinition } from '../../lib/rbacClient';
import CustomRoleCreator from './CustomRoleCreator';
import CustomRolesList from './CustomRolesList';
import {
  ROLE_ICONS, roleColor, resolveRoleDef,
  isRoleAssignDisabled, buildRoleChangeWarnings,
} from './adminHelpers';

export default function RoleManagement() {
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
                const RIcon = ROLE_ICONS[u.role] || ROLE_ICONS.user;
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
