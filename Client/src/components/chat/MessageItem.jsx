import { useState } from 'react';
import { Download, FileText, ExternalLink } from 'lucide-react';
import UserAvatar from './UserAvatar';

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
      <div className="dc-msg-file-icon">
        <FileText size={20} />
      </div>
      <div className="dc-msg-file-info">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="dc-msg-file-name"
        >
          {attachment.name || 'File'}
          <ExternalLink size={12} />
        </a>
        {sizeKb && <span className="dc-msg-file-size">{sizeKb}</span>}
      </div>
      <a
        href={attachment.url}
        download={attachment.name}
        className="dc-msg-file-dl"
        title="Download"
      >
        <Download size={16} />
      </a>
    </div>
  );
}

export default function MessageItem({ msg, isOwn, showAvatar }) {
  const hasText = !!msg.text;
  const hasGif = !!msg.gif;
  const hasImage = !!msg.image;
  const hasFile = !!msg.attachment && !msg.image;
  const isGifOnly = hasGif && !hasText;

  const user = {
    username: msg.senderUsername || msg.user || '?',
    avatar: msg.senderAvatar || null,
    color: msg.senderColor || null,
  };

  return (
    <div
      className={[
        'dc-message',
        isOwn ? 'own' : '',
        showAvatar ? 'with-avatar' : 'grouped',
        isGifOnly ? 'gif-only' : '',
      ].filter(Boolean).join(' ')}
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
          </div>
        )}
        {hasText && <div className="dc-msg-text">{msg.text}</div>}
        {hasGif && <GifEmbed gif={msg.gif} />}
        {hasImage && <ImageEmbed url={msg.image} />}
        {hasFile && <FileEmbed attachment={msg.attachment} />}
      </div>
    </div>
  );
}
