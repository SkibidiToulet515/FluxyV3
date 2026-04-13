import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, Star, ArrowRight, Gamepad2, Globe } from 'lucide-react';
import Header from '../components/Header';
import GameCard from '../components/GameCard';
import { fetchGames, getRecentlyPlayed } from '../utils/api';
import './Home.css';

export default function Home() {
  const { onMenuToggle } = useOutletContext();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames()
      .then(setGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recentlyPlayed = getRecentlyPlayed();

  const featured = games.slice(0, 6);

  const trending = games
    .filter((_, i) => i % 7 === 0)
    .slice(0, 8);

  const categoryGames = {};
  games.forEach((g) => {
    if (!categoryGames[g.category]) categoryGames[g.category] = [];
    if (categoryGames[g.category].length < 4) categoryGames[g.category].push(g);
  });

  return (
    <div className="home animate-fade-in">
      <Header title="Home" onMenuClick={onMenuToggle} />

      <section className="hero-banner glass-card">
        <div className="hero-content">
          <h2>Welcome to Fluxy</h2>
          <p>Your premium learning hub with interactive content across every subject.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate('/math')}>
              <Gamepad2 size={18} />
              Games
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/proxy')}>
              <Globe size={18} />
              Proxy
            </button>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-number">{games.length.toLocaleString()}</span>
            <span className="stat-label">Games</span>
          </div>
          <div className="stat">
            <span className="stat-number">{Object.keys(categoryGames).length}</span>
            <span className="stat-label">Categories</span>
          </div>
          <div className="stat">
            <span className="stat-number">{recentlyPlayed.length}</span>
            <span className="stat-label">Played</span>
          </div>
        </div>
      </section>

      {recentlyPlayed.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <div className="section-title-row">
              <Clock size={20} />
              <h3>Recently Played</h3>
            </div>
          </div>
          <div className="game-grid">
            {recentlyPlayed.slice(0, 6).map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <div className="section-header">
          <div className="section-title-row">
            <Star size={20} />
            <h3>Featured</h3>
          </div>
          <button className="btn btn-ghost" onClick={() => navigate('/math')}>
            View All <ArrowRight size={16} />
          </button>
        </div>
        {loading ? (
          <div className="loading-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-card glass-card" />
            ))}
          </div>
        ) : (
          <div className="game-grid">
            {featured.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

      <section className="home-section">
        <div className="section-header">
          <div className="section-title-row">
            <TrendingUp size={20} />
            <h3>Trending</h3>
          </div>
        </div>
        {!loading && (
          <div className="game-grid">
            {trending.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
