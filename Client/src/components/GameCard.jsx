import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { addRecentlyPlayed } from '../utils/api';
import FavoriteButton from './FavoriteButton';
import './GameCard.css';

const CATEGORY_COLORS = {
  Action: '#ef4444',
  Adventure: '#f59e0b',
  Horror: '#8b5cf6',
  '2 Player': '#22d3ee',
  Puzzle: '#34d399',
  Racing: '#f97316',
  Platformer: '#ec4899',
  Arcade: '#6366f1',
};

export default function GameCard({ game }) {
  const navigate = useNavigate();
  const color = CATEGORY_COLORS[game.category] || CATEGORY_COLORS.Arcade;
  const initials = game.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  function handlePlay() {
    addRecentlyPlayed(game);
    navigate(`/game/${game.id}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePlay();
    }
  }

  return (
    <div
      className="game-card glass-card game-card--flip3d"
      role="button"
      tabIndex={0}
      onClick={handlePlay}
      onKeyDown={handleKeyDown}
      aria-label={`Play ${game.name}`}
    >
      <div className="game-card-flip-inner">
        <div className="game-card-face game-card-face--front">
          <div className="game-card-thumb" style={{ '--card-accent': color }}>
            <span className="game-card-fav-slot" onClick={(e) => e.stopPropagation()}>
              <FavoriteButton kind="game" refId={game.id} meta={{ title: game.name, category: game.category }} />
            </span>
            <span className="game-card-initials">{initials}</span>
            <div className="game-card-play-overlay">
              <Play size={28} />
            </div>
          </div>
          <div className="game-card-info">
            <h4 className="game-card-title">{game.name}</h4>
            <span className="game-card-category" style={{ color }}>
              {game.category}
            </span>
          </div>
        </div>
        <div
          className="game-card-face game-card-face--back"
          style={{ '--card-accent': color }}
        >
          <Play size={40} strokeWidth={1.75} />
          <span className="game-card-back-label">Play Now</span>
          <span className="game-card-back-sub">{game.name}</span>
        </div>
      </div>
    </div>
  );
}
