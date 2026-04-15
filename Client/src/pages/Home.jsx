import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, Star, ArrowRight, Gamepad2, Globe } from 'lucide-react';
import Header from '../components/Header';
import GameCard from '../components/GameCard';
import GlitchText from '../components/GlitchText';
import { fetchGames, getRecentlyPlayed } from '../utils/api';
import { padGameRow, MOCK_FEATURED, MOCK_TRENDING } from '../data/mockHomeGames.js';
import { useInteractiveCardFx } from '../hooks/useInteractiveCardFx';
import { useMagneticButton } from '../hooks/useMagneticButton';
import { useRevealStagger } from '../hooks/useRevealStagger';
import './Home.css';

export default function Home() {
  const { onMenuToggle } = useOutletContext();
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const heroFx = useInteractiveCardFx();
  const gamesMagRef = useMagneticButton();
  const proxyMagRef = useMagneticButton();

  const recentReveal = useRevealStagger();
  const featuredReveal = useRevealStagger();
  const trendingReveal = useRevealStagger();

  useEffect(() => {
    fetchGames()
      .then(setGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const recentlyPlayed = getRecentlyPlayed();

  const featured = padGameRow(games.slice(0, 6), MOCK_FEATURED, 6);
  const trending = padGameRow(
    games.filter((_, i) => i % 7 === 0).slice(0, 8),
    MOCK_TRENDING,
    8,
  );

  const categoryGames = {};
  games.forEach((g) => {
    if (!categoryGames[g.category]) categoryGames[g.category] = [];
    if (categoryGames[g.category].length < 4) categoryGames[g.category].push(g);
  });

  return (
    <div className="home animate-fade-in">
      <Header title="Home" onMenuClick={onMenuToggle} />

      <section
        className="hero-banner glass-card fluxy-premium-surface"
        ref={heroFx.ref}
        onMouseMove={heroFx.onMouseMove}
        onMouseLeave={heroFx.onMouseLeave}
      >
        <div className="hero-content">
          <GlitchText as="h2" auto className="home-hero-glitch">
            Welcome to Fluxy
          </GlitchText>
          <p>Your premium learning hub with interactive content across every subject.</p>
          <div className="hero-actions">
            <button
              ref={gamesMagRef}
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/math')}
            >
              <Gamepad2 size={18} />
              Games
            </button>
            <button
              ref={proxyMagRef}
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/history')}
            >
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
          <div
            ref={recentReveal.ref}
            className={`game-grid reveal-group${recentReveal.visible || !loading ? ' reveal-group--visible' : ''}`}
          >
            {recentlyPlayed.slice(0, 6).map((game, i) => (
              <div key={game.id} className="reveal-item" style={{ '--stagger': i }}>
                <GameCard game={game} />
              </div>
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
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/math')}>
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
          <div
            ref={featuredReveal.ref}
            className={`game-grid reveal-group${featuredReveal.visible || !loading ? ' reveal-group--visible' : ''}`}
          >
            {featured.map((game, i) => (
              <div key={game.id} className="reveal-item" style={{ '--stagger': i }}>
                <GameCard game={game} />
              </div>
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
        {loading ? (
          <div className="loading-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card glass-card" />
            ))}
          </div>
        ) : (
          <div
            ref={trendingReveal.ref}
            className={`game-grid reveal-group${trendingReveal.visible || !loading ? ' reveal-group--visible' : ''}`}
          >
            {trending.map((game, i) => (
              <div key={game.id} className="reveal-item" style={{ '--stagger': i }}>
                <GameCard game={game} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
