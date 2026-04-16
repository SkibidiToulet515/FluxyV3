import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Maximize, Minimize, ExternalLink } from 'lucide-react';
import { fetchGames, addRecentlyPlayed } from '../utils/api';
import { getMockGameById } from '../data/mockHomeGames.js';
import { getGamePlaySrc } from '../utils/gamePlayUrl';
import { auth } from '../services/firebase';
import { logActivity } from '../services/libraryFirestore';
import { GAMES_CATALOG_PATH } from '../config/subjects';
import './GamePlayer.css';

export default function GamePlayer() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchGames()
      .then(async (games) => {
        const found = games.find((g) => g.id === gameId);
        const g = found || getMockGameById(gameId) || null;
        if (cancelled) return;
        setGame(g);
        if (g) {
          addRecentlyPlayed(g);
          logActivity({
            kind: 'game',
            refId: g.id,
            label: g.name,
            path: `/play/${g.id}`,
          });
          const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
          if (base) {
            const headers = { 'Content-Type': 'application/json' };
            if (auth.currentUser) {
              try {
                headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
              } catch {
                /* ignore */
              }
            }
            fetch(`${base}/api/analytics/play`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ gameId: g.id }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {
        if (!cancelled) setGame(getMockGameById(gameId) || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  useEffect(() => {
    function onFsChange() {
      setIsFs(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  if (loading) {
    return (
      <div className="game-player-page">
        <div className="game-player-loading">Loading...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-player-page">
        <div className="game-player-not-found glass-card">
          <h2>Game Not Found</h2>
          <p>The game you&apos;re looking for doesn&apos;t exist.</p>
          <button className="btn btn-primary" onClick={() => navigate(GAMES_CATALOG_PATH)}>
            <ArrowLeft size={18} />
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const gameUrl = getGamePlaySrc(game);

  return (
    <div className="game-player-page" ref={containerRef}>
      <div className="game-player-toolbar glass-bg">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>
        <h3 className="game-player-title">{game.name}</h3>
        <div className="game-player-actions">
          <button className="btn btn-ghost" onClick={toggleFullscreen} title={isFs ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <a href={gameUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" title="Open in new tab">
            <ExternalLink size={18} />
          </a>
        </div>
      </div>
      <div className="game-player-frame-container">
        <iframe
          src={gameUrl}
          className="game-player-iframe"
          title={game.name}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          allowFullScreen
        />
      </div>
    </div>
  );
}
