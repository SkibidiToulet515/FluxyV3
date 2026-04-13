import { useState, useEffect } from 'react';
import { X, Users, MessageSquare, Loader2, Send } from 'lucide-react';
import {
  createServerInvite,
  ensureDmChannel,
  sendDmMessage,
  sendGroupMessage,
} from '../../services/firestore';
import UserAvatar from './UserAvatar';

export default function ShareInviteModal({
  server,
  friends = [],
  groupChats = [],
  userCache = {},
  uid,
  username = 'You',
  onClose,
}) {
  const [tab, setTab] = useState('friends');
  const [invite, setInvite] = useState(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [sending, setSending] = useState(null);
  const [sentOk, setSentOk] = useState(null);

  const code = invite?.code ?? null;

  useEffect(() => {
    const serverId = server.id;
    const serverName = server.name;
    let cancelled = false;
    setInvite(null);
    setLoadErr('');
    setSending(null);
    setSentOk(null);
    setCodeLoading(true);
    (async () => {
      try {
        const res = await createServerInvite(serverId, serverName);
        if (!cancelled) setInvite(res);
      } catch (e) {
        if (!cancelled) {
          setInvite(null);
          setLoadErr(e.message || 'Could not create invite');
        }
      } finally {
        if (!cancelled) setCodeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [server.id, server.name]);

  const friendUids = friends.map((f) => f.users?.find((u) => u !== uid)).filter(Boolean);

  async function sendToFriend(friendUid) {
    if (!code) return;
    setSending(`f-${friendUid}`);
    setSentOk(null);
    try {
      const dmId = await ensureDmChannel(uid, friendUid);
      const label = invite?.boundServerName || server.name;
      const text = `🎫 **${label}** — join with invite code:\n\`${code}\`\n\n(Paste the code in “Join Server”.)`;
      await sendDmMessage(dmId, { text, senderUsername: username });
      setSentOk(`f-${friendUid}`);
    } catch (e) {
      setSentOk(null);
    } finally {
      setSending(null);
    }
  }

  async function sendToGroup(groupId, groupName) {
    if (!code) return;
    setSending(`g-${groupId}`);
    setSentOk(null);
    try {
      const label = invite?.boundServerName || server.name;
      const text = `🎫 **${label}** — join with invite code:\n\`${code}\``;
      await sendGroupMessage(groupId, { text, senderUsername: username });
      setSentOk(`g-${groupId}`);
    } catch {
      setSentOk(null);
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal dc-share-invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>Share invite</h3>
          <button type="button" className="dc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dc-modal-body">
          <div className="dc-invite-server-scope">
            <span className="dc-invite-server-scope-label">Invite for</span>
            <span className="dc-invite-server-scope-name">{server.name}</span>
            <span className="dc-invite-server-scope-note">
              This code only joins this server — it cannot be used elsewhere.
            </span>
          </div>
          {loadErr && <div className="dc-modal-error">{loadErr}</div>}
          {codeLoading && (
            <div className="dc-share-invite-code-loading">
              <Loader2 className="spin" size={22} />
            </div>
          )}
          {!codeLoading && invite && (
            <div className="dc-share-invite-code-row" key={`${server.id}-${invite.code}`} aria-live="polite">
              <code className="dc-share-invite-code-value">{invite.code}</code>
            </div>
          )}
          {!codeLoading && invite && (
            <p className="dc-invite-firestore-bind dc-share-invite-bind">
              Joins <strong>{invite.boundServerName || server.name}</strong>
            </p>
          )}
          <div className="dc-share-invite-tabs">
            <button
              type="button"
              className={tab === 'friends' ? 'active' : ''}
              onClick={() => setTab('friends')}
            >
              <Users size={14} /> Friends
            </button>
            <button
              type="button"
              className={tab === 'groups' ? 'active' : ''}
              onClick={() => setTab('groups')}
            >
              <MessageSquare size={14} /> Group chats
            </button>
          </div>
          <div className="dc-share-invite-list">
            {tab === 'friends' && (
              friendUids.length === 0 ? (
                <p className="dc-modal-empty">No friends to share with yet.</p>
              ) : (
                friendUids.map((fuid) => {
                  const u = userCache[fuid];
                  const busy = sending === `f-${fuid}`;
                  const ok = sentOk === `f-${fuid}`;
                  return (
                    <div key={fuid} className="dc-share-invite-row">
                      <UserAvatar user={u} size={32} />
                      <span className="dc-share-invite-name">{u?.username || 'User'}</span>
                      <button
                        type="button"
                        className="dc-share-invite-send"
                        disabled={!code || busy}
                        onClick={() => sendToFriend(fuid)}
                      >
                        {busy ? <Loader2 size={14} className="spin" /> : ok ? 'Sent' : <><Send size={14} /> Send</>}
                      </button>
                    </div>
                  );
                })
              )
            )}
            {tab === 'groups' && (
              groupChats.length === 0 ? (
                <p className="dc-modal-empty">No group chats yet.</p>
              ) : (
                groupChats.map((g) => {
                  const busy = sending === `g-${g.id}`;
                  const ok = sentOk === `g-${g.id}`;
                  return (
                    <div key={g.id} className="dc-share-invite-row">
                      <div className="dc-share-invite-group-ico"><MessageSquare size={16} /></div>
                      <span className="dc-share-invite-name">{g.name}</span>
                      <button
                        type="button"
                        className="dc-share-invite-send"
                        disabled={!code || busy}
                        onClick={() => sendToGroup(g.id, g.name)}
                      >
                        {busy ? <Loader2 size={14} className="spin" /> : ok ? 'Sent' : <><Send size={14} /> Send</>}
                      </button>
                    </div>
                  );
                })
              )
            )}
          </div>
          <button type="button" className="dc-modal-cancel dc-share-invite-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
