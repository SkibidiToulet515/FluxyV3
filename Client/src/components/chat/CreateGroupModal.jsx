import { useState, useRef } from 'react';
import { X, Camera, Loader2, Check } from 'lucide-react';
import { createGroupChat, updateGroupChat as updateGroupChatDoc } from '../../services/firestore';
import { uploadGroupIcon } from '../../services/storage';
import UserAvatar from './UserAvatar';

export default function CreateGroupModal({ onClose, friends = [], userCache = {}, uid }) {
  const [name, setName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const friendUids = friends.map((f) => f.users.find((u) => u !== uid)).filter(Boolean);

  function toggleMember(friendUid) {
    setSelectedMembers((prev) =>
      prev.includes(friendUid) ? prev.filter((u) => u !== friendUid) : [...prev, friendUid],
    );
  }

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
      const groupId = await createGroupChat({
        name: name.trim(),
        members: selectedMembers,
      });
      if (iconFile) {
        const iconUrl = await uploadGroupIcon(groupId, iconFile);
        await updateGroupChatDoc(groupId, { icon: iconUrl });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create group');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Create Group Chat</h3>
          <button className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="dc-modal-body">
          <div className="dc-modal-icon-picker" onClick={() => fileRef.current?.click()}>
            {iconPreview ? (
              <img src={iconPreview} alt="" className="dc-modal-icon-img" />
            ) : (
              <Camera size={24} />
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleIcon} hidden />
          </div>
          <label className="dc-modal-label">Group Name</label>
          <input
            className="dc-modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            maxLength={50}
            autoFocus
          />
          <label className="dc-modal-label">
            Add Friends {selectedMembers.length > 0 && `(${selectedMembers.length})`}
          </label>
          <div className="dc-modal-members-list">
            {friendUids.length === 0 && (
              <p className="dc-modal-empty">Add friends first to invite them</p>
            )}
            {friendUids.map((fuid) => {
              const u = userCache[fuid];
              const selected = selectedMembers.includes(fuid);
              return (
                <button
                  key={fuid}
                  type="button"
                  className={`dc-modal-member ${selected ? 'selected' : ''}`}
                  onClick={() => toggleMember(fuid)}
                >
                  <UserAvatar user={u} size={28} />
                  <span>{u?.username || fuid.slice(0, 8)}</span>
                  {selected && <Check size={14} className="dc-modal-member-check" />}
                </button>
              );
            })}
          </div>
          {error && <p className="dc-modal-error">{error}</p>}
          <button className="dc-modal-submit" type="submit" disabled={busy || !name.trim()}>
            {busy ? <Loader2 size={16} className="spin" /> : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
