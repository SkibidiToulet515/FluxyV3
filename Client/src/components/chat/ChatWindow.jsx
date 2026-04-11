import {
  useRef, useEffect, useLayoutEffect, useState, useCallback, memo,
} from 'react';
import { Hash, AtSign, MessageSquare, ChevronDown, Loader2 } from 'lucide-react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';

const VIEW_ICONS = {
  dm: AtSign,
  group: MessageSquare,
  server: Hash,
};

const NEAR_BOTTOM_PX = 80;
const NEAR_TOP_PX = 140;

export default function ChatWindow({
  messages,
  currentUid,
  title,
  view,
  onSend,
  onGif,
  onAttachment,
  channelPath,
  hasMoreOlder = false,
  loadingOlder = false,
  onLoadOlder,
  onReact,
  onEdit,
  onDelete,
  onReport,
  isMod = false,
}) {
  const messagesAreaRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const prependMetaRef = useRef(null);
  const loadOlderTriggeredRef = useRef(false);
  const prevMessageCountForJumpRef = useRef(0);
  const prevNewestIdRef = useRef(null);

  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const updateStickinessFromScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance <= NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowJumpToBottom(!nearBottom && messages.length > 0);
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    updateStickinessFromScroll();

    if (
      el.scrollTop <= NEAR_TOP_PX
      && hasMoreOlder
      && !loadingOlder
      && onLoadOlder
      && !loadOlderTriggeredRef.current
    ) {
      loadOlderTriggeredRef.current = true;
      prependMetaRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
      Promise.resolve(onLoadOlder()).finally(() => {
        loadOlderTriggeredRef.current = false;
      });
    }
  }, [hasMoreOlder, loadingOlder, onLoadOlder, updateStickinessFromScroll]);

  useLayoutEffect(() => {
    const el = messagesAreaRef.current;
    const meta = prependMetaRef.current;

    if (el && meta && !loadingOlder) {
      const nextHeight = el.scrollHeight;
      if (nextHeight > meta.scrollHeight) {
        el.scrollTop = meta.scrollTop + (nextHeight - meta.scrollHeight);
      }
      prependMetaRef.current = null;
      updateStickinessFromScroll();
      return;
    }

    if (el && !meta && stickToBottomRef.current && messages.length > 0) {
      bottomAnchorRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages, loadingOlder, updateStickinessFromScroll]);

  useEffect(() => {
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
    prependMetaRef.current = null;
    prevMessageCountForJumpRef.current = 0;
    prevNewestIdRef.current = null;
    requestAnimationFrame(() => {
      bottomAnchorRef.current?.scrollIntoView({ block: 'end' });
      updateStickinessFromScroll();
    });
  }, [channelPath, view, title, updateStickinessFromScroll]);

  useEffect(() => {
    const n = messages.length;
    const newest = n ? messages[n - 1] : null;
    const newestId = newest?.id ?? null;
    const prevCount = prevMessageCountForJumpRef.current;
    const prevNewest = prevNewestIdRef.current;

    const appendedAtEnd =
      n > prevCount
      && prevCount > 0
      && newestId
      && newestId !== prevNewest;

    if (appendedAtEnd && !stickToBottomRef.current) {
      setShowJumpToBottom(true);
    }

    prevMessageCountForJumpRef.current = n;
    prevNewestIdRef.current = newestId;
  }, [messages]);

  const jumpToBottom = useCallback(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const shouldShowAvatar = useCallback((msg, i) => {
    if (i === 0) return true;
    const prev = messages[i - 1];
    if (prev.senderUid !== msg.senderUid) return true;
    const prevTs = prev.createdAt?.toMillis?.() || prev.createdAt?.seconds * 1000 || 0;
    const msgTs = msg.createdAt?.toMillis?.() || msg.createdAt?.seconds * 1000 || 0;
    if (msgTs - prevTs > 5 * 60 * 1000) return true;
    return false;
  }, [messages]);

  const Icon = VIEW_ICONS[view] || Hash;

  return (
    <div className="dc-chat-window">
      <header className="dc-topbar">
        <div className="dc-topbar-left">
          <Icon size={18} className="dc-topbar-hash" />
          <span className="dc-topbar-name">{title}</span>
        </div>
      </header>

      <div className="dc-chat-body">
        <div
          className="dc-messages-area"
          ref={messagesAreaRef}
          onScroll={handleScroll}
        >
          {loadingOlder && (
            <div className="dc-messages-loading-top" aria-live="polite">
              <Loader2 size={18} className="spin" />
              <span>Loading older messages…</span>
            </div>
          )}

          {messages.length === 0 && !loadingOlder && (
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
            <MemoMessageRow
              key={msg.id || `${msg.createdAt?.seconds}-${i}`}
              msg={msg}
              isOwn={msg.senderUid === currentUid}
              showAvatar={shouldShowAvatar(msg, i)}
              currentUid={currentUid}
              onReact={onReact}
              onEdit={onEdit}
              onDelete={onDelete}
              onReport={onReport}
              isMod={isMod}
            />
          ))}
          <div ref={bottomAnchorRef} className="dc-messages-bottom-anchor" />
        </div>

        {showJumpToBottom && (
          <button
            type="button"
            className="dc-jump-bottom-btn"
            onClick={jumpToBottom}
            title="Jump to latest"
          >
            <ChevronDown size={18} />
            <span>New messages</span>
          </button>
        )}

        <div className="dc-chat-input-shell">
          <ChatInput
            onSend={onSend}
            onGif={onGif}
            onAttachment={onAttachment}
            channelName={title}
            channelPath={channelPath}
          />
        </div>
      </div>
    </div>
  );
}

const MemoMessageRow = memo(
  function MemoMessageRow(props) {
    return <MessageItem {...props} />;
  },
  (a, b) =>
    a.msg?.id === b.msg?.id
    && a.isOwn === b.isOwn
    && a.showAvatar === b.showAvatar
    && a.currentUid === b.currentUid
    && a.isMod === b.isMod
    && a.msg?.text === b.msg?.text
    && a.msg?.editedAt?.seconds === b.msg?.editedAt?.seconds
    && a.msg?.gif?.id === b.msg?.gif?.id
    && a.msg?.image === b.msg?.image
    && a.msg?.attachment?.url === b.msg?.attachment?.url
    && a.msg?.createdAt?.seconds === b.msg?.createdAt?.seconds
    && a.msg?.createdAt?.nanoseconds === b.msg?.createdAt?.nanoseconds
    && reactionsEqual(a.msg?.reactions, b.msg?.reactions),
);

function reactionsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const aArr = a[k]; const bArr = b[k];
    if (!bArr || aArr.length !== bArr.length) return false;
    for (let i = 0; i < aArr.length; i++) if (aArr[i] !== bArr[i]) return false;
  }
  return true;
}
