import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../utils/AuthContext';
import { LogOut, Circle, Settings } from 'lucide-react';
import ServerSidebar from '../components/chat/ServerSidebar';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import './Chat.css';

let socket = null;
function getSocket() {
  if (!socket) socket = io(import.meta.env.VITE_API_URL || '/', { autoConnect: false });
  return socket;
}

const STATUS_COLORS = {
  online: '#34d399',
  idle: '#fbbf24',
  dnd: '#ef4444',
  offline: '#52525b',
};

export default function Chat() {
  const { account, logout } = useAuth();
  const username = account?.username || 'Anonymous';

  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [channel, setChannel] = useState('general');
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const s = getSocket();
    if (!s.connected) s.connect();
    s.emit('join', username);
    setConnected(true);

    function onHistory(data) {
      if (data.channel === channel) setMessages(data.messages);
    }
    function onMessage(msg) {
      setMessages((prev) => {
        if (msg.channel !== channel) return prev;
        return [...prev, msg];
      });
    }
    function onOnline(users) { setOnlineUsers(users); }

    s.on('history', onHistory);
    s.on('message', onMessage);
    s.on('onlineUsers', onOnline);
    return () => {
      s.off('history', onHistory);
      s.off('message', onMessage);
      s.off('onlineUsers', onOnline);
    };
  }, [username, channel]);

  useEffect(() => {
    const s = getSocket();
    if (s.connected) {
      setMessages([]);
      s.emit('switchChannel', channel);
    }
  }, [channel]);

  const handleSend = useCallback(
    (text) => { getSocket().emit('message', { text }); },
    [],
  );

  const handleGif = useCallback(
    ({ gif, text }) => { getSocket().emit('message', { text: text || '', gif }); },
    [],
  );

  const statusColor = STATUS_COLORS[account?.status || 'online'];

  return (
    <div className="dc-layout">
      <ServerSidebar />

      <ChatSidebar
        activeChannel={channel}
        onChannelSelect={setChannel}
        onlineUsers={onlineUsers}
      />

      <ChatWindow
        messages={messages}
        currentUser={username}
        channel={channel}
        onSend={handleSend}
        onGif={handleGif}
        connected={connected}
        onlineCount={onlineUsers.length}
      />

      <div className="dc-user-footer">
        <div className="dc-user-footer-avatar" style={{ background: account?.avatar ? 'transparent' : (account?.color || 'var(--accent)') }}>
          {account?.avatar ? (
            <img src={account.avatar} alt="" className="dc-user-footer-avatar-img" />
          ) : (
            username.charAt(0).toUpperCase()
          )}
          <span className="dc-user-footer-status" style={{ background: statusColor }} />
        </div>
        <div className="dc-user-footer-info">
          <span className="dc-user-footer-name">{username}</span>
          <span className="dc-user-footer-tag">
            <Circle size={7} fill={statusColor} stroke="none" />
            {account?.status || 'Online'}
          </span>
        </div>
        <div className="dc-user-footer-actions">
          <button className="dc-user-footer-btn" title="Settings">
            <Settings size={16} />
          </button>
          <button className="dc-user-footer-btn" title="Log Out" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
