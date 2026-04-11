import { useState, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { createServer, updateServer as updateServerDoc } from '../../services/firestore';
import { uploadServerIcon } from '../../services/storage';

export default function CreateServerModal({ onClose, uid }) {
  const [name, setName] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function handleIcon(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Icon must be under 5 MB'); return; }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      let iconUrl = null;
      const serverId = await createServer({ name: name.trim() });
      if (iconFile) {
        iconUrl = await uploadServerIcon(serverId, iconFile);
        await updateServerDoc(serverId, { icon: iconUrl });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Create a Server</h3>
          <button className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="dc-modal-body">
          <div className="dc-modal-icon-picker" onClick={() => fileRef.current?.click()}>
            {iconPreview ? (
              <img src={iconPreview} alt="Icon" className="dc-modal-icon-img" />
            ) : (
              <Camera size={24} />
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleIcon} hidden />
          </div>
          <label className="dc-modal-label">Server Name</label>
          <input
            className="dc-modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Awesome Server"
            maxLength={50}
            autoFocus
          />
          {error && <p className="dc-modal-error">{error}</p>}
          <button className="dc-modal-submit" type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 size={16} className="spin" /> : 'Create'}
          </button>
        </form>
      </div>
    </div>
  );
}
