import {
  useState, useEffect, useRef, useCallback, useLayoutEffect,
} from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Loader2 } from 'lucide-react';
import { apiJson } from '../services/apiClient';
import './NotificationBell.css';

function resolveNotificationHref(n) {
  const m = n.meta || {};
  if (typeof m.link === 'string' && m.link.startsWith('/')) return m.link;
  if (n.appealId) return '/appeal';
  if (n.type === 'friend_request' || n.type === 'friend_accept') return '/chat';
  return null;
}

/** Skip a visible refetch on open if a silent poll succeeded recently (saves duplicate GET). */
const FRESH_MS = 30_000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const dropRef = useRef(null);
  const lastSuccessAtRef = useRef(0);

  const unread = items.filter((n) => !n.read).length;

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    const force = Boolean(opts.force);
    if (!silent && !force) {
      const t = lastSuccessAtRef.current;
      if (t > 0 && Date.now() - t < FRESH_MS) {
        return;
      }
    }
    if (!silent) setLoading(true);
    try {
      const data = await apiJson('/api/notifications/me');
      setItems(data.notifications || []);
      lastSuccessAtRef.current = Date.now();
    } catch {
      setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ silent: true });
    const id = setInterval(() => load({ silent: true }), 90000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    load({ silent: false });
  }, [open, load]);

  useLayoutEffect(() => {
    const el = dropRef.current;
    if (!open || !el) {
      return undefined;
    }
    const pad = 12;
    const adjust = () => {
      const r = el.getBoundingClientRect();
      let tx = 0;
      if (r.right > window.innerWidth - pad) {
        tx += window.innerWidth - pad - r.right;
      }
      if (r.left + tx < pad) {
        tx += pad - (r.left + tx);
      }
      el.style.transform = tx ? `translate3d(${tx}px, 0, 0)` : '';
    };
    adjust();
    window.addEventListener('resize', adjust);
    return () => {
      window.removeEventListener('resize', adjust);
      el.style.transform = '';
    };
  }, [open, items.length, loading]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function markRead(id) {
    try {
      await apiJson(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      /* ignore */
    }
  }

  async function markAll() {
    try {
      await apiJson('/api/notifications/read-all', { method: 'POST' });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell-btn glass-bg"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={20} />
        {unread > 0 ? <span className="notif-bell-badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? (
        <div ref={dropRef} className="notif-dropdown glass-card">
          <div className="notif-dropdown-head">
            <span>Notifications</span>
            {items.some((n) => !n.read) ? (
              <button type="button" className="notif-mark-all" onClick={markAll}>
                <Check size={14} /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="notif-dropdown-body">
            {loading ? (
              <div className="notif-loading">
                <Loader2 className="spin" size={18} /> Loading…
              </div>
            ) : items.length === 0 ? (
              <p className="notif-empty">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => {
                const href = resolveNotificationHref(n);
                const textBlock = (
                  <div className="notif-item-text">
                    <strong>{n.title || 'Notice'}</strong>
                    {n.body ? <p>{n.body}</p> : null}
                    {n.createdAt ? (
                      <time className="notif-time">{new Date(n.createdAt).toLocaleString()}</time>
                    ) : null}
                  </div>
                );
                return (
                  <div
                    key={n.id}
                    className={`notif-item notif-item-row ${n.read ? 'notif-item--read' : ''}`}
                  >
                    {href ? (
                      <Link
                        to={href}
                        className="notif-item-link"
                        onClick={() => {
                          setOpen(false);
                          if (!n.read) markRead(n.id);
                        }}
                      >
                        {textBlock}
                      </Link>
                    ) : (
                      textBlock
                    )}
                    {!n.read ? (
                      <button type="button" className="notif-read-one" onClick={() => markRead(n.id)}>
                        Read
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <Link to="/settings" className="notif-footer-link" onClick={() => setOpen(false)}>
            Notification settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
