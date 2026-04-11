import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../utils/AuthContext';
import { LogOut, Circle, Settings } from 'lucide-react';
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
  loadOlderDmMessages, loadOlderGroupMessages, loadOlderServerMessages,
  CHAT_PAGE_SIZE,
  ensureDefaultServer,
  addReaction, removeReaction,
  editMessage, deleteMessage, submitMessageReport,
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

function mergeMessageLists(older, live) {
  const map = new Map();
  for (const m of older) if (m?.id) map.set(m.id, m);
  for (const m of live) if (m?.id) map.set(m.id, m);
  return Array.from(map.values());
}

export default function Chat() {
  const { account, logout } = useAuth();
  const uid = account?.uid;
  const username = account?.username || 'Anonymous';

  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [dmChannels, setDmChannels] = useState([]);
  const [groupChats, setGroupChats] = useState([]);
  const [servers, setServers] = useState([]);
  const [userCache, setUserCache] = useState({});

  const [view, setView] = useState(VIEW_FRIENDS);
  const [activeServerId, setActiveServerId] = useState(null);
  const [activeChannelId, setActiveChannelId] = useState('general');
  const [activeDmId, setActiveDmId] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);

  const [olderMessages, setOlderMessages] = useState([]);
  const [liveMessages, setLiveMessages] = useState([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const olderRef = useRef([]);
  const oldestCursorRef = useRef(null);
  const loadOlderLockRef = useRef(false);
  const userCacheRef = useRef({});

  useEffect(() => { olderRef.current = olderMessages; }, [olderMessages]);
  useEffect(() => { userCacheRef.current = userCache; }, [userCache]);

  const messages = useMemo(
    () => mergeMessageLists(olderMessages, liveMessages),
    [olderMessages, liveMessages],
  );

  const resolveUser = useCallback(async (targetUid) => {
    if (userCacheRef.current[targetUid]) return userCacheRef.current[targetUid];
    const u = await getUserDoc(targetUid);
    if (u) setUserCache((prev) => ({ ...prev, [targetUid]: u }));
    return u;
  }, []);

  useEffect(() => {
    if (!uid) return;
    ensureDefaultServer(uid).catch(() => {});
    const unsubs = [
      subscribeFriends(uid, setFriends),
      subscribeFriendRequests(uid, setFriendRequests),
      subscribeDmChannels(uid, setDmChannels),
      subscribeGroupChats(uid, setGroupChats),
      subscribeServers(uid, setServers),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    dmChannels.forEach((dm) => {
      const partnerId = dm.participants?.find((p) => p !== uid);
      if (partnerId && !userCache[partnerId]) resolveUser(partnerId);
    });
  }, [dmChannels, uid, userCache, resolveUser]);

  useEffect(() => {
    setOlderMessages([]);
    setLiveMessages([]);
    setHasMoreOlder(false);
    oldestCursorRef.current = null;
    loadOlderLockRef.current = false;
    if (view === VIEW_FRIENDS) return;

    let unsub;
    const onLive = (msgs, meta) => {
      setLiveMessages(msgs);
      if (olderRef.current.length === 0) {
        oldestCursorRef.current = meta.oldestLiveDoc;
        setHasMoreOlder(Boolean(meta.isFullPage && meta.oldestLiveDoc));
      }
    };

    if (view === VIEW_DM && activeDmId) {
      unsub = subscribeDmMessages(activeDmId, onLive);
    } else if (view === VIEW_GROUP && activeGroupId) {
      unsub = subscribeGroupMessages(activeGroupId, onLive);
    } else if (view === VIEW_SERVER && activeServerId && activeChannelId) {
      unsub = subscribeServerMessages(activeServerId, activeChannelId, onLive);
    }
    return () => unsub?.();
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId]);

  const handleLoadOlder = useCallback(async () => {
    if (loadOlderLockRef.current || loadingOlder || !hasMoreOlder) return;
    const cursor = oldestCursorRef.current;
    if (!cursor) { setHasMoreOlder(false); return; }
    loadOlderLockRef.current = true;
    setLoadingOlder(true);
    try {
      let res;
      if (view === VIEW_DM && activeDmId) {
        res = await loadOlderDmMessages(activeDmId, cursor, CHAT_PAGE_SIZE);
      } else if (view === VIEW_GROUP && activeGroupId) {
        res = await loadOlderGroupMessages(activeGroupId, cursor, CHAT_PAGE_SIZE);
      } else if (view === VIEW_SERVER && activeServerId && activeChannelId) {
        res = await loadOlderServerMessages(activeServerId, activeChannelId, cursor, CHAT_PAGE_SIZE);
      } else { return; }
      if (!res.fetchedCount) { setHasMoreOlder(false); return; }
      setOlderMessages((prev) => [...res.messages, ...prev]);
      oldestCursorRef.current = res.oldestDocSnap;
      setHasMoreOlder(res.fetchedCount === CHAT_PAGE_SIZE);
    } finally {
      loadOlderLockRef.current = false;
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMoreOlder, view, activeDmId, activeGroupId, activeServerId, activeChannelId]);

  const messageContext = useMemo(() => ({
    type: view === VIEW_DM ? 'dm' : view === VIEW_GROUP ? 'group' : view === VIEW_SERVER ? 'server' : null,
    dmId: activeDmId,
    groupId: activeGroupId,
    serverId: activeServerId,
    channelId: activeChannelId,
  }), [view, activeDmId, activeGroupId, activeServerId, activeChannelId]);

  const handleReact = useCallback(async (msgId, emoji, alreadyActive) => {
    if (!uid) return;
    if (alreadyActive) await removeReaction(messageContext, msgId, emoji, uid);
    else await addReaction(messageContext, msgId, emoji, uid);
  }, [uid, messageContext]);

  const handleEdit = useCallback(async (msgId, newText) => {
    await editMessage(messageContext, msgId, newText);
  }, [messageContext]);

  const handleDelete = useCallback(async (msgId) => {
    await deleteMessage(messageContext, msgId);
  }, [messageContext]);

  const handleReport = useCallback(async (msgId, messageText, targetUid, reason) => {
    await submitMessageReport({ context: messageContext, msgId, messageText, targetUid, reason });
  }, [messageContext]);

  const handleSend = useCallback(async (text) => {
    if (!text.trim()) return;
    const msg = { text: text.trim(), senderUsername: username };
    if (view === VIEW_DM && activeDmId) await sendDmMessage(activeDmId, msg);
    else if (view === VIEW_GROUP && activeGroupId) await sendGroupMessage(activeGroupId, msg);
    else if (view === VIEW_SERVER && activeServerId && activeChannelId)
      await sendServerMessage(activeServerId, activeChannelId, msg);
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, username]);

  const handleGif = useCallback(async ({ gif, text }) => {
    const msg = { text: text || '', gif, senderUsername: username };
    if (view === VIEW_DM && activeDmId) await sendDmMessage(activeDmId, msg);
    else if (view === VIEW_GROUP && activeGroupId) await sendGroupMessage(activeGroupId, msg);
    else if (view === VIEW_SERVER && activeServerId && activeChannelId)
      await sendServerMessage(activeServerId, activeChannelId, msg);
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, username]);

  const handleAttachment = useCallback(async (attachment) => {
    const msg = { ...attachment, senderUsername: username };
    if (view === VIEW_DM && activeDmId) await sendDmMessage(activeDmId, msg);
    else if (view === VIEW_GROUP && activeGroupId) await sendGroupMessage(activeGroupId, msg);
    else if (view === VIEW_SERVER && activeServerId && activeChannelId)
      await sendServerMessage(activeServerId, activeChannelId, msg);
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, username]);

  const handleOpenDm = useCallback((dmId) => {
    setView(VIEW_DM); setActiveDmId(dmId); setActiveServerId(null); setActiveGroupId(null);
  }, []);

  const handleOpenGroup = useCallback((groupId) => {
    setView(VIEW_GROUP); setActiveGroupId(groupId); setActiveServerId(null); setActiveDmId(null);
  }, []);

  const handleOpenServer = useCallback((serverId, channelId) => {
    setView(VIEW_SERVER); setActiveServerId(serverId);
    setActiveChannelId(channelId || 'general'); setActiveDmId(null); setActiveGroupId(null);
  }, []);

  const handleOpenFriends = useCallback(() => {
    setView(VIEW_FRIENDS); setActiveServerId(null); setActiveDmId(null); setActiveGroupId(null);
  }, []);

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
    if (view === VIEW_SERVER && activeServerId) return activeChannelId || 'general';
    return 'Friends';
  }, [view, activeDmId, activeGroupId, activeServerId, activeChannelId, dmChannels, groupChats, uid, userCache]);

  const activeServer = servers.find((s) => s.id === activeServerId);
  const statusColor = STATUS_COLORS[account?.status || 'online'];
  const incomingRequests = friendRequests.filter((r) => r.to === uid);
  const pendingCount = incomingRequests.length;

  const userIsMod = account?.role === 'owner' || account?.role === 'admin' || account?.role === 'mod'
    || account?.permissions?.moderate_chat === true;

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
          hasMoreOlder={hasMoreOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlder}
          onReact={handleReact}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReport={handleReport}
          isMod={userIsMod}
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
          <button className="dc-user-footer-btn" title="Settings"><Settings size={16} /></button>
          <button className="dc-user-footer-btn" title="Log Out" onClick={logout}><LogOut size={16} /></button>
        </div>
      </div>
    </div>
  );
}
