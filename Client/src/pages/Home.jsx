import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp, Clock, Star, ArrowRight, Gamepad2, Globe, Sparkles, Heart, Layers,
} from 'lucide-react';
import Header from '../components/Header';
import GameCard from '../components/GameCard';
import GlitchText from '../components/GlitchText';
import { fetchGames, getRecentlyPlayed } from '../utils/api';
import { padGameRow, MOCK_FEATURED, MOCK_TRENDING } from '../data/mockHomeGames.js';
import { subscribeActivityLog } from '../services/libraryFirestore';
import { useAuth } from '../utils/AuthContext';
import { useLibrary } from '../contexts/LibraryContext';
import PageSection from '../components/ui/PageSection';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { useInteractiveCardFx } from '../hooks/useInteractiveCardFx';
import { useMagneticButton } from '../hooks/useMagneticButton';
import { useRevealStagger } from '../hooks/useRevealStagger';
import { GAMES_CATALOG_PATH } from '../config/subjects';
import DailyInclidesCard from '../components/inclides/DailyInclidesCard';
import './Home.css';

const DEFAULT_HOME_SECTION_ORDER = [
  'continue', 'recent', 'featured', 'trending', 'recommended', 'favorites', 'new',
];

export default function Home() {
  const { onMenuToggle } = useOutletContext();
  const navigate = useNavigate();
  const { user, account } = useAuth();
  const { favorites } = useLibrary();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [cms, setCms] = useState(null);

  const heroFx = useInteractiveCardFx();
  const gamesMagRef = useMagneticButton();
  const proxyMagRef = useMagneticButton();

  const recentReveal = useRevealStagger();
  const featuredReveal = useRevealStagger();
  const trendingReveal = useRevealStagger();
  const favReveal = useRevealStagger();
  const newReveal = useRevealStagger();

  const sectionOrder = useMemo(() => {
    const hidden = new Set(cms?.hiddenSections || []);
    const raw = Array.isArray(cms?.sectionOrder) && cms.sectionOrder.length
      ? cms.sectionOrder
      : DEFAULT_HOME_SECTION_ORDER;
    return raw.filter((id) => id && !hidden.has(id));
  }, [cms]);

  useEffect(() => {
    fetchGames()
      .then(setGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    if (!base) return;
    fetch(`${base}/api/cms/homepage`)
      .then((r) => r.json())
      .then((d) => setCms(d.config || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setActivity([]);
      return undefined;
    }
    return subscribeActivityLog(setActivity, 24);
  }, [user]);

  const gamesById = useMemo(() => {
    const m = {};
    games.forEach((g) => {
      m[g.id] = g;
    });
    return m;
  }, [games]);

  const recentlyPlayed = getRecentlyPlayed();
  const continuePlaying = useMemo(() => {
    const list = recentlyPlayed.slice(0, 8).map((g) => gamesById[g.id] || g);
    return list.filter(Boolean);
  }, [recentlyPlayed, gamesById]);

  const recentlyUsed = useMemo(() => {
    if (!activity.length) return [];
    return activity
      .filter((a) => a.kind === 'game' && a.refId)
      .map((a) => gamesById[a.refId])
      .filter(Boolean)
      .slice(0, 8);
  }, [activity, gamesById]);

  const trending = useMemo(() => {
    const sorted = [...games].sort((a, b) => (b.plays || 0) - (a.plays || 0));
    return padGameRow(sorted.slice(0, 8), MOCK_TRENDING, 8);
  }, [games]);

  const featured = useMemo(() => {
    const ids = cms?.featuredIds;
    if (Array.isArray(ids) && ids.length) {
      const picked = ids.map((id) => gamesById[id]).filter(Boolean);
      if (picked.length) return padGameRow(picked.slice(0, 8), MOCK_FEATURED, 6);
    }
    return padGameRow(games.slice(0, 6), MOCK_FEATURED, 6);
  }, [games, gamesById, cms]);

  const recommended = useMemo(() => {
    const seed = continuePlaying[0]?.category || games[0]?.category;
    if (!seed) return games.slice(0, 6);
    const pool = games.filter((g) => g.category === seed && !continuePlaying.find((c) => c.id === g.id));
    return pool.slice(0, 6).length ? pool.slice(0, 6) : games.slice(0, 6);
  }, [games, continuePlaying]);

  const favoriteGames = useMemo(() => {
    return favorites
      .filter((f) => f.kind === 'game')
      .map((f) => gamesById[f.refId])
      .filter(Boolean)
      .slice(0, 8);
  }, [favorites, gamesById]);

  const newest = useMemo(() => {
    if (!games.length) return [];
    return games.filter((_, i) => i % 7 === 3).slice(0, 8).length
      ? games.filter((_, i) => i % 7 === 3).slice(0, 8)
      : games.slice(0, 8);
  }, [games]);

  const categoryGames = {};
  games.forEach((g) => {
    if (!categoryGames[g.category]) categoryGames[g.category] = [];
    if (categoryGames[g.category].length < 4) categoryGames[g.category].push(g);
  });

  const heroLine = account?.username
    ? `Hey, ${account.username} — jump back in or explore something new.`
    : 'Your premium learning hub with interactive content across every subject.';

  function renderSection(sectionId) {
    if ((sectionId === 'recent' || sectionId === 'favorites') && !user) return null;

    switch (sectionId) {
      case 'continue':
        return (
          <PageSection
            key="continue"
            title="Continue playing"
            icon={Gamepad2}
            empty={!continuePlaying.length ? 'Launch a game from the catalog — we’ll track it here on this device.' : null}
          >
            {continuePlaying.length > 0 ? (
              <div
                ref={recentReveal.ref}
                className={`game-grid reveal-group${recentReveal.visible || !loading ? ' reveal-group--visible' : ''}`}
              >
                {continuePlaying.map((game, i) => (
                  <div key={game.id} className="reveal-item" style={{ '--stagger': i }}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            ) : null}
          </PageSection>
        );
      case 'recent':
        return (
          <PageSection
            key="recent"
            title="Recently used"
            icon={Layers}
            empty={!recentlyUsed.length ? 'Browse games or tools — recent activity will sync when you’re signed in.' : null}
          >
            {recentlyUsed.length > 0 ? (
              <div className="game-grid reveal-group reveal-group--visible">
                {recentlyUsed.map((game, i) => (
                  <div key={`${game.id}-ru`} className="reveal-item" style={{ '--stagger': i }}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            ) : null}
          </PageSection>
        );
      case 'featured':
        return (
          <PageSection
            key="featured"
            title="Featured"
            icon={Star}
            action={
              <button type="button" className="btn btn-ghost" onClick={() => navigate(GAMES_CATALOG_PATH)}>
                View All <ArrowRight size={16} />
              </button>
            }
          >
            {loading ? (
              <SkeletonGrid count={6} />
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
          </PageSection>
        );
      case 'trending':
        return (
          <PageSection key="trending" title="Trending on Fluxy" icon={TrendingUp}>
            {loading ? (
              <SkeletonGrid count={8} />
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
          </PageSection>
        );
      case 'recommended':
        return (
          <PageSection
            key="recommended"
            title="Recommended for you"
            icon={Sparkles}
            empty={!recommended.length ? 'Loading recommendations…' : null}
          >
            {!loading && recommended.length > 0 ? (
              <div className="game-grid reveal-group reveal-group--visible">
                {recommended.map((game, i) => (
                  <div key={`${game.id}-rec`} className="reveal-item" style={{ '--stagger': i }}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            ) : null}
          </PageSection>
        );
      case 'favorites':
        return (
          <PageSection
            key="favorites"
            title="Favorites"
            icon={Heart}
            action={
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/library')}>
                Library <ArrowRight size={16} />
              </button>
            }
            empty={!favoriteGames.length ? 'Tap the heart on cards to save games here.' : null}
          >
            {favoriteGames.length > 0 ? (
              <div
                ref={favReveal.ref}
                className={`game-grid reveal-group${favReveal.visible || !loading ? ' reveal-group--visible' : ''}`}
              >
                {favoriteGames.map((game, i) => (
                  <div key={`${game.id}-fav`} className="reveal-item" style={{ '--stagger': i }}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            ) : null}
          </PageSection>
        );
      case 'new':
        return (
          <PageSection key="new" title="New & updated" icon={Clock}>
            {loading ? (
              <SkeletonGrid count={8} />
            ) : (
              <div
                ref={newReveal.ref}
                className={`game-grid reveal-group${newReveal.visible || !loading ? ' reveal-group--visible' : ''}`}
              >
                {newest.map((game, i) => (
                  <div key={`${game.id}-new`} className="reveal-item" style={{ '--stagger': i }}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            )}
          </PageSection>
        );
      default:
        return null;
    }
  }

  return (
    <div className="home animate-fade-in">
      <Header title="Home" onMenuClick={onMenuToggle} />

      {user ? <DailyInclidesCard /> : null}

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
          <p>{heroLine}</p>
          <div className="hero-actions">
            <button
              ref={gamesMagRef}
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(GAMES_CATALOG_PATH)}
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

      {user ? (
        <nav className="home-quick-strip glass-card" aria-label="Quick links">
          <Link to="/library">Library</Link>
          <Link to="/chat">Chat</Link>
          <Link to="/profile">Profile</Link>
          <Link to={GAMES_CATALOG_PATH}>Catalog</Link>
        </nav>
      ) : null}

      {sectionOrder.map((id) => renderSection(id))}
    </div>
  );
}
