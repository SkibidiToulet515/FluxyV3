import { useState, useEffect } from 'react';
import { LayoutGrid, Loader2, Save } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import './HomepageCmsTab.css';

const SECTIONS = [
  { id: 'continue', label: 'Continue playing' },
  { id: 'featured', label: 'Featured' },
  { id: 'trending', label: 'Trending' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'new', label: 'New' },
];

export default function HomepageCmsTab() {
  const [config, setConfig] = useState(null);
  const [featuredIds, setFeaturedIds] = useState('');
  const [hidden, setHidden] = useState([]);
  const [order, setOrder] = useState(SECTIONS.map((s) => s.id));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson('/api/cms/homepage');
        if (cancelled) return;
        const c = data.config || {};
        setConfig(c);
        setFeaturedIds((c.featuredIds || []).join(', '));
        setHidden(c.hiddenSections || []);
        if (Array.isArray(c.sectionOrder) && c.sectionOrder.length) {
          setOrder(c.sectionOrder.filter((id) => id !== 'recent'));
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const featuredIdsArr = featuredIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiJson('/api/cms/homepage', {
        method: 'PATCH',
        body: {
          featuredIds: featuredIdsArr,
          sectionOrder: order,
          hiddenSections: hidden,
        },
      });
      setMsg('Saved.');
    } catch (e) {
      setMsg(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function toggleHidden(id) {
    setHidden((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function move(idx, dir) {
    const next = [...order];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
  }

  if (loading) {
    return (
      <section className="admin-section glass-card">
        <Loader2 className="spin" size={20} /> Loading CMS…
      </section>
    );
  }

  return (
    <div className="animate-fade-in">
      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <LayoutGrid size={20} />
          <div>
            <h3>Homepage</h3>
            <p>Feature IDs and section visibility — consumed by the home page when the API is available</p>
          </div>
        </div>
        <label className="cms-label">
          Featured game IDs (comma-separated)
          <textarea
            className="cms-textarea"
            rows={3}
            value={featuredIds}
            onChange={(e) => setFeaturedIds(e.target.value)}
            placeholder="e.g. clgame1, clgame2"
          />
        </label>
        <p className="analytics-muted" style={{ marginTop: 8 }}>
          Section order &amp; hidden flags:
        </p>
        <ul className="cms-order-list">
          {order.map((id, idx) => {
            const meta = SECTIONS.find((s) => s.id === id) || { label: id };
            return (
              <li key={id} className="cms-order-item">
                <span>{meta.label}</span>
                <div className="cms-order-actions">
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => move(idx, -1)}>
                    Up
                  </button>
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => move(idx, 1)}>
                    Down
                  </button>
                  <label className="cms-hide">
                    <input
                      type="checkbox"
                      checked={hidden.includes(id)}
                      onChange={() => toggleHidden(id)}
                    />
                    Hide
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save homepage'}
        </button>
        {msg ? <p className="cms-msg">{msg}</p> : null}
      </section>
    </div>
  );
}
