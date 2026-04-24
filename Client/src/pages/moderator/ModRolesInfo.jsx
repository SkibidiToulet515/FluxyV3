import { useState, useEffect } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { apiJson } from '../../services/apiClient';
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../../utils/permissions';
import { OWNER_ROLE_KEY } from '../../lib/rbacClient';

export default function ModRolesInfo() {
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
        <p><strong>{roleDefinition?.displayName || roleDefinition?.key || '\u2014'}</strong></p>
        <ul className="mod-perm-list">
          {PERMISSION_KEYS.map((p) => (
            <li key={p} className={hasPermission(p) ? 'mod-perm-on' : 'mod-perm-off'}>
              {hasPermission(p) ? '\u2713' : '\u00B7'} {PERMISSION_LABELS[p] || p}
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
