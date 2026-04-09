import { useRef, useEffect } from 'react';
import { Hash, Image, Users } from 'lucide-react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';

const CHANNEL_META = {
  general: { icon: Hash, desc: 'Talk about anything with the community.' },
  memes: { icon: Image, desc: 'Share your best memes and GIFs!' },
};

export default function ChatWindow({
  messages,
  currentUser,
  channel,
  onSend,
  onGif,
  connected,
  onlineCount,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function shouldShowAvatar(msg, i) {
    if (i === 0) return true;
    const prev = messages[i - 1];
    if (prev.user !== msg.user) return true;
    if (msg.ts - prev.ts > 5 * 60 * 1000) return true;
    return false;
  }

  const meta = CHANNEL_META[channel] || CHANNEL_META.general;
  const Icon = meta.icon;

  return (
    <div className="dc-chat-window">
      <div className="dc-topbar">
        <div className="dc-topbar-left">
          <Icon size={18} className="dc-topbar-hash" />
          <span className="dc-topbar-name">{channel}</span>
          <span className="dc-topbar-divider" />
          <span className="dc-topbar-desc">{meta.desc}</span>
        </div>
        <div className="dc-topbar-actions">
          <div className="dc-topbar-online">
            <Users size={15} />
            <span>{onlineCount}</span>
          </div>
        </div>
      </div>

      <div className="dc-messages-area">
        {messages.length === 0 && (
          <div className="dc-welcome">
            <div className="dc-welcome-icon">
              <Icon size={40} />
            </div>
            <h2>Welcome to #{channel}!</h2>
            <p>{meta.desc} This is the beginning of the channel.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageItem
            key={msg.ts + '-' + i}
            msg={msg}
            isOwn={msg.user === currentUser}
            showAvatar={shouldShowAvatar(msg, i)}
          />
        ))}
        <div ref={scrollRef} />
      </div>

      <ChatInput
        onSend={onSend}
        onGif={onGif}
        disabled={!connected}
        channelName={channel}
      />
    </div>
  );
}
