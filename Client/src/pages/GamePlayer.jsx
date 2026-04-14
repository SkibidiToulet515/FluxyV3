import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Maximize, Minimize, ExternalLink } from 'lucide-react';
import { fetchGames } from '../utils/api';
import { getGamePlaySrc } from '../utils/gamePlayUrl';
import { useWindowMode } from '../hooks/useWindowMode';
import { useStandalonePageTitle } from '../hooks/useStandalonePageTitle';
import OpenInWindowButton from '../components/OpenInWindowButton';
import { gameStandalonePath } from '../standalone/paths';
import './GamePlayer.css';

export default function GamePlayer() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const isWindow = useWindowMode();
  const [game, setGame] = useState(null);
  const [isFs, setIsFs] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchGames()
      .then((games) => setGame(games.find((g) => g.id === gameId) || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  useStandalonePageTitle(game?.name, isWindow);

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
          <button className="btn btn-primary" onClick={() => navigate('/math')}>
            <ArrowLeft size={18} />
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  const gameUrl = getGamePlaySrc(game);
  const standalonePath = gameStandalonePath(game.id);

  return (
    <div className="game-player-page" ref={containerRef}>
      {!isWindow && (
        <div className="game-player-toolbar glass-bg">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            Back
          </button>
          <h3 className="game-player-title">{game.name}</h3>
          <div className="game-player-actions">
            <OpenInWindowButton path={standalonePath} iconOnly label="Open game in separate window" />
            <button className="btn btn-ghost" onClick={toggleFullscreen} title={isFs ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
            <a href={gameUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" title="Open in new tab">
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      )}
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
