import { useRef, useEffect, useState } from 'react';
import { Hash, AtSign, Users as UsersIcon, MessageSquare } from 'lucide-react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';

const VIEW_ICONS = {
  dm: AtSign,
  group: MessageSquare,
  server: Hash,
};

export default function ChatWindow({
  messages,
  currentUser,
  currentUid,
  title,
  view,
  onSend,
  onGif,
  onAttachment,
  channelPath,
}) {
  const scrollRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  function handleScroll() {
    const el = messagesAreaRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(atBottom);
  }

  function shouldShowAvatar(msg, i) {
    if (i === 0) return true;
    const prev = messages[i - 1];
    if (prev.senderUid !== msg.senderUid) return true;
    const prevTs = prev.createdAt?.toMillis?.() || prev.createdAt?.seconds * 1000 || 0;
    const msgTs = msg.createdAt?.toMillis?.() || msg.createdAt?.seconds * 1000 || 0;
    if (msgTs - prevTs > 5 * 60 * 1000) return true;
    return false;
  }

  const Icon = VIEW_ICONS[view] || Hash;

  return (
    <div className="dc-chat-window">
      <div className="dc-topbar">
        <div className="dc-topbar-left">
          <Icon size={18} className="dc-topbar-hash" />
          <span className="dc-topbar-name">{title}</span>
        </div>
      </div>

      <div
        className="dc-messages-area"
        ref={messagesAreaRef}
        onScroll={handleScroll}
      >
        {messages.length === 0 && (
          <div className="dc-welcome">
            <div className="dc-welcome-icon">
              <Icon size={40} />
            </div>
            <h2>
              {view === 'dm' ? `Start a conversation` : `Welcome to ${title}!`}
            </h2>
            <p>
              {view === 'dm'
                ? 'Send a message to begin chatting.'
                : 'This is the beginning of the conversation.'}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageItem
            key={msg.id || `${msg.createdAt?.seconds}-${i}`}
            msg={msg}
            isOwn={msg.senderUid === currentUid}
            showAvatar={shouldShowAvatar(msg, i)}
          />
        ))}
        <div ref={scrollRef} />
      </div>

      <ChatInput
        onSend={onSend}
        onGif={onGif}
        onAttachment={onAttachment}
        channelName={title}
        channelPath={channelPath}
      />
    </div>
  );
}
