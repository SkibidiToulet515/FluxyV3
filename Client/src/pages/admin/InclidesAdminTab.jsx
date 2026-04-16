import { useState, useEffect, useCallback } from 'react';
import { Loader2, Sparkles, Users, ScrollText } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import UsernameAutocomplete from '../../components/ui/UsernameAutocomplete';
import './InclidesAdminTab.css';

export default function InclidesAdminTab() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [tx, setTx] = useState([]);
  const [grantUsername, setGrantUsername] = useState('');
  const [grantAmt, setGrantAmt] = useState('100');
  const [grantNote, setGrantNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const [c, lb, t] = await Promise.all([
        apiJson('/api/inclides/admin/config'),
        apiJson('/api/inclides/admin/leaderboard?limit=40'),
        apiJson('/api/inclides/admin/transactions-recent?limit=60'),
      ]);
      setConfig(c.config || {});
      setLeaderboard(lb.leaderboard || []);
      setTx(t.transactions || []);
    } catch (e) {
      setMsg(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfig(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await apiJson('/api/inclides/admin/config', {
        method: 'PATCH',
        body: {
          baseReward: Number(config.baseReward),
          midTierStreakMin: Number(config.midTierStreakMin),
          midTierStreakMax: Number(config.midTierStreakMax),
          midTierMult: Number(config.midTierMult),
          highTierStreakMin: Number(config.highTierStreakMin),
          highTierMult: Number(config.highTierMult),
          highTierBonus: Number(config.highTierBonus),
        },
      });
      setMsg('Reward settings saved.');
      await load();
    } catch (err) {
      setMsg(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function doGrant(e) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await apiJson('/api/inclides/admin/grant', {
        method: 'POST',
        body: {
          targetUsername: grantUsername.trim(),
          amount: parseInt(grantAmt, 10),
          note: grantNote.trim(),
        },
      });
      setMsg('Grant applied.');
      setGrantUsername('');
      setGrantNote('');
      await load();
    } catch (err) {
      setMsg(err.message || 'Grant failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !config) {
    return (
      <section className="admin-section glass-card">
        <Loader2 className="spin" size={20} /> Loading Inclides…
      </section>
    );
  }

  return (
    <div className="inclides-admin animate-fade-in">
      {msg ? <p className="inclides-admin-msg">{msg}</p> : null}

      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <Sparkles size={20} />
          <div>
            <h3>Daily reward tuning</h3>
            <p>Base amount and streak tiers (server-enforced).</p>
          </div>
        </div>
        <form className="inclides-admin-form" onSubmit={saveConfig}>
          <label>
            Base (streak days 1–3)
            <input
              type="number"
              min={1}
              value={config?.baseReward ?? 50}
              onChange={(e) => setConfig((c) => ({ ...c, baseReward: e.target.value }))}
            />
          </label>
          <label>
            Mid tier streak min–max (days)
            <div className="inclides-admin-row">
              <input
                type="number"
                min={1}
                value={config?.midTierStreakMin ?? 4}
                onChange={(e) => setConfig((c) => ({ ...c, midTierStreakMin: e.target.value }))}
              />
              <input
                type="number"
                min={1}
                value={config?.midTierStreakMax ?? 7}
                onChange={(e) => setConfig((c) => ({ ...c, midTierStreakMax: e.target.value }))}
              />
            </div>
          </label>
          <label>
            Mid tier multiplier
            <input
              type="number"
              step="0.05"
              min={1}
              value={config?.midTierMult ?? 1.2}
              onChange={(e) => setConfig((c) => ({ ...c, midTierMult: e.target.value }))}
            />
          </label>
          <label>
            High tier from day
            <input
              type="number"
              min={1}
              value={config?.highTierStreakMin ?? 8}
              onChange={(e) => setConfig((c) => ({ ...c, highTierStreakMin: e.target.value }))}
            />
          </label>
          <label>
            High tier multiplier + bonus
            <div className="inclides-admin-row">
              <input
                type="number"
                step="0.05"
                min={1}
                value={config?.highTierMult ?? 1.5}
                onChange={(e) => setConfig((c) => ({ ...c, highTierMult: e.target.value }))}
              />
              <input
                type="number"
                min={0}
                value={config?.highTierBonus ?? 25}
                onChange={(e) => setConfig((c) => ({ ...c, highTierBonus: e.target.value }))}
              />
            </div>
          </label>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save reward settings'}
          </button>
        </form>
      </section>

      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <Users size={20} />
          <div>
            <h3>Grant or remove Inclides</h3>
            <p>Search by username. Negative amount removes (won&apos;t go below zero).</p>
          </div>
        </div>
        <form className="inclides-admin-form inclides-admin-grant" onSubmit={doGrant}>
          <UsernameAutocomplete
            value={grantUsername}
            onChange={setGrantUsername}
            placeholder="Username"
          />
          <input
            type="number"
            placeholder="Amount (+ / −)"
            value={grantAmt}
            onChange={(e) => setGrantAmt(e.target.value)}
            required
          />
          <input
            placeholder="Note (optional)"
            value={grantNote}
            onChange={(e) => setGrantNote(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={saving}>
            Apply
          </button>
        </form>
      </section>

      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <Users size={20} />
          <div>
            <h3>Top balances</h3>
            <p>Users with the most Inclides on record.</p>
          </div>
        </div>
        <ul className="inclides-admin-lb">
          {leaderboard.map((row, i) => (
            <li key={row.uid}>
              <span className="inclides-admin-lb-rank">{i + 1}</span>
              <span className="inclides-admin-lb-name">{row.username}</span>
              <span className="inclides-admin-lb-val">{row.inclidesBalance?.toLocaleString?.() ?? row.inclidesBalance} Inclides</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <ScrollText size={20} />
          <div>
            <h3>Recent Inclides activity</h3>
            <p>Latest earn and spend events across the platform.</p>
          </div>
        </div>
        <div className="inclides-admin-tx-wrap">
          <table className="admin-table inclides-admin-tx">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Source</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((r) => (
                <tr key={`${r.uid}-${r.id}`}>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</td>
                  <td>{r.username}</td>
                  <td>{r.source}</td>
                  <td className={r.amountSigned >= 0 ? 'tx-earn' : 'tx-spend'}>
                    {r.amountSigned >= 0 ? '+' : ''}
                    {r.amountSigned} Inclides
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
