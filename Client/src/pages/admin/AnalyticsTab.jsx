import { useState, useEffect } from 'react';
import { BarChart3, Loader2, TrendingUp, Users } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import './AnalyticsTab.css';

export default function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const d = await apiJson('/api/analytics/dashboard');
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="admin-section glass-card">
        <div className="admin-loading">
          <Loader2 size={20} className="spin" /> Loading analytics…
        </div>
      </section>
    );
  }

  if (err) {
    return (
      <section className="admin-section glass-card">
        <p className="admin-error-banner">{err}</p>
      </section>
    );
  }

  const daily = data?.dailyActivity || [];
  const top = data?.topGames || [];

  return (
    <div className="analytics-tab animate-fade-in">
      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <BarChart3 size={20} />
          <div>
            <h3>Analytics</h3>
            <p>Usage from server-tracked plays, sessions, and Firestore aggregates</p>
          </div>
        </div>
        <div className="analytics-kpis">
          <div className="analytics-kpi glass-card">
            <Users size={18} />
            <strong>{data?.userCount ?? '—'}</strong>
            <span>Registered users</span>
          </div>
          <div className="analytics-kpi glass-card">
            <TrendingUp size={18} />
            <strong>{data?.reviews?.totalReviews ?? 0}</strong>
            <span>Review submissions (games)</span>
          </div>
          <div className="analytics-kpi glass-card">
            <BarChart3 size={18} />
            <strong>
              {data?.reviews?.avgRatingAcrossGames != null
                ? data.reviews.avgRatingAcrossGames.toFixed(2)
                : '—'}
            </strong>
            <span>Avg rating (per-game mean)</span>
          </div>
        </div>
      </section>

      <section className="admin-section glass-card">
        <h4 className="analytics-subhead">Daily activity (last {daily.length} days)</h4>
        <div className="analytics-daily">
          {daily.length === 0 ? (
            <p className="analytics-muted">No daily aggregates yet — activity will appear after users play with the API online.</p>
          ) : (
            <div className="analytics-daily-grid">
              {daily.map((row) => (
                <div key={row.date} className="analytics-daily-cell">
                  <span className="analytics-daily-date">{row.date}</span>
                  <span className="analytics-daily-val">{row.gamePlays || 0} plays</span>
                  <span className="analytics-daily-sub">{row.sessions || 0} sessions</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="admin-section glass-card">
        <h4 className="analytics-subhead">Most played (Firestore)</h4>
        {top.length === 0 ? (
          <p className="analytics-muted">No play counts yet.</p>
        ) : (
          <ol className="analytics-top-list">
            {top.map((g, i) => (
              <li key={g.id}>
                <span className="analytics-rank">{i + 1}</span>
                <span className="analytics-name">{g.name}</span>
                <span className="analytics-plays">{g.plays?.toLocaleString?.() || g.plays} plays</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
