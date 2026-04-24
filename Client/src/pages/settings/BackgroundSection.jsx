import { useState, useRef } from 'react';
import { Image, Upload, Trash2, Loader2 } from 'lucide-react';
import { uploadUserBackground, deleteUserBackground } from '../../services/storage';
import { updateUserSettings } from '../../services/firestore';

export default function BackgroundSection({ uid }) {
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
