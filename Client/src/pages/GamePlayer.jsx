import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Maximize, Minimize, ExternalLink } from 'lucide-react';
import { fetchGames } from '../utils/api';
import { getGamePlaySrc } from '../utils/gamePlayUrl';
import './GamePlayer.css';

const GAME_NATIVE_W = 960;
const GAME_NATIVE_H = 540;

export default function GamePlayer() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const iframeRef = useRef(null);

  const scaleIframe = useCallback(() => {
    const container = iframeRef.current?.parentElement;
    const iframe = iframeRef.current;
    if (!container || !iframe) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;

    const scale = Math.min(cw / GAME_NATIVE_W, ch / GAME_NATIVE_H);
    iframe.style.width = `${GAME_NATIVE_W}px`;
    iframe.style.height = `${GAME_NATIVE_H}px`;
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top left';
    iframe.style.position = 'absolute';
    iframe.style.top = `${(ch - GAME_NATIVE_H * scale) / 2}px`;
    iframe.style.left = `${(cw - GAME_NATIVE_W * scale) / 2}px`;
  }, []);

  useEffect(() => {
    fetchGames()
      .then((games) => setGame(games.find((g) => g.id === gameId) || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  useEffect(() => {
    function onFsChange() {
      setIsFs(Boolean(document.fullscreenElement));
      requestAnimationFrame(scaleIframe);
    }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [scaleIframe]);

  useEffect(() => {
    if (!game) return;
    scaleIframe();
    window.addEventListener('resize', scaleIframe);
    return () => window.removeEventListener('resize', scaleIframe);
  }, [game, scaleIframe]);

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
          <p>The game you're looking for doesn't exist.</p>
          <button className="btn btn-primary" onClick={() => navigate('/games')}>
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
          ref={iframeRef}
          src={gameUrl}
          className="game-player-iframe"
          title={game.name}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
          allowFullScreen
          scrolling="no"
          onLoad={scaleIframe}
        />
      </div>
    </div>
  );
}
