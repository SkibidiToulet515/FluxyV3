import { useState, useEffect } from 'react';
import { LayoutDashboard, Loader2 } from 'lucide-react';
import { apiJson } from '../../services/apiClient';

export default function ModOverview() {
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
