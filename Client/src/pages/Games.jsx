import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Filter } from 'lucide-react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import GameCard from '../components/GameCard';
import { fetchGames } from '../utils/api';
import './Games.css';

const CATEGORIES = [
  'All',
  'Action',
  'Adventure',
  'Arcade',
  'Horror',
  '2 Player',
  'Puzzle',
  'Racing',
  'Platformer',
];

const PAGE_SIZE = 60;

export default function Games() {
  const { onMenuToggle } = useOutletContext();
  const [allGames, setAllGames] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchGames()
      .then(setAllGames)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = allGames;
    if (category !== 'All') {
      result = result.filter((g) => g.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((g) => g.name.toLowerCase().includes(q));
    }
    return result;
  }, [allGames, search, category]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, category]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="games-page animate-fade-in">
      <Header title="Games" onMenuClick={onMenuToggle}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search games..."
        />
      </Header>

      <div className="category-filters">
        <Filter size={16} className="filter-icon" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`category-chip ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="games-meta">
        <span className="games-count">
          {filtered.length.toLocaleString()} game{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="games-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-card glass-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="games-empty glass-card">
          {allGames.length === 0 ? (
            <>
              <p>No games are available yet.</p>
              <p className="games-empty-hint">
                Add HTML games under <code>Client/UGS Files</code> (served by the API server), or add entries in the
                Admin panel with a full <code>https://</code> game URL.
              </p>
            </>
          ) : (
            <p>No games found matching your search.</p>
          )}
        </div>
      ) : (
        <>
          <div className="games-grid">
            {visible.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          {hasMore && (
            <div className="load-more-row">
              <button
                className="btn btn-secondary"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Load More ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
