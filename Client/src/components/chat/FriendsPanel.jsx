import { useState, useEffect } from 'react';
import {
  Users, UserPlus, Check, X, MessageSquare, Search,
  UserMinus, Clock, Loader2, AlertCircle,
} from 'lucide-react';
import {
  searchUsers, sendFriendRequest, acceptFriendRequest,
  declineFriendRequest, cancelFriendRequest, removeFriend,
  ensureDmChannel, getDmChannelId,
} from '../../services/firestore';
import UserAvatar from './UserAvatar';

const TABS = [
  { id: 'all', label: 'All', icon: Users },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'add', label: 'Add Friend', icon: UserPlus },
];

export default function FriendsPanel({
  uid,
  friends = [],
  friendRequests = [],
  userCache = {},
  resolveUser,
  onOpenDm,
}) {
  const [tab, setTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [busyIds, setBusyIds] = useState(new Set());

  const incoming = friendRequests.filter((r) => r.to === uid);
  const outgoing = friendRequests.filter((r) => r.from === uid);
  const friendUids = friends.map((f) => f.users.find((u) => u !== uid)).filter(Boolean);

  useEffect(() => {
    friendUids.forEach((fuid) => resolveUser(fuid));
    [...incoming, ...outgoing].forEach((r) => {
      const other = r.users.find((u) => u !== uid);
      if (other) resolveUser(other);
    });
  }, [friendUids.length, incoming.length, outgoing.length]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setAddError('');
    setAddSuccess('');
    try {
      const results = await searchUsers(searchQuery.trim());
      setSearchResults(results.filter((u) => u.uid !== uid));
    } catch {
      setAddError('Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(toUid) {
    setBusyIds((p) => new Set(p).add(toUid));
    setAddError('');
    try {
      await sendFriendRequest(uid, toUid);
      setAddSuccess('Friend request sent!');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setBusyIds((p) => { const s = new Set(p); s.delete(toUid); return s; });
    }
  }

  async function handleAccept(req) {
    const docId = req.id;
    setBusyIds((p) => new Set(p).add(docId));
    try {
      await acceptFriendRequest(docId);
      const other = req.users?.find((u) => u !== uid);
      if (other) onOpenDm(getDmChannelId(uid, other));
    } catch { /* ignore */ }
    finally { setBusyIds((p) => { const s = new Set(p); s.delete(docId); return s; }); }
  }

  async function handleDecline(docId) {
    setBusyIds((p) => new Set(p).add(docId));
    try { await declineFriendRequest(docId); } catch { /* ignore */ }
    finally { setBusyIds((p) => { const s = new Set(p); s.delete(docId); return s; }); }
  }

  async function handleCancel(docId) {
    setBusyIds((p) => new Set(p).add(docId));
    try { await cancelFriendRequest(docId); } catch { /* ignore */ }
    finally { setBusyIds((p) => { const s = new Set(p); s.delete(docId); return s; }); }
  }

  async function handleRemove(docId) {
    setBusyIds((p) => new Set(p).add(docId));
    try { await removeFriend(docId); } catch { /* ignore */ }
    finally { setBusyIds((p) => { const s = new Set(p); s.delete(docId); return s; }); }
  }

  async function handleMessageFriend(friendUid) {
    try {
      const channelId = await ensureDmChannel(uid, friendUid);
      onOpenDm(channelId);
    } catch {
      const channelId = getDmChannelId(uid, friendUid);
      onOpenDm(channelId);
    }
  }

  return (
    <div className="dc-friends-panel">
      <div className="dc-topbar">
        <div className="dc-topbar-left">
          <Users size={18} className="dc-topbar-hash" />
          <span className="dc-topbar-name">Friends</span>
          <span className="dc-topbar-divider" />
          <div className="dc-friends-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`dc-friends-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'pending' && incoming.length > 0 && (
                  <span className="dc-friends-tab-badge">{incoming.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dc-friends-content">
        {tab === 'all' && (
          <div className="dc-friends-list">
            {friendUids.length === 0 ? (
              <div className="dc-friends-empty">
                <Users size={40} />
                <h4>No friends yet</h4>
                <p>Add friends to start chatting!</p>
              </div>
            ) : (
              <>
                <div className="dc-section-label">ALL FRIENDS — {friendUids.length}</div>
                <p className="dc-friends-dm-cue">Click a friend to open your direct message thread.</p>
                {friendUids.map((fuid) => {
                  const u = userCache[fuid];
                  const docId = friends.find((f) => f.users.includes(fuid))?.id;
                  return (
                    <div
                      key={fuid}
                      className="dc-friend-row dc-friend-row-open-dm"
                      role="button"
                      tabIndex={0}
                      title="Open direct message"
                      onClick={() => handleMessageFriend(fuid)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleMessageFriend(fuid);
                        }
                      }}
                    >
                      <UserAvatar user={u} size={36} />
                      <div className="dc-friend-info">
                        <span className="dc-friend-name">{u?.username || 'User'}</span>
                        <span className="dc-friend-status">{u?.status || 'offline'}</span>
                      </div>
                      <div className="dc-friend-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="dc-friend-action-btn"
                          title="Open DM"
                          onClick={() => handleMessageFriend(fuid)}
                        >
                          <MessageSquare size={16} />
                        </button>
                        <button
                          type="button"
                          className="dc-friend-action-btn dc-danger"
                          title="Remove Friend"
                          onClick={() => docId && handleRemove(docId)}
                          disabled={busyIds.has(docId)}
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === 'pending' && (
          <div className="dc-friends-list">
            {incoming.length > 0 && (
              <>
                <div className="dc-section-label">INCOMING — {incoming.length}</div>
                {incoming.map((req) => {
                  const fromUser = userCache[req.from];
                  return (
                    <div key={req.id} className="dc-friend-row">
                      <UserAvatar user={fromUser} size={36} />
                      <div className="dc-friend-info">
                        <span className="dc-friend-name">{fromUser?.username || 'User'}</span>
                        <span className="dc-friend-status">Incoming request</span>
                      </div>
                      <div className="dc-friend-actions">
                        <button
                          type="button"
                          className="dc-friend-action-btn dc-success"
                          title="Accept"
                          onClick={() => handleAccept(req)}
                          disabled={busyIds.has(req.id)}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          className="dc-friend-action-btn dc-danger"
                          title="Decline"
                          onClick={() => handleDecline(req.id)}
                          disabled={busyIds.has(req.id)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <div className="dc-section-label">OUTGOING — {outgoing.length}</div>
                {outgoing.map((req) => {
                  const toUser = userCache[req.to];
                  return (
                    <div key={req.id} className="dc-friend-row">
                      <UserAvatar user={toUser} size={36} />
                      <div className="dc-friend-info">
                        <span className="dc-friend-name">{toUser?.username || 'User'}</span>
                        <span className="dc-friend-status">Outgoing request</span>
                      </div>
                      <div className="dc-friend-actions">
                        <button
                          className="dc-friend-action-btn dc-danger"
                          title="Cancel Request"
                          onClick={() => handleCancel(req.id)}
                          disabled={busyIds.has(req.id)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {incoming.length === 0 && outgoing.length === 0 && (
              <div className="dc-friends-empty">
                <Clock size={40} />
                <h4>No pending requests</h4>
              </div>
            )}
          </div>
        )}

        {tab === 'add' && (
          <div className="dc-friends-add">
            <h4 className="dc-friends-add-title">Add Friend</h4>
            <p className="dc-friends-add-desc">Search for users by username</p>
            <div className="dc-friends-search-bar">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter a username..."
                autoFocus
              />
              <button
                className="dc-friends-search-btn"
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? <Loader2 size={14} className="spin" /> : 'Search'}
              </button>
            </div>
            {addError && (
              <p className="dc-friends-msg dc-error"><AlertCircle size={14} /> {addError}</p>
            )}
            {addSuccess && (
              <p className="dc-friends-msg dc-success-msg"><Check size={14} /> {addSuccess}</p>
            )}
            <div className="dc-friends-results">
              {searchResults.map((u) => {
                const isFriend = friendUids.includes(u.uid);
                const hasPending = friendRequests.some((r) => r.users.includes(u.uid));
                return (
                  <div key={u.uid} className="dc-friend-row">
                    <UserAvatar user={u} size={36} />
                    <div className="dc-friend-info">
                      <span className="dc-friend-name">{u.username}</span>
                      <span className="dc-friend-status">
                        {isFriend ? 'Already friends' : hasPending ? 'Request pending' : ''}
                      </span>
                    </div>
                    {!isFriend && !hasPending && (
                      <button
                        className="dc-friend-action-btn dc-success"
                        title="Send Request"
                        onClick={() => handleSendRequest(u.uid)}
                        disabled={busyIds.has(u.uid)}
                      >
                        {busyIds.has(u.uid) ? <Loader2 size={14} className="spin" /> : <UserPlus size={16} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
