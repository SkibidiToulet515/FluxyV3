import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  Palette, Layout, User, Circle, Check, Zap, Shield, Wifi,
  Sparkles, Paintbrush, ToggleLeft, ToggleRight, Cpu, Gift, Rows3,
  Bell, Gavel,
} from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { getLayoutMode, setLayoutMode } from '../utils/api';
import {
  getAllProviders,
  getActiveProviderId,
  setActiveProviderId,
  checkProviderHealth,
} from '../services/providers';
import { apiJson } from '../services/apiClient';
import {
  FLUXY_PERFORMANCE_KEY,
  getPerformancePreset,
  getPerformanceProfile,
  detectTierFromDevice,
  PERFORMANCE_TIER_LABELS,
  PERFORMANCE_PRESET_LABELS,
} from '../utils/performanceProfile';
import ThemeMaker from '../components/ThemeMaker';
import Header from '../components/Header';
import { setFluxyUiPreference } from '../hooks/useFluxyUiPreferences';
import BackgroundSection from './settings/BackgroundSection';
import ProfileSection from './settings/ProfileSection';
import DataSection from './settings/DataSection';
import './Settings.css';

function readUiStorage(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

const STATUSES = [
  { key: 'online', label: 'Online', color: '#34d399' },
  { key: 'idle', label: 'Idle', color: '#fbbf24' },
  { key: 'dnd', label: 'Do Not Disturb', color: '#ef4444' },
  { key: 'offline', label: 'Invisible', color: '#71717a' },
];

const PROVIDER_ICONS = { Zap, Shield };

export default function Settings() {
  const { onMenuToggle } = useOutletContext();
  const { currentTheme, setCurrentTheme, themes, saveCustomTheme } = useTheme();
  const { account, setStatus } = useAuth();
  const [layout, setLayout] = useState(getLayoutMode);
  const [showThemeMaker, setShowThemeMaker] = useState(false);

  const [activeProvider, setActiveProvider] = useState(getActiveProviderId);
  const [providerHealth, setProviderHealth] = useState({});

  const [cursorEnabled, setCursorEnabled] = useState(() => localStorage.getItem('fluxy-custom-cursor') !== 'false');
  const [clickEnabled, setClickEnabled] = useState(() => localStorage.getItem('fluxy-click-effect') !== 'false');
  const [perfPreset, setPerfPreset] = useState(() => getPerformancePreset());
  const [inbox, setInbox] = useState([]);
  const [referralInfo, setReferralInfo] = useState(null);
  const [uiDensity, setUiDensity] = useState(() => readUiStorage('fluxy-ui-density', 'comfortable'));
  const [uiMotion, setUiMotion] = useState(() => readUiStorage('fluxy-ui-motion', 'full'));

  const perfSnapshot = useMemo(() => {
    const preset = getPerformancePreset();
    const profile = getPerformanceProfile();
    const detectedTier = detectTierFromDevice();
    return {
      preset,
      effectiveTier: profile.tier,
      detectedTier,
      effectiveLabel: PERFORMANCE_TIER_LABELS[profile.tier],
      detectedLabel: PERFORMANCE_TIER_LABELS[detectedTier],
    };
  }, []);

  useEffect(() => {
    getAllProviders().forEach(async (p) => {
      const result = await checkProviderHealth(p.id);
      setProviderHealth((prev) => ({ ...prev, [p.id]: result }));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson('/api/notifications/me');
        if (!cancelled) setInbox(data.notifications || []);
      } catch {
        if (!cancelled) setInbox([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!account?.uid) return;
      try {
        const data = await apiJson('/api/referral/me');
        if (!cancelled) setReferralInfo(data);
      } catch {
        if (!cancelled) setReferralInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.uid]);

  function handleLayoutChange(mode) {
    setLayout(mode);
    setLayoutMode(mode);
    window.dispatchEvent(new Event('fluxy-layout-change'));
  }

  function handleProviderChange(id) {
    setActiveProvider(id);
    setActiveProviderId(id);
  }

  function toggleCursor() {
    const next = !cursorEnabled;
    setCursorEnabled(next);
    localStorage.setItem('fluxy-custom-cursor', String(next));
    window.dispatchEvent(new Event('fluxy-cursor-change'));
  }

  function toggleClick() {
    const next = !clickEnabled;
    setClickEnabled(next);
    localStorage.setItem('fluxy-click-effect', String(next));
    window.dispatchEvent(new Event('fluxy-click-change'));
  }

  function applyPerformancePreset(mode) {
    localStorage.setItem(FLUXY_PERFORMANCE_KEY, mode);
    setPerfPreset(mode);
    window.dispatchEvent(new Event('fluxy-perf-change'));
  }

  function handleUiDensity(next) {
    setUiDensity(next);
    setFluxyUiPreference('density', next);
  }

  function handleUiMotion(next) {
    setUiMotion(next);
    setFluxyUiPreference('motion', next);
  }

  return (
    <div className="settings-page animate-fade-in">
      <Header title="Settings" onMenuClick={onMenuToggle} />

      {/* --- Theme --- */}
      <section className="settings-section glass-card">
        <div className="settings-section-header">
          <Palette size={20} />
          <div>
            <h3>Theme</h3>
            <p>Choose your visual style</p>
          </div>
        </div>
        <div className="theme-grid">
          {Object.entries(themes).map(([key, theme]) => (
            <button
              key={key}
              className={`theme-option ${currentTheme === key ? 'active' : ''}`}
              onClick={() => setCurrentTheme(key)}
            >
              <div
                className="theme-preview"
                style={{
                  background: `linear-gradient(135deg, ${theme.vars['--bg-primary']}, ${theme.vars['--accent']})`,
                }}
              >
                {currentTheme === key && (
                  <Check size={16} className="theme-check" />
                )}
              </div>
              <span className="theme-name">{theme.name}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setShowThemeMaker(true)}>
          <Paintbrush size={16} /> Create Custom Theme
        </button>
      </section>

      {showThemeMaker && (
        <ThemeMaker
          onClose={() => setShowThemeMaker(false)}
          onSave={saveCustomTheme}
        />
      )}

      {/* --- Interface --- */}
      <section className="settings-section glass-card">
        <div className="settings-section-header">
          <Rows3 size={20} />
          <div>
            <h3>Interface</h3>
            <p>Density and motion (applies immediately)</p>
          </div>
        </div>
        <p className="settings-muted">
          Tighter layout and reduced motion work with the global design tokens in{' '}
          <code className="settings-code">design-system.css</code>.
        </p>
        <div className="settings-perf-buttons" style={{ marginBottom: '0.75rem' }}>
          <span className="settings-muted" style={{ width: '100%', marginBottom: '0.35rem' }}>Density</span>
          <button
            type="button"
            className={`btn btn-secondary ${uiDensity === 'comfortable' ? 'active' : ''}`}
            onClick={() => handleUiDensity('comfortable')}
          >
            Comfortable
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${uiDensity === 'compact' ? 'active' : ''}`}
            onClick={() => handleUiDensity('compact')}
          >
            Compact
          </button>
        </div>
        <div className="settings-perf-buttons">
          <span className="settings-muted" style={{ width: '100%', marginBottom: '0.35rem' }}>Motion</span>
          <button
            type="button"
            className={`btn btn-secondary ${uiMotion === 'full' ? 'active' : ''}`}
            onClick={() => handleUiMotion('full')}
          >
            Full
          </button>
          <button
            type="button"
            className={`btn btn-secondary ${uiMotion === 'reduced' ? 'active' : ''}`}
            onClick={() => handleUiMotion('reduced')}
          >
            Reduced
          </button>
        </div>
      </section>

      {/* --- Background --- */}
      {account && <BackgroundSection uid={account.uid} />}

      {account && (
        <section className="settings-section glass-card">
          <div className="settings-section-header">
            <Gift size={20} />
            <div>
              <h3>Referral</h3>
              <p>Your invite code and signups from onboarding</p>
            </div>
          </div>
          {referralInfo ? (
            <div className="settings-referral-block">
              <p className="settings-muted">
                <strong>Code:</strong> <code className="settings-code">{referralInfo.code}</code>
              </p>
              {referralInfo.inviteUrl ? (
                <p className="settings-muted">
                  <strong>Link:</strong>{' '}
                  <span className="settings-ellipsis">{referralInfo.inviteUrl}</span>
                </p>
              ) : null}
              <p className="settings-muted">
                People who credited you in onboarding:{' '}
                <strong>{referralInfo.referralSignups ?? 0}</strong>
              </p>
            </div>
          ) : (
            <p className="settings-muted">Loading referral info…</p>
          )}
        </section>
      )}

      {/* --- Effects --- */}
      <section className="settings-section glass-card">
        <div className="settings-section-header">
          <Sparkles size={20} />
          <div>
            <h3>Effects</h3>
            <p>Toggle visual effects</p>
          </div>
        </div>
        <div className="settings-perf-presets">
          <div className="settings-perf-presets-header">
            <Cpu size={18} />
            <div>
              <strong>Graphics performance</strong>
              <p>
                Default is <strong>Best visuals</strong>. Choose <strong>Detected</strong> to let Fluxy pick a tier
                from this device (CPU, memory, save-data, reduced-motion), or <strong>Lower graphics</strong> for
                minimum effects. The page reloads when you change this.
              </p>
            </div>
          </div>
          <div className="settings-perf-status" role="status">
            {perfSnapshot.preset === 'best' && (
              <p>
                <span className="settings-perf-badge settings-perf-badge--manual">{PERFORMANCE_PRESET_LABELS.best}</span>
                Full quality effects.{' '}
                <span className="settings-perf-hint">
                  With <strong>{PERFORMANCE_PRESET_LABELS.detected}</strong>, this device would use{' '}
                  <strong>{perfSnapshot.detectedLabel}</strong>.
                </span>
              </p>
            )}
            {perfSnapshot.preset === 'detected' && (
              <p>
                <span className="settings-perf-badge">{PERFORMANCE_PRESET_LABELS.detected}</span>
                Active profile: <strong>{perfSnapshot.effectiveLabel}</strong> — chosen from this device. Switch to{' '}
                <strong>{PERFORMANCE_PRESET_LABELS.best}</strong> or <strong>{PERFORMANCE_PRESET_LABELS.low}</strong>{' '}
                anytime.
              </p>
            )}
            {perfSnapshot.preset === 'low' && (
              <p>
                <span className="settings-perf-badge settings-perf-badge--manual">{PERFORMANCE_PRESET_LABELS.low}</span>
                Locked to <strong>{perfSnapshot.effectiveLabel}</strong>.{' '}
                <span className="settings-perf-hint">
                  With <strong>{PERFORMANCE_PRESET_LABELS.detected}</strong>, this device would use{' '}
                  <strong>{perfSnapshot.detectedLabel}</strong>.
                </span>
              </p>
            )}
          </div>
          <div className="settings-perf-buttons">
            <button
              type="button"
              className={`btn btn-secondary ${perfPreset === 'best' ? 'active' : ''}`}
              onClick={() => applyPerformancePreset('best')}
            >
              {PERFORMANCE_PRESET_LABELS.best}
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${perfPreset === 'detected' ? 'active' : ''}`}
              onClick={() => applyPerformancePreset('detected')}
            >
              {PERFORMANCE_PRESET_LABELS.detected}
            </button>
            <button
              type="button"
              className={`btn btn-secondary ${perfPreset === 'low' ? 'active' : ''}`}
              onClick={() => applyPerformancePreset('low')}
            >
              {PERFORMANCE_PRESET_LABELS.low}
            </button>
          </div>
        </div>
        <div className="settings-toggles">
          <div className="settings-toggle-row">
            <div>
              <strong>Custom Cursor</strong>
              <p>Animated dot + ring cursor</p>
            </div>
            <button className="btn btn-ghost" onClick={toggleCursor}>
              {cursorEnabled ? <ToggleRight size={24} color="var(--accent)" /> : <ToggleLeft size={24} />}
            </button>
          </div>
          <div className="settings-toggle-row">
            <div>
              <strong>Click Particles</strong>
              <p>Burst effect on every click</p>
            </div>
            <button className="btn btn-ghost" onClick={toggleClick}>
              {clickEnabled ? <ToggleRight size={24} color="var(--accent)" /> : <ToggleLeft size={24} />}
            </button>
          </div>
        </div>
      </section>

      {/* --- Web Engine --- */}
      <section className="settings-section glass-card">
        <div className="settings-section-header">
          <Wifi size={20} />
          <div>
            <h3>Web Engine</h3>
            <p>Select the proxy provider for Web Tools</p>
          </div>
        </div>
        <div className="provider-options">
          {getAllProviders().map((p) => {
            const Icon = PROVIDER_ICONS[p.icon] ?? Zap;
            const h = providerHealth[p.id];
            const isActive = activeProvider === p.id;
            return (
              <button
                key={p.id}
                className={`provider-option ${isActive ? 'active' : ''}`}
                onClick={() => handleProviderChange(p.id)}
              >
                <div className="provider-option-top">
                  <Icon size={18} />
                  <span className="provider-option-name">{p.name}</span>
                  {isActive && <Check size={14} className="provider-check" />}
                </div>
                <span className="provider-option-desc">{p.description}</span>
                {h && (
                  <span className={`provider-health ${h.available ? 'ok' : 'err'}`}>
                    <span className="provider-health-dot" />
                    {h.available ? (h.mode === 'stub' ? 'Local mode' : 'Connected') : 'Unavailable'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* --- Layout --- */}
      <section className="settings-section glass-card">
        <div className="settings-section-header">
          <Layout size={20} />
          <div>
            <h3>Navigation Layout</h3>
            <p>Choose sidebar or bottom taskbar</p>
          </div>
        </div>
        <div className="layout-options">
          <button
            className={`layout-option ${layout === 'sidebar' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('sidebar')}
          >
            <div className="layout-preview layout-preview-sidebar">
              <div className="lp-sidebar" />
              <div className="lp-content" />
            </div>
            <span>Sidebar</span>
          </button>
          <button
            className={`layout-option ${layout === 'taskbar' ? 'active' : ''}`}
            onClick={() => handleLayoutChange('taskbar')}
          >
            <div className="layout-preview layout-preview-taskbar">
              <div className="lp-content" />
              <div className="lp-taskbar" />
            </div>
            <span>Taskbar</span>
          </button>
        </div>
      </section>

      {/* --- Profile --- */}
      {account && <ProfileSection account={account} />}

      {/* --- Status --- */}
      {account && (
        <section className="settings-section glass-card">
          <div className="settings-section-header">
            <User size={20} />
            <div>
              <h3>Status</h3>
              <p>Set your online presence</p>
            </div>
          </div>
          <div className="status-options">
            {STATUSES.map(({ key, label, color }) => (
              <button
                key={key}
                className={`status-option ${account.status === key ? 'active' : ''}`}
                onClick={() => setStatus(key)}
              >
                <Circle size={12} fill={color} stroke="none" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* --- Appeals & notifications --- */}
      {account && (
        <section className="settings-section glass-card">
          <div className="settings-section-header">
            <Bell size={20} />
            <div>
              <h3>Appeals & notifications</h3>
              <p>Moderation messages and appeal updates</p>
            </div>
          </div>
          <p className="settings-muted" style={{ marginBottom: '0.75rem' }}>
            <Link to="/moderation" className="settings-inline-link">
              <Gavel size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Open moderation & appeals
            </Link>
          </p>
          {inbox.length === 0 ? (
            <p className="settings-muted">No notifications yet.</p>
          ) : (
            <ul className="settings-notif-list">
              {inbox.slice(0, 12).map((n) => (
                <li key={n.id} className={n.read ? '' : 'settings-notif-unread'}>
                  <strong>{n.title}</strong>
                  <span className="settings-muted">{n.body}</span>
                  <span className="settings-muted" style={{ fontSize: '0.75rem' }}>
                    {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* --- Data --- */}
      {account && <DataSection />}

    </div>
  );
}
