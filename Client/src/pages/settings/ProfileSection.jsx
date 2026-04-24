import { useState, useRef } from 'react';
import { User, Check, Camera, Loader2, ShieldCheck, Flag } from 'lucide-react';
import { useAuth } from '../../utils/AuthContext';
import { uploadProfilePicture } from '../../services/storage';
import { submitUserReport } from '../../services/firestore';

export default function ProfileSection({ account }) {
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
