import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft, Maximize, Minimize, ExternalLink } from 'lucide-react';
import { fetchGames } from '../utils/api';
import { getGamePlaySrc } from '../utils/gamePlayUrl';
import './GamePlayer.css';

export default function GamePlayer() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames()
      .then((games) => {
        const found = games.find((g) => g.id === gameId);
        setGame(found || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  function toggleFullscreen() {
    setFullscreen((f) => !f);
  }

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
    <div className={`game-player-page ${fullscreen ? 'fullscreen' : ''}`}>
      <div className="game-player-toolbar glass-bg">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          Back
        </button>
        <h3 className="game-player-title">{game.name}</h3>
        <div className="game-player-actions">
          <button className="btn btn-ghost" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <a
            href={gameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>
      <div className="game-player-frame-container">
        <iframe
          src={gameUrl}
          className="game-player-iframe"
          title={game.name}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          allowFullScreen
        />
      </div>
    </div>
  );
}
