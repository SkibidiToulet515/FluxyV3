import { useState } from 'react';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#22d3ee', '#34d399', '#f97316', '#a855f7', '#38bdf8',
];

function pickColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatTime(ts) {
  const d = new Date(ts);
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
      {gif.title && <span className="dc-msg-gif-alt">{gif.title}</span>}
    </div>
  );
}

export default function MessageItem({ msg, isOwn, showAvatar }) {
  const color = pickColor(msg.user);
  const hasText = !!msg.text;
  const hasGif = !!msg.gif;
  const isGifOnly = hasGif && !hasText;

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
        <div className="dc-msg-avatar" style={{ background: color }}>
          {msg.user.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div className="dc-msg-avatar-spacer" />
      )}
      <div className="dc-msg-body">
        {showAvatar && (
          <div className="dc-msg-header">
            <span className="dc-msg-username" style={{ color }}>
              {msg.user}
            </span>
            <span className="dc-msg-time">{formatTime(msg.ts)}</span>
          </div>
        )}
        {hasText && <div className="dc-msg-text">{msg.text}</div>}
        {hasGif && <GifEmbed gif={msg.gif} />}
      </div>
    </div>
  );
}
