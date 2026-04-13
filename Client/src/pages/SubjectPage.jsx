import { useState, useEffect, useMemo, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Filter, Zap } from 'lucide-react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import GameCard from '../components/GameCard';
import { fetchGames } from '../utils/api';
import './SubjectPage.css';

const PAGE_SIZE = 60;

export default function SubjectPage() {
  const { onMenuToggle } = useOutletContext();
  const [allGames, setAllGames] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    setVisibleCount(PAGE_SIZE);
    fetchGames()
      .then(setAllGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sortedGames = useMemo(() => {
    return [...allGames].sort((a, b) => {
      const ca = (a.category || '').localeCompare(b.category || '', undefined, {
        sensitivity: 'base',
      });
      if (ca !== 0) return ca;
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
  }, [allGames]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sortedGames;
    const q = search.toLowerCase();
    return sortedGames.filter(
      (g) =>
        g.name?.toLowerCase().includes(q) ||
        g.category?.toLowerCase().includes(q) ||
        (g.subject && g.subject.toLowerCase().includes(q)),
    );
  }, [sortedGames, search]);

  const visible = filtered.slice(0, visibleCount);
  const total = allGames.length;

  return (
    <div className="subject-page subject-page--catalog animate-fade-in">
      <section className="games-catalog-hero glass-card" aria-labelledby="games-catalog-heading">
        <div className="games-catalog-hero__glow" aria-hidden />
        <Header
          title="Games"
          titleId="games-catalog-heading"
          eyebrow="Fluxy library"
          onMenuClick={onMenuToggle}
          className="page-header--games-hero"
        />
        <div className="games-catalog-metrics">
          <div className="games-metric">
            <span className="games-metric__value">
              {loading ? '…' : total.toLocaleString()}
            </span>
            <span className="games-metric__label">Games</span>
          </div>
          <span className="games-metric-divider" aria-hidden />
          <div className="games-metric games-metric--accent">
            <span className="games-metric__value">0</span>
            <span className="games-metric__label">Delay</span>
          </div>
          <span className="games-metric-divider" aria-hidden />
          <div className="games-metric games-metric--wide">
            <Zap size={14} className="games-metric__icon" aria-hidden />
            <span className="games-metric__label games-metric__label--inline">Instant gameplay</span>
          </div>
        </div>
      </section>

      <div className="subject-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search games…" />
      </div>

      {loading ? (
        <div className="subject-loading">
          <div className="spinner" />
          <p>Loading games…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="subject-empty glass-card">
          <Filter size={40} />
          <h3>No games found</h3>
          <p>Try another search or check back later.</p>
        </div>
      ) : (
        <>
          <div className="subject-grid">
            {visible.map((game, i) => {
              const prev = i > 0 ? visible[i - 1] : null;
              const showCat =
                !prev || (prev.category || 'Other') !== (game.category || 'Other');
              return (
                <Fragment key={game.id || game.name}>
                  {showCat && (
                    <h3 className="subject-category-title">
                      {game.category || 'Other'}
                    </h3>
                  )}
                  <GameCard game={game} />
                </Fragment>
              );
            })}
          </div>
          {visibleCount < filtered.length && (
            <button
              className="btn btn-secondary subject-load-more"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
