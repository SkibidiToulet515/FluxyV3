import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download, FileText, ExternalLink,
  SmilePlus, Pencil, Trash2, Flag, Check, X,
} from 'lucide-react';
import UserAvatar from './UserAvatar';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '🎉', '😢', '💯'];

function formatTime(ts) {
  if (!ts) return '';
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);

  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today at ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

function GifEmbed({ gif }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="dc-msg-gif-wrap">
      {!loaded && <div className="dc-msg-gif-placeholder" />}
      <img
        className={`dc-msg-gif ${loaded ? 'loaded' : ''}`}
        src={gif.url || gif.preview}
        alt={gif.title || 'GIF'}
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function ImageEmbed({ url }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="dc-msg-image-wrap">
      {!loaded && <div className="dc-msg-gif-placeholder" />}
      <img
        className={`dc-msg-image ${loaded ? 'loaded' : ''}`}
        src={url}
        alt="Attachment"
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onClick={() => window.open(url, '_blank')}
      />
    </div>
  );
}

function FileEmbed({ attachment }) {
  const sizeKb = attachment.size ? (attachment.size / 1024).toFixed(0) + ' KB' : '';
  return (
    <div className="dc-msg-file">
      <div className="dc-msg-file-icon"><FileText size={20} /></div>
      <div className="dc-msg-file-info">
        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="dc-msg-file-name">
          {attachment.name || 'File'}<ExternalLink size={12} />
        </a>
        {sizeKb && <span className="dc-msg-file-size">{sizeKb}</span>}
      </div>
      <a href={attachment.url} download={attachment.name} className="dc-msg-file-dl" title="Download">
        <Download size={16} />
      </a>
    </div>
  );
}

function ReactionBar({ reactions, currentUid, onToggle }) {
  if (!reactions || typeof reactions !== 'object') return null;
  const entries = Object.entries(reactions).filter(([, uids]) => Array.isArray(uids) && uids.length > 0);
  if (!entries.length) return null;
  return (
    <div className="dc-reactions-bar">
      {entries.map(([emoji, uids]) => {
        const active = uids.includes(currentUid);
        return (
          <button
            key={emoji}
            className={`dc-reaction-chip ${active ? 'active' : ''}`}
            onClick={() => onToggle(emoji, active)}
            title={`${uids.length} reaction${uids.length > 1 ? 's' : ''}`}
          >
            <span className="dc-reaction-emoji">{emoji}</span>
            <span className="dc-reaction-count">{uids.length}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return (
    <div className="dc-emoji-picker" ref={ref}>
      {QUICK_EMOJIS.map((e) => (
        <button key={e} className="dc-emoji-btn" onClick={() => { onPick(e); onClose(); }}>{e}</button>
      ))}
    </div>
  );
}

function ReportModal({ onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal dc-report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Report Message</h3>
          <button className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-modal-body">
          <textarea
            className="dc-report-input"
            placeholder="Why are you reporting this message?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            rows={3}
            autoFocus
          />
          <div className="dc-modal-actions">
            <button className="dc-modal-cancel" onClick={onClose}>Cancel</button>
            <button
              className="dc-modal-submit"
              disabled={!reason.trim() || sending}
              onClick={async () => {
                setSending(true);
                await onSubmit(reason.trim());
                onClose();
              }}
            >
              {sending ? 'Sending…' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessageItem({
  msg, isOwn, showAvatar, currentUid,
  onReact, onEdit, onDelete, onReport, isMod,
}) {
  const [hovered, setHovered] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [showReport, setShowReport] = useState(false);

  const hasText = !!msg.text;
  const hasGif = !!msg.gif;
  const hasImage = !!msg.image;
  const hasFile = !!msg.attachment && !msg.image;
  const isGifOnly = hasGif && !hasText;
  const canEdit = isOwn && hasText;
  const canDelete = isOwn || isMod;

  const user = {
    username: msg.senderUsername || msg.user || '?',
    avatar: msg.senderAvatar || null,
    color: msg.senderColor || null,
  };

  const startEdit = useCallback(() => {
    setEditText(msg.text || '');
    setEditing(true);
  }, [msg.text]);

  const saveEdit = useCallback(async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === msg.text) { setEditing(false); return; }
    await onEdit?.(msg.id, trimmed);
    setEditing(false);
  }, [editText, msg.id, msg.text, onEdit]);

  const cancelEdit = useCallback(() => setEditing(false), []);

  const handleReactionToggle = useCallback((emoji, active) => {
    onReact?.(msg.id, emoji, active);
  }, [msg.id, onReact]);

  return (
    <>
      <div
        className={[
          'dc-message',
          isOwn ? 'own' : '',
          showAvatar ? 'with-avatar' : 'grouped',
          isGifOnly ? 'gif-only' : '',
          hovered ? 'hovered' : '',
        ].filter(Boolean).join(' ')}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setShowEmojiPicker(false); }}
      >
        {showAvatar ? (
          <UserAvatar user={user} size={40} />
        ) : (
          <div className="dc-msg-avatar-spacer" />
        )}
        <div className="dc-msg-body">
          {showAvatar && (
            <div className="dc-msg-header">
              <span className="dc-msg-username" style={{ color: user.color || undefined }}>
                {user.username}
              </span>
              <span className="dc-msg-time">{formatTime(msg.createdAt)}</span>
              {msg.editedAt && <span className="dc-msg-edited">(edited)</span>}
            </div>
          )}

          {editing ? (
            <div className="dc-msg-edit-box">
              <input
                className="dc-msg-edit-input"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
              />
              <div className="dc-msg-edit-actions">
                <button className="dc-msg-edit-save" onClick={saveEdit} title="Save"><Check size={14} /></button>
                <button className="dc-msg-edit-cancel" onClick={cancelEdit} title="Cancel"><X size={14} /></button>
              </div>
            </div>
          ) : (
            <>
              {hasText && (
                <div className="dc-msg-text">
                  {msg.text}
                  {!showAvatar && msg.editedAt && <span className="dc-msg-edited-inline">(edited)</span>}
                </div>
              )}
            </>
          )}
          {hasGif && <GifEmbed gif={msg.gif} />}
          {hasImage && <ImageEmbed url={msg.image} />}
          {hasFile && <FileEmbed attachment={msg.attachment} />}

          <ReactionBar reactions={msg.reactions} currentUid={currentUid} onToggle={handleReactionToggle} />
        </div>

        {hovered && !editing && (
          <div className="dc-msg-actions">
            <button
              className="dc-msg-action-btn"
              title="React"
              onClick={() => setShowEmojiPicker((p) => !p)}
            >
              <SmilePlus size={16} />
            </button>
            {canEdit && (
              <button className="dc-msg-action-btn" title="Edit" onClick={startEdit}>
                <Pencil size={16} />
              </button>
            )}
            {canDelete && (
              <button className="dc-msg-action-btn dc-action-danger" title="Delete" onClick={() => onDelete?.(msg.id)}>
                <Trash2 size={16} />
              </button>
            )}
            {!isOwn && (
              <button className="dc-msg-action-btn dc-action-warn" title="Report" onClick={() => setShowReport(true)}>
                <Flag size={16} />
              </button>
            )}
            {showEmojiPicker && (
              <EmojiPicker
                onPick={(emoji) => onReact?.(msg.id, emoji, false)}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        )}
      </div>

      {showReport && (
        <ReportModal
          onSubmit={(reason) => onReport?.(msg.id, msg.text, msg.senderUid, reason)}
          onClose={() => setShowReport(false)}
        />
      )}
    </>
  );
}
