import { useState } from 'react';
import {
  Hash, Users, MessageSquare, UserPlus, Plus, ChevronDown, ChevronRight,
} from 'lucide-react';
import CreateGroupModal from './CreateGroupModal';
import UserAvatar from './UserAvatar';

export default function ChatSidebar({
  view,
  activeServerId,
  activeServer,
  activeChannelId,
  activeDmId,
  activeGroupId,
  dmChannels = [],
  groupChats = [],
  friends = [],
  userCache = {},
  uid,
  pendingCount = 0,
  onOpenDm,
  onOpenGroup,
  onOpenFriends,
  onChannelSelect,
}) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [dmExpanded, setDmExpanded] = useState(true);
  const [groupExpanded, setGroupExpanded] = useState(true);

  if (activeServerId && activeServer) {
    return (
      <div className="dc-chat-sidebar">
        <div className="dc-sidebar-header">
          <h3 className="dc-sidebar-title">{activeServer.name}</h3>
        </div>
        <div className="dc-chat-list">
          <div className="dc-section-label">CHANNELS</div>
          {(activeServer.channels || []).map((ch) => (
            <button
              key={ch.id}
              className={`dc-chat-item ${activeChannelId === ch.id ? 'active' : ''}`}
              onClick={() => onChannelSelect(ch.id)}
            >
              <div className="dc-channel-icon"><Hash size={18} /></div>
              <div className="dc-chat-meta">
                <span className="dc-chat-name">{ch.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dc-chat-sidebar">
      <div className="dc-sidebar-header">
        <h3 className="dc-sidebar-title">Messages</h3>
      </div>

      <div className="dc-chat-list">
        <button
          className={`dc-chat-item ${view === '__friends__' ? 'active' : ''}`}
          onClick={onOpenFriends}
        >
          <div className="dc-channel-icon"><Users size={18} /></div>
          <div className="dc-chat-meta">
            <span className="dc-chat-name">Friends</span>
            {pendingCount > 0 && <span className="dc-chat-badge">{pendingCount}</span>}
          </div>
        </button>

        <button
          className="dc-section-label dc-section-toggle"
          onClick={() => setDmExpanded(!dmExpanded)}
        >
          {dmExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          DIRECT MESSAGES
        </button>
        {dmExpanded && dmChannels.map((dm) => {
          const partnerId = dm.participants?.find((p) => p !== uid);
          const partner = userCache[partnerId];
          return (
            <button
              key={dm.id}
              className={`dc-chat-item ${activeDmId === dm.id ? 'active' : ''}`}
              onClick={() => onOpenDm(dm.id)}
            >
              <UserAvatar user={partner} size={32} className="dc-chat-item-avatar" />
              <div className="dc-chat-meta">
                <span className="dc-chat-name">{partner?.username || 'User'}</span>
                <span className="dc-chat-preview">{dm.lastMessage || 'No messages yet'}</span>
              </div>
            </button>
          );
        })}

        <button
          className="dc-section-label dc-section-toggle"
          onClick={() => setGroupExpanded(!groupExpanded)}
        >
          {groupExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          GROUP CHATS
          <button
            className="dc-section-add"
            title="Create Group Chat"
            onClick={(e) => { e.stopPropagation(); setShowCreateGroup(true); }}
          >
            <Plus size={12} />
          </button>
        </button>
        {groupExpanded && groupChats.map((group) => (
          <button
            key={group.id}
            className={`dc-chat-item ${activeGroupId === group.id ? 'active' : ''}`}
            onClick={() => onOpenGroup(group.id)}
          >
            <div className="dc-channel-icon dc-group-icon">
              {group.icon ? (
                <img src={group.icon} alt="" className="dc-group-icon-img" />
              ) : (
                <MessageSquare size={16} />
              )}
            </div>
            <div className="dc-chat-meta">
              <span className="dc-chat-name">{group.name}</span>
              <span className="dc-chat-preview">{group.lastMessage || 'No messages yet'}</span>
            </div>
          </button>
        ))}
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          friends={friends}
          userCache={userCache}
          uid={uid}
        />
      )}
    </div>
  );
}
