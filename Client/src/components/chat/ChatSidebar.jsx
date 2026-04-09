import { Hash, Image, Circle, Users } from 'lucide-react';

const CHANNELS = [
  { id: 'general', name: 'General', icon: Hash, desc: 'Talk about anything' },
  { id: 'memes', name: 'Memes Chat', icon: Image, desc: 'Share memes & GIFs' },
];

const STATUS_COLORS = {
  online: '#34d399',
  idle: '#fbbf24',
  dnd: '#ef4444',
  offline: '#52525b',
};

export default function ChatSidebar({
  activeChannel,
  onChannelSelect,
  onlineUsers,
}) {
  return (
    <div className="dc-chat-sidebar">
      <div className="dc-sidebar-header">
        <h3 className="dc-sidebar-title">Fluxy Community</h3>
      </div>

      <div className="dc-chat-list">
        <div className="dc-section-label">CHANNELS</div>
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const isActive = activeChannel === ch.id;
          return (
            <button
              key={ch.id}
              className={`dc-chat-item ${isActive ? 'active' : ''}`}
              onClick={() => onChannelSelect(ch.id)}
            >
              <div className="dc-channel-icon">
                <Icon size={18} />
              </div>
              <div className="dc-chat-meta">
                <span className="dc-chat-name">{ch.name}</span>
                <span className="dc-chat-preview">{ch.desc}</span>
              </div>
            </button>
          );
        })}

        <div className="dc-section-label dc-online-label">
          <Users size={12} />
          ONLINE — {onlineUsers.length}
        </div>
        <div className="dc-online-list">
          {onlineUsers.map((name) => (
            <div key={name} className="dc-online-user">
              <span
                className="dc-online-dot"
                style={{ background: STATUS_COLORS.online }}
              />
              <span className="dc-online-name">{name}</span>
            </div>
          ))}
          {onlineUsers.length === 0 && (
            <span className="dc-no-users">No one online yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

export { CHANNELS };
