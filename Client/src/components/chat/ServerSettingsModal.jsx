import { useState, useRef } from 'react';
import {
  X, Camera, Loader2, Plus, Trash2, Hash,
} from 'lucide-react';
import { updateServer, replaceServerChannels } from '../../services/firestore';
import { uploadServerIcon } from '../../services/storage';

function slugFromName(name, existingIds) {
  let s = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!s) s = 'channel';
  let id = s;
  let n = 0;
  while (existingIds.includes(id)) {
    n += 1;
    id = `${s}-${n}`;
  }
  return id;
}

export default function ServerSettingsModal({ server, initialTab = 'general', onClose }) {
  const [tab, setTab] = useState(initialTab === 'channels' ? 'channels' : 'general');
  const [name, setName] = useState(server.name || '');
  const [channels, setChannels] = useState(() => [...(server.channels || [])]);
  const [newChName, setNewChName] = useState('');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(server.icon || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  function handleIcon(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Icon must be under 5 MB');
      return;
    }
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  }

  async function saveGeneral(e) {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      let iconUrl = server.icon;
      if (iconFile) {
        iconUrl = await uploadServerIcon(server.id, iconFile);
      }
      await updateServer(server.id, {
        name: name.trim(),
        ...(iconUrl !== undefined ? { icon: iconUrl } : {}),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function saveChannels(e) {
    e?.preventDefault();
    if (channels.length < 1) {
      setError('Keep at least one channel');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await replaceServerChannels(server.id, channels);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save channels');
    } finally {
      setBusy(false);
    }
  }

  function addChannel() {
    const nm = newChName.trim();
    if (!nm) return;
    const ids = channels.map((c) => c.id);
    const id = slugFromName(nm, ids);
    setChannels((prev) => [...prev, { id, name: nm }]);
    setNewChName('');
  }

  function removeChannel(chId) {
    if (channels.length <= 1) return;
    setChannels((prev) => prev.filter((c) => c.id !== chId));
  }

  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal dc-server-settings-modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Server settings</h3>
          <button type="button" className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-server-settings-tabs">
          <button
            type="button"
            className={tab === 'general' ? 'active' : ''}
            onClick={() => setTab('general')}
          >
            General
          </button>
          <button
            type="button"
            className={tab === 'channels' ? 'active' : ''}
            onClick={() => setTab('channels')}
          >
            Channels
          </button>
        </div>
        <div className="dc-modal-body">
          {error && <div className="dc-modal-error">{error}</div>}
          {tab === 'general' && (
            <form onSubmit={saveGeneral} className="dc-server-settings-form">
              <div className="dc-modal-icon-picker" onClick={() => fileRef.current?.click()}>
                {iconPreview ? (
                  <img src={iconPreview} alt="" className="dc-modal-icon-img" />
                ) : (
                  <Camera size={24} />
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleIcon} hidden />
              </div>
              <label className="dc-modal-label">Server name</label>
              <input
                className="dc-modal-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
              <button type="submit" className="dc-modal-submit" disabled={busy || !name.trim()}>
                {busy ? <Loader2 size={16} className="spin" /> : 'Save changes'}
              </button>
            </form>
          )}
          {tab === 'channels' && (
            <form onSubmit={saveChannels} className="dc-server-settings-form">
              <div className="dc-channel-list">
                {channels.map((ch) => (
                  <div key={ch.id} className="dc-channel-list-row">
                    <Hash size={14} className="dc-channel-list-hash" />
                    <span className="dc-channel-list-name">{ch.name}</span>
                    <code className="dc-channel-list-id">{ch.id}</code>
                    <button
                      type="button"
                      className="dc-channel-list-remove"
                      title="Remove channel"
                      disabled={channels.length <= 1}
                      onClick={() => removeChannel(ch.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="dc-channel-add-row">
                <input
                  className="dc-modal-input"
                  placeholder="New channel name"
                  value={newChName}
                  onChange={(e) => setNewChName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChannel())}
                />
                <button type="button" className="dc-channel-add-btn" onClick={addChannel}>
                  <Plus size={16} />
                </button>
              </div>
              <button type="submit" className="dc-modal-submit" disabled={busy}>
                {busy ? <Loader2 size={16} className="spin" /> : 'Save channels'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
