import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings, Link2, Share2, Trash2, LogOut, Hash,
} from 'lucide-react';
import { isServerOwner } from '../../services/firestore';

/** ms before we listen for outside closes — avoids the same gesture / delayed synthetic events that opened the menu. */
const OUTSIDE_LISTENER_ARM_MS = 120;

/**
 * Anchored server actions menu. Outside-close uses a delayed capture-phase listener (not a full-screen
 * backdrop) so nothing invisible sits over the UI and races the opening click.
 */
export default function ServerActionMenu({
  anchorRect,
  server,
  uid,
  isDefaultCommunity,
  onClose,
  onOpenSettings,
  onOpenChannels,
  onCreateInvite,
  onShareInvite,
  onDeleteServer,
  onLeaveServer,
}) {
  const menuRef = useRef(null);
  const [placement, setPlacement] = useState({ top: 0, left: 0 });

  const isOwner = isServerOwner(server, uid);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let disarm = () => {};
    const armTimer = window.setTimeout(() => {
      const onPointerDownCapture = (e) => {
        const menu = menuRef.current;
        const node = e.target;
        if (!menu || !node || !(node instanceof Node)) return;
        if (menu.contains(node)) return;
        if (typeof node.closest === 'function') {
          if (node.closest('[data-server-rail]')) return;
          if (node.closest('[data-server-menu-trigger]')) return;
        }
        onClose();
      };
      window.addEventListener('pointerdown', onPointerDownCapture, true);
      disarm = () => window.removeEventListener('pointerdown', onPointerDownCapture, true);
    }, OUTSIDE_LISTENER_ARM_MS);

    return () => {
      clearTimeout(armTimer);
      disarm();
    };
  }, [onClose, server?.id]);

  useLayoutEffect(() => {
    if (!anchorRect || !menuRef.current) return;
    const el = menuRef.current;
    const pad = 12;
    const gap = 10;
    const mw = el.offsetWidth || 248;
    const mh = el.offsetHeight || 280;
    let left = anchorRect.left;
    let top = anchorRect.bottom + gap;
    left = Math.max(pad, Math.min(left, window.innerWidth - mw - pad));
    if (top + mh > window.innerHeight - pad) {
      top = Math.max(pad, anchorRect.top - mh - gap);
    }
    setPlacement({ top, left });
  }, [
    anchorRect?.top,
    anchorRect?.left,
    anchorRect?.bottom,
    anchorRect?.right,
    server?.id,
  ]);

  if (!anchorRect || !server) return null;

  const run = (fn, { ownerOnly = false, memberOnly = false } = {}) => {
    if (ownerOnly && !isOwner) return;
    if (memberOnly && !uid) return;
    fn();
    onClose();
  };

  const Item = ({ icon: Icon, label, onActivate, danger }) => (
    <button
      type="button"
      className={`dc-server-menu-item ${danger ? 'danger' : ''}`}
      role="menuitem"
      onClick={onActivate}
    >
      {Icon && <Icon size={17} strokeWidth={2} className="dc-server-menu-icon" aria-hidden />}
      <span className="dc-server-menu-item-label">{label}</span>
    </button>
  );

  return createPortal(
    <div
      ref={menuRef}
      className="dc-server-menu"
      style={{ top: placement.top, left: placement.left }}
      role="menu"
      aria-label={`${server.name} actions`}
    >
      <div className="dc-server-menu-header" role="presentation">
        <div className="dc-server-menu-header-avatar" aria-hidden>
          {server.icon ? (
            <img src={server.icon} alt="" className="dc-server-menu-header-img" />
          ) : (
            <span className="dc-server-menu-header-letter">
              {server.name?.charAt(0)?.toUpperCase() || 'S'}
            </span>
          )}
        </div>
        <div className="dc-server-menu-header-text">
          <div className="dc-server-menu-header-name">{server.name}</div>
          <div className={`dc-server-menu-header-role ${isOwner ? 'owner' : ''}`}>
            {isOwner ? 'You own this server' : 'Member'}
          </div>
        </div>
      </div>

      <div className="dc-server-menu-body">
        {isOwner && (
          <Item
            icon={Settings}
            label="Edit server"
            onActivate={() => run(onOpenSettings, { ownerOnly: true })}
          />
        )}

        <Item
          icon={Link2}
          label="Create invite"
          onActivate={() => run(onCreateInvite, { memberOnly: true })}
        />
        <Item
          icon={Share2}
          label="Share invite…"
          onActivate={() => run(onShareInvite, { memberOnly: true })}
        />

        {isOwner && (
          <>
            <div className="dc-server-menu-divider" role="separator" />
            <Item
              icon={Hash}
              label="Manage channels"
              onActivate={() => run(onOpenChannels, { ownerOnly: true })}
            />
          </>
        )}

        {isOwner && !isDefaultCommunity && (
          <>
            <div className="dc-server-menu-divider dc-server-menu-divider-loose" role="separator" />
            <Item
              icon={Trash2}
              label="Delete server"
              danger
              onActivate={() => run(onDeleteServer, { ownerOnly: true })}
            />
          </>
        )}

        {!isOwner && (
          <>
            <div className="dc-server-menu-divider dc-server-menu-divider-loose" role="separator" />
            <Item
              icon={LogOut}
              label="Leave server"
              danger
              onActivate={() => run(onLeaveServer, { memberOnly: true })}
            />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
