import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Palette, Layout, User, Circle, Check, Zap, Shield, Wifi, Camera, Loader2,
  ShieldCheck, Flag, Paintbrush, Image, Sparkles, MousePointer, Download,
  Upload, Trash2, ToggleLeft, ToggleRight, Eye,
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
import { uploadProfilePicture, uploadUserBackground, deleteUserBackground } from '../services/storage';
import { submitUserReport, updateUserSettings } from '../services/firestore';
import { apiJson } from '../services/apiClient';
import ThemeMaker from '../components/ThemeMaker';
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
  const { currentTheme, setCurrentTheme, themes, saveCustomTheme } = useTheme();
  const { account, setStatus } = useAuth();
  const [layout, setLayout] = useState(getLayoutMode);
  const [showThemeMaker, setShowThemeMaker] = useState(false);

  const [activeProvider, setActiveProvider] = useState(getActiveProviderId);
  const [providerHealth, setProviderHealth] = useState({});

  const [cursorEnabled, setCursorEnabled] = useState(() => localStorage.getItem('fluxy-custom-cursor') !== 'false');
  const [clickEnabled, setClickEnabled] = useState(() => localStorage.getItem('fluxy-click-effect') !== 'false');

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

  function toggleCursor() {
    const next = !cursorEnabled;
    setCursorEnabled(next);
    localStorage.setItem('fluxy-custom-cursor', String(next));
    window.location.reload();
  }

  function toggleClick() {
    const next = !clickEnabled;
    setClickEnabled(next);
    localStorage.setItem('fluxy-click-effect', String(next));
    window.location.reload();
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

      {/* --- Background --- */}
      {account && <BackgroundSection uid={account.uid} />}

      {/* --- Effects --- */}
      <section className="settings-section glass-card">
        <div className="settings-section-header">
          <Sparkles size={20} />
          <div>
            <h3>Effects</h3>
            <p>Toggle visual effects</p>
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

      {/* --- Data --- */}
      {account && <DataSection />}

    </div>
  );
}

function BackgroundSection({ uid }) {
  const bgRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [bgUrl, setBgUrl] = useState(() => localStorage.getItem('fluxy-bg-url') || '');
  const [bgType, setBgType] = useState(() => localStorage.getItem('fluxy-bg-type') || '');
  const [error, setError] = useState('');

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        await new Promise((r) => (video.onloadedmetadata = r));
        if (video.duration > 30) { setError('Video must be 30 seconds or less.'); setUploading(false); return; }
      }
      const result = await uploadUserBackground(uid, file);
      setBgUrl(result.url);
      setBgType(result.type);
      localStorage.setItem('fluxy-bg-url', result.url);
      localStorage.setItem('fluxy-bg-type', result.type);
      await updateUserSettings(uid, { backgroundUrl: result.url, backgroundType: result.type });
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    try {
      await deleteUserBackground(uid);
    } catch { /* ignore */ }
    setBgUrl('');
    setBgType('');
    localStorage.removeItem('fluxy-bg-url');
    localStorage.removeItem('fluxy-bg-type');
    await updateUserSettings(uid, { backgroundUrl: null, backgroundType: null }).catch(() => {});
  }

  return (
    <section className="settings-section glass-card">
      <div className="settings-section-header">
        <Image size={20} />
        <div>
          <h3>Custom Background</h3>
          <p>Upload an image or short video</p>
        </div>
      </div>
      <div className="settings-bg-controls">
        <button className="btn btn-secondary" onClick={() => bgRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        {bgUrl && (
          <button className="btn btn-ghost" onClick={handleRemove}>
            <Trash2 size={14} /> Remove
          </button>
        )}
        <input
          ref={bgRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          onChange={handleUpload}
          hidden
        />
      </div>
      {bgUrl && (
        <div className="settings-bg-preview">
          {bgType === 'video' ? (
            <video src={bgUrl} muted loop autoPlay playsInline style={{ width: '100%', borderRadius: 8, maxHeight: 120, objectFit: 'cover' }} />
          ) : (
            <img src={bgUrl} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: 120, objectFit: 'cover' }} />
          )}
        </div>
      )}
      {error && <p className="settings-error">{error}</p>}
      <p className="settings-hint">Images: max 5 MB (JPG, PNG, WebP, GIF). Videos: max 15 MB, 30s (MP4, WebM).</p>
    </section>
  );
}

function DataSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const importRef = useRef(null);

  async function handleExport() {
    setExporting(true);
    setMessage('');
    try {
      const data = await apiJson('/api/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fluxy-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded.');
    } catch (err) {
      setMessage(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.version !== 1) throw new Error('Invalid export format');
      const res = await apiJson('/api/import', { method: 'POST', body: data });
      setMessage(`Imported: ${res.fieldsUpdated?.join(', ') || 'done'}`);
    } catch (err) {
      setMessage(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="settings-section glass-card">
      <div className="settings-section-header">
        <Download size={20} />
        <div>
          <h3>Data</h3>
          <p>Export or import your Fluxy data</p>
        </div>
      </div>
      <div className="settings-data-actions">
        <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          Export Data
        </button>
        <button className="btn btn-secondary" onClick={() => importRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          Import Data
        </button>
        <input ref={importRef} type="file" accept="application/json" onChange={handleImport} hidden />
      </div>
      {message && <p className="settings-data-msg">{message}</p>}
      <p className="settings-hint">Export downloads a JSON file of your profile, settings, and memberships. Import restores settings and bio only.</p>
    </section>
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
