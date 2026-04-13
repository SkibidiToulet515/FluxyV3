import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Plus, LogIn } from 'lucide-react';
import CreateServerModal from './CreateServerModal';
import JoinServerModal from './JoinServerModal';
import ServerListIcon from './ServerListIcon';
import ServerActionMenu from './ServerActionMenu';
import ServerSettingsModal from './ServerSettingsModal';
import InviteCodeModal from './InviteCodeModal';
import ShareInviteModal from './ShareInviteModal';
import {
  DEFAULT_SERVER_ID,
  deleteServer,
  leaveServer,
} from '../../services/firestore';

/** Plain rect for menu positioning (stable for effect deps; avoids DOMRect reference churn). */
function anchorFromElement(el) {
  if (!el?.getBoundingClientRect) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    bottom: r.bottom,
    right: r.right,
    width: r.width,
    height: r.height,
  };
}

function ConfirmModal({ title, message, confirmLabel, danger, busy, onConfirm, onClose }) {
  return (
    <div className="dc-modal-overlay" onClick={onClose}>
      <div className="dc-modal dc-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dc-modal-header">
          <h3>{title}</h3>
        </div>
        <div className="dc-modal-body">
          <p className="dc-confirm-text">{message}</p>
          <div className="dc-modal-actions dc-confirm-actions">
            <button type="button" className="dc-modal-cancel" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={danger ? 'dc-modal-submit dc-confirm-danger' : 'dc-modal-submit'}
              onClick={onConfirm}
              disabled={busy}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ServerSidebar({
  servers = [],
  activeServerId,
  onSelectServer,
  onSelectHome,
  uid,
  friends = [],
  groupChats = [],
  userCache = {},
  username = 'You',
  onAfterServerRemoved,
}) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  /** Rail action menu: independent from which server is the active chat view. */
  const [railMenu, setRailMenu] = useState(null);
  const [settings, setSettings] = useState(null);
  const [inviteModalServer, setInviteModalServer] = useState(null);
  const [inviteModalNonce, setInviteModalNonce] = useState(0);
  const [shareServer, setShareServer] = useState(null);
  const [shareModalNonce, setShareModalNonce] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const closeRailMenu = useCallback(() => setRailMenu(null), []);

  /**
   * Keep the server object from the click + merge live snapshot when available.
   * Do NOT derive menu only from servers.find — Firestore replaces the `servers` array often; a strict
   * effect that cleared railMenu on every snapshot was closing the menu immediately after open.
   */
  const menuServer = useMemo(() => {
    if (!railMenu?.server) return null;
    const live = servers.find((s) => s.id === railMenu.server.id);
    return live ?? railMenu.server;
  }, [railMenu, servers]);

  /** Snapshot server + anchor at click time so the menu always has a target even if `servers` flickers. */
  const openRailMenu = useCallback((server, anchorEl) => {
    const anchor = anchorFromElement(anchorEl);
    if (!anchor || !server?.id) return;
    setRailMenu({ server, anchor });
  }, []);

  const handleServerSelect = useCallback(
    (server) => {
      closeRailMenu();
      onSelectServer(server.id, server.channels?.[0]?.id || 'general');
    },
    [onSelectServer, closeRailMenu],
  );

  const handleOpenServerMenu = useCallback(
    (server, anchorEl) => {
      openRailMenu(server, anchorEl);
    },
    [openRailMenu],
  );

  const runDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setConfirmBusy(true);
    try {
      await deleteServer(confirmDelete.id);
      onAfterServerRemoved?.(confirmDelete.id);
      setConfirmDelete(null);
    } catch {
      /* noop */
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmDelete, onAfterServerRemoved]);

  const runLeave = useCallback(async () => {
    if (!confirmLeave || !uid) return;
    setConfirmBusy(true);
    try {
      await leaveServer(confirmLeave.id, uid);
      onAfterServerRemoved?.(confirmLeave.id);
      setConfirmLeave(null);
    } catch {
      /* noop */
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmLeave, uid, onAfterServerRemoved]);

  return (
    <div className="dc-server-bar" data-server-rail>
      <button
        type="button"
        className={`dc-server-logo ${!activeServerId ? 'active' : ''}`}
        title="Home"
        onClick={() => {
          closeRailMenu();
          onSelectHome();
        }}
      >
        <span>F</span>
      </button>
      <div className="dc-server-divider" />

      {servers.map((server) => (
        <ServerListIcon
          key={server.id}
          server={server}
          active={activeServerId === server.id}
          menuOpen={railMenu?.server?.id === server.id}
          onSelectServer={handleServerSelect}
          onOpenMenu={handleOpenServerMenu}
        />
      ))}

      <div className="dc-server-divider" />

      <button
        type="button"
        className="dc-server-icon"
        title="Create Server"
        onClick={() => {
          closeRailMenu();
          setShowCreate(true);
        }}
      >
        <span className="dc-server-pill" />
        <div className="dc-server-avatar dc-server-add"><Plus size={20} /></div>
      </button>

      <button
        type="button"
        className="dc-server-icon"
        title="Join Server"
        onClick={() => {
          closeRailMenu();
          setShowJoin(true);
        }}
      >
        <span className="dc-server-pill" />
        <div className="dc-server-avatar dc-server-add"><LogIn size={18} /></div>
      </button>

      <button
        type="button"
        className="dc-server-icon"
        onClick={() => {
          closeRailMenu();
          navigate('/');
        }}
        title="Back to Dashboard"
      >
        <span className="dc-server-pill" />
        <div className="dc-server-avatar"><Home size={20} /></div>
      </button>

      {railMenu && menuServer && (
        <ServerActionMenu
          anchorRect={railMenu.anchor}
          server={menuServer}
          uid={uid}
          isDefaultCommunity={menuServer.id === DEFAULT_SERVER_ID}
          onClose={closeRailMenu}
          onOpenSettings={() => setSettings({ server: menuServer, tab: 'general' })}
          onOpenChannels={() => setSettings({ server: menuServer, tab: 'channels' })}
          onCreateInvite={() => {
            setInviteModalServer(menuServer);
            setInviteModalNonce((n) => n + 1);
          }}
          onShareInvite={() => {
            setShareServer(menuServer);
            setShareModalNonce((n) => n + 1);
          }}
          onDeleteServer={() => setConfirmDelete(menuServer)}
          onLeaveServer={() => setConfirmLeave(menuServer)}
        />
      )}

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} uid={uid} />}
      {showJoin && (
        <JoinServerModal
          uid={uid}
          onClose={() => setShowJoin(false)}
          onJoined={(serverId) => onSelectServer(serverId, 'general')}
        />
      )}
      {settings && (
        <ServerSettingsModal
          key={`${settings.server.id}-${settings.tab}`}
          server={settings.server}
          initialTab={settings.tab}
          onClose={() => setSettings(null)}
        />
      )}
      {inviteModalServer && (
        <InviteCodeModal
          key={`${inviteModalServer.id}-${inviteModalNonce}`}
          server={inviteModalServer}
          onClose={() => setInviteModalServer(null)}
        />
      )}
      {shareServer && (
        <ShareInviteModal
          key={`${shareServer.id}-${shareModalNonce}`}
          server={shareServer}
          friends={friends}
          groupChats={groupChats}
          userCache={userCache}
          uid={uid}
          username={username}
          onClose={() => setShareServer(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Delete server permanently?"
          message="This cannot be undone. All channel messages will become unreachable from the app until cleaned up in Firebase. Members will lose access."
          confirmLabel="Delete server"
          danger
          busy={confirmBusy}
          onClose={() => !confirmBusy && setConfirmDelete(null)}
          onConfirm={runDelete}
        />
      )}
      {confirmLeave && (
        <ConfirmModal
          title="Leave this server?"
          message={`You will need a new invite to rejoin ${confirmLeave.name}.`}
          confirmLabel="Leave server"
          danger
          busy={confirmBusy}
          onClose={() => !confirmBusy && setConfirmLeave(null)}
          onConfirm={runLeave}
        />
      )}
    </div>
  );
}
