import { useState, useEffect, useCallback } from 'react';
import { Flag, Loader2, Check } from 'lucide-react';
import { apiJson } from '../../services/apiClient';

export default function ModReports() {
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
                  <td className="admin-muted">{r.targetUsername || r.targetUid || '\u2014'}</td>
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
