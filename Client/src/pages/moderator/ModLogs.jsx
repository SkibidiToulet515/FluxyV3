import { useState, useEffect } from 'react';
import { ScrollText, Loader2 } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import formatTime from './formatTime';

export default function ModLogs() {
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
                  <td className="admin-muted">{log.targetUid?.slice(0, 8) || '\u2014'}…</td>
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
