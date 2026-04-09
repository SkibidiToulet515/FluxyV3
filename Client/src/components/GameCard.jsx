import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { addRecentlyPlayed } from '../utils/api';
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
    navigate(`/play/${game.id}`);
  }

  return (
    <div className="game-card glass-card" onClick={handlePlay}>
      <div className="game-card-thumb" style={{ '--card-accent': color }}>
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
  );
}
