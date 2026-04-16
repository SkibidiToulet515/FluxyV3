import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Heart, Clock, FolderOpen, Settings, User, X, MessageCircle, Gamepad2,
} from 'lucide-react';
import { getRecentlyPlayed } from '../utils/api';
import { useAuth } from '../utils/AuthContext';
import { GAMES_CATALOG_PATH } from '../config/subjects';
import './QuickLauncher.css';

export default function QuickLauncher() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const nav = useNavigate();
  const panelRef = useRef(null);

  const recent = getRecentlyPlayed().slice(0, 5);

  useEffect(() => {
    function onToggleKey(e) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onToggleKey);
    return () => window.removeEventListener('keydown', onToggleKey);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e) {
      if (!panelRef.current?.contains(e.target)) setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', onKey);
      document.addEventListener('mousedown', onClick);
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className="quick-launcher" ref={panelRef}>
      <button
        type="button"
        className="quick-launcher-fab glass-bg"
        onClick={() => setOpen((o) => !o)}
        title="Quick launcher (Ctrl+Shift+L)"
        aria-expanded={open}
      >
        <Zap size={22} />
      </button>
      {open ? (
        <div className="quick-launcher-panel glass-card">
          <div className="quick-launcher-head">
            <span>Quick access</span>
            <button type="button" className="quick-launcher-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </div>
          <nav className="quick-launcher-links">
            <Link to="/library" onClick={() => setOpen(false)}>
              <Heart size={16} /> Favorites &amp; collections
            </Link>
            {user ? (
              <Link to="/chat" onClick={() => setOpen(false)}>
                <MessageCircle size={16} /> Chat
              </Link>
            ) : null}
            <Link to={GAMES_CATALOG_PATH} onClick={() => setOpen(false)}>
              <Gamepad2 size={16} /> Catalog
            </Link>
            <Link to="/" onClick={() => setOpen(false)}>
              <Clock size={16} /> Home
            </Link>
            {user ? (
              <Link to="/profile" onClick={() => setOpen(false)}>
                <User size={16} /> Profile
              </Link>
            ) : null}
            <Link to="/settings" onClick={() => setOpen(false)}>
              <Settings size={16} /> Settings
            </Link>
          </nav>
          {recent.length > 0 ? (
            <div className="quick-launcher-recent">
              <div className="quick-launcher-sub">
                <FolderOpen size={14} /> Recently played
              </div>
              <ul>
                {recent.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        nav(`/game/${g.id}`);
                      }}
                    >
                      {g.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="quick-launcher-empty">Play a game to see recents here.</p>
          )}
          <p className="quick-launcher-hint">
            Toggle anywhere: <kbd className="quick-launcher-kbd">Ctrl</kbd>
            <span className="quick-launcher-kbd-plus">+</span>
            <kbd className="quick-launcher-kbd">Shift</kbd>
            <span className="quick-launcher-kbd-plus">+</span>
            <kbd className="quick-launcher-kbd">L</kbd>
          </p>
        </div>
      ) : null}
    </div>
  );
}
