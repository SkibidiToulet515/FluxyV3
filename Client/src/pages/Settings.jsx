import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Palette, Layout, User, Circle, Check, Zap, Shield, Wifi, Camera, Loader2, ShieldCheck, Flag } from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import { useAuth } from '../utils/AuthContext';
import { getLayoutMode, setLayoutMode } from '../utils/api';
import {
  getAllProviders,
  getActiveProviderId,
  setActiveProviderId,
  checkProviderHealth,
} from '../services/providers';
import { uploadProfilePicture } from '../services/storage';
import { submitUserReport } from '../services/firestore';
import Header from '../components/Header';
import './Settings.css';

const STATUSES = [
  { key: 'online', label: 'Online', color: '#34d399' },
  { key: 'idle', label: 'Idle', color: '#fbbf24' },
  { key: 'dnd', label: 'Do Not Disturb', color: '#ef4444' },
  { key: 'offline', label: 'Invisible', color: '#71717a' },
];

const PROVIDER_ICONS = { Zap, Shield };

export default function Settings() {
  const { onMenuToggle } = useOutletContext();
  const { currentTheme, setCurrentTheme, themes } = useTheme();
  const { account, setStatus } = useAuth();
  const [layout, setLayout] = useState(getLayoutMode);

  // Provider state
  const [activeProvider, setActiveProvider] = useState(getActiveProviderId);
  const [providerHealth, setProviderHealth] = useState({});

  useEffect(() => {
    getAllProviders().forEach(async (p) => {
      const result = await checkProviderHealth(p.id);
      setProviderHealth((prev) => ({ ...prev, [p.id]: result }));
    });
  }, []);

  function handleLayoutChange(mode) {
    setLayout(mode);
    setLayoutMode(mode);
    window.dispatchEvent(new Event('fluxy-layout-change'));
  }

  function handleProviderChange(id) {
    setActiveProvider(id);
    setActiveProviderId(id);
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
      {account && (
        <ProfileSection account={account} />
      )}

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
    </div>
  );
}

function ProfileSection({ account }) {
  const { updateAvatar, updateBio } = useAuth();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [bio, setBio] = useState(account.bio || '');
  const [bioSaved, setBioSaved] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState('');

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert('File too large. Max 5 MB.');
    setUploading(true);
    try {
      const url = await uploadProfilePicture(account.uid, file);
      await updateAvatar(url);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  async function handleBioSave() {
    await updateBio(bio.trim());
    setBioSaved(true);
    setTimeout(() => setBioSaved(false), 2000);
  }

  async function handleReportSubmit(e) {
    e.preventDefault();
    if (!reportText.trim()) return;
    setReportBusy(true);
    setReportMsg('');
    try {
      await submitUserReport({ reason: reportText.trim() });
      setReportText('');
      setReportMsg('Thanks — moderators will review your report.');
    } catch (err) {
      setReportMsg(err?.message || 'Could not send report.');
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <section className="settings-section glass-card">
      <div className="settings-section-header">
        <User size={20} />
        <div>
          <h3>Profile</h3>
          <p>Manage your account</p>
        </div>
      </div>

      <div className="settings-profile">
        <div className="settings-avatar-wrap" onClick={() => fileRef.current?.click()}>
          {account.avatar ? (
            <img src={account.avatar} alt="Avatar" className="settings-avatar-img" />
          ) : (
            <div className="settings-avatar-fallback" style={{ background: account.color }}>
              {account.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="settings-avatar-overlay">
            {uploading ? <Loader2 size={18} className="spin" /> : <Camera size={18} />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
        </div>

        <div className="settings-profile-info">
          <span className="settings-profile-name">{account.username}</span>
          {account.email && <span className="settings-profile-email">{account.email}</span>}
          <span className="settings-profile-role">
            <ShieldCheck size={13} />
            {account.roleDisplayName || account.role || 'Member'}
          </span>
        </div>
      </div>

      <div className="settings-bio">
        <label className="settings-bio-label">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell us about yourself..."
          maxLength={200}
          rows={3}
        />
        <div className="settings-bio-actions">
          <span className="settings-bio-count">{bio.length}/200</span>
          <button className="btn btn-primary btn-sm" onClick={handleBioSave}>
            {bioSaved ? <><Check size={14} /> Saved</> : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-report glass-card" style={{ marginTop: '1rem', padding: '1rem' }}>
        <div className="settings-section-header" style={{ marginBottom: '0.75rem' }}>
          <Flag size={18} />
          <div>
            <h3 style={{ fontSize: '0.875rem' }}>Report an issue</h3>
            <p style={{ fontSize: '0.7rem' }}>Send a report to the moderation team</p>
          </div>
        </div>
        <form onSubmit={handleReportSubmit}>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="Describe the problem (harassment, bugs, abuse…)"
            rows={3}
            maxLength={1000}
            className="settings-report-textarea"
          />
          {reportMsg && <p className="settings-report-msg">{reportMsg}</p>}
          <button type="submit" className="btn btn-primary btn-sm" disabled={reportBusy || !reportText.trim()}>
            {reportBusy ? <Loader2 size={14} className="spin" /> : 'Submit report'}
          </button>
        </form>
      </div>
    </section>
  );
}
