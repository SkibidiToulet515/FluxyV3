import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../utils/AuthContext';
import { LogOut, Circle, Settings, Plus, Users, MessageSquare, UserPlus } from 'lucide-react';
import ServerSidebar from '../components/chat/ServerSidebar';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import FriendsPanel from '../components/chat/FriendsPanel';
import {
  subscribeFriends, subscribeFriendRequests,
  subscribeDmChannels, subscribeGroupChats,
  subscribeServers, subscribeServerMessages,
  subscribeDmMessages, subscribeGroupMessages,
  sendDmMessage, sendGroupMessage, sendServerMessage,
  getUserDoc,
} from '../services/firestore';
import './Chat.css';

const STATUS_COLORS = {
  online: '#34d399',
  idle: '#fbbf24',
  dnd: '#ef4444',
  offline: '#52525b',
};

const VIEW_FRIENDS = '__friends__';
const VIEW_DM = 'dm';
const VIEW_GROUP = 'group';
const VIEW_SERVER = 'server';

export default function Chat() {
  const { account, logout } = useAuth();
  const uid = account?.uid;
  const username = account?.username || 'Anonymous';

  // Data subscriptions
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [dmChannels, setDmChannels] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [servers, setServers] = useState([]);
  const [userCache, setUserCache] = useState({});

  // Navigation
  const [view, setView] = useState(VIEW_FRIENDS);
  const [activeServerId, setActiveServerId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState('general');
  const [activeDmId, setActiveDmId] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);

  // Messages
  const [messages, setMessages] = useState([]);

  // Resolve usernames for DM partners
  const resolveUser = useCallback(async (targetUid) => {
    if (userCache[targetUid]) return userCache[targetUid];
    const u = await getUserDoc(targetUid);
    if (u) setUserCache((prev) => ({ ...prev, [targetUid]: u }));
    return u;
  }, [userCache]);

  // Subscribe to friends, friend requests, DMs, groups, servers
  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      subscribeFriends(uid, setFriends),
      subscribeFriendRequests(uid, setFriendRequests),
      subscribeDmChannels(uid, setDmChannels),
      subscribeGroupChats(uid, setGroupChats),
      subscribeServers(uid, setServers),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // Resolve DM partner usernames
  useEffect(() => {
    if (!uid) return;
    dmChannels.forEach((dm) => {
      const partnerId = dm.participants?.find((p) => p !== uid);
      if (partnerId && !userCache[partnerId]) resolveUser(partnerId);
    });
  }, [dmChannels, uid, userCache, resolveUser]);

  // Subscribe to messages for active conversation
  useEffect(() => {
    setMessages([]);
    if (view === VIEW_FRIENDS) return;

    let unsub;
    if (view === VIEW_DM && activeDmId) {
      unsub = subscribeDmMessages(activeDmId, setMessages);
    } else if (view === VIEW_GROUP && activeGroupId) {
      unsub = subscribeGroupMessages(activeGroupId, setMessages);
    } else if (view === VIEW_SERVER && activeServerId && activeChannelId) {
      unsub = subscribeServerMessages(activeServerId, activeChannelId, setMessages);
    }
    return () => unsub?.();
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId]);

  // Send message handler
  const handleSend = useCallback(async (text) => {
    if (!text.trim()) return;
    const msg = { text: text.trim(), senderUsername: username };
    if (view === VIEW_DM && activeDmId) {
      await sendDmMessage(activeDmId, msg);
    } else if (view === VIEW_GROUP && activeGroupId) {
      await sendGroupMessage(activeGroupId, msg);
    } else if (view === VIEW_SERVER && activeServerId && activeChannelId) {
      await sendServerMessage(activeServerId, activeChannelId, msg);
    }
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, username]);

  // Send GIF handler
  const handleGif = useCallback(async ({ gif, text }) => {
    const msg = { text: text || '', gif, senderUsername: username };
    if (view === VIEW_DM && activeDmId) {
      await sendDmMessage(activeDmId, msg);
    } else if (view === VIEW_GROUP && activeGroupId) {
      await sendGroupMessage(activeGroupId, msg);
    } else if (view === VIEW_SERVER && activeServerId && activeChannelId) {
      await sendServerMessage(activeServerId, activeChannelId, msg);
    }
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, username]);

  // Send attachment handler
  const handleAttachment = useCallback(async (attachment) => {
    const msg = { ...attachment, senderUsername: username };
    if (view === VIEW_DM && activeDmId) {
      await sendDmMessage(activeDmId, msg);
    } else if (view === VIEW_GROUP && activeGroupId) {
      await sendGroupMessage(activeGroupId, msg);
    } else if (view === VIEW_SERVER && activeServerId && activeChannelId) {
      await sendServerMessage(activeServerId, activeChannelId, msg);
    }
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, username]);

  // Navigation handlers
  const handleOpenDm = useCallback((dmId) => {
    setView(VIEW_DM);
    setActiveDmId(dmId);
    setActiveServerId(null);
    setActiveGroupId(null);
  }, []);

  const handleOpenGroup = useCallback((groupId) => {
    setView(VIEW_GROUP);
    setActiveGroupId(groupId);
    setActiveServerId(null);
    setActiveDmId(null);
  }, []);

  const handleOpenServer = useCallback((serverId, channelId) => {
    setView(VIEW_SERVER);
    setActiveServerId(serverId);
    setActiveChannelId(channelId || 'general');
    setActiveDmId(null);
    setActiveGroupId(null);
  }, []);

  const handleOpenFriends = useCallback(() => {
    setView(VIEW_FRIENDS);
    setActiveServerId(null);
    setActiveDmId(null);
    setActiveGroupId(null);
  }, []);

  // Current conversation title
  const chatTitle = useMemo(() => {
    if (view === VIEW_DM && activeDmId) {
      const dm = dmChannels.find((d) => d.id === activeDmId);
      const partnerId = dm?.participants?.find((p) => p !== uid);
      return userCache[partnerId]?.username || 'Direct Message';
    }
    if (view === VIEW_GROUP && activeGroupId) {
      const group = groupChats.find((g) => g.id === activeGroupId);
      return group?.name || 'Group Chat';
    }
    if (view === VIEW_SERVER && activeServerId) {
      return activeChannelId || 'general';
    }
    return 'Friends';
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, dmChannels, groupChats, uid, userCache]);

  const activeServer = servers.find((s) => s.id === activeServerId);
  const statusColor = STATUS_COLORS[account?.status || 'online'];
  const incomingRequests = friendRequests.filter((r) => r.to === uid);
  const pendingCount = incomingRequests.length;

  return (
    <div className="dc-layout">
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleOpenServer}
        onSelectHome={handleOpenFriends}
        uid={uid}
      />

      <ChatSidebar
        view={view}
        activeServerId={activeServerId}
        activeServer={activeServer}
        activeChannelId={activeChannelId}
        activeDmId={activeDmId}
        activeGroupId={activeGroupId}
        dmChannels={dmChannels}
        groupChats={groupChats}
        friends={friends}
        userCache={userCache}
        uid={uid}
        pendingCount={pendingCount}
        onOpenDm={handleOpenDm}
        onOpenGroup={handleOpenGroup}
        onOpenFriends={handleOpenFriends}
        onChannelSelect={(channelId) => setActiveChannelId(channelId)}
      />

      {view === VIEW_FRIENDS ? (
        <FriendsPanel
          uid={uid}
          friends={friends}
          friendRequests={friendRequests}
          userCache={userCache}
          resolveUser={resolveUser}
          onOpenDm={handleOpenDm}
        />
      ) : (
        <ChatWindow
          messages={messages}
          currentUser={username}
          currentUid={uid}
          title={chatTitle}
          view={view}
          onSend={handleSend}
          onGif={handleGif}
          onAttachment={handleAttachment}
          channelPath={
            view === VIEW_DM ? `dm/${activeDmId}` :
            view === VIEW_GROUP ? `group/${activeGroupId}` :
            `server/${activeServerId}/${activeChannelId}`
          }
        />
      )}

      <div className="dc-user-footer">
        <div
          className="dc-user-footer-avatar"
          style={{ background: account?.avatar ? 'transparent' : (account?.color || 'var(--accent)') }}
        >
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
