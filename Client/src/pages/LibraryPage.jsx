import { useState, useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Heart, FolderPlus, Trash2, GripVertical } from 'lucide-react';
import Header from '../components/Header';
import GameCard from '../components/GameCard';
import { fetchGames } from '../utils/api';
import {
  createCollection,
  deleteCollection,
  saveCollectionItems,
} from '../services/libraryFirestore';
import { useLibrary } from '../contexts/LibraryContext';
import './LibraryPage.css';

export default function LibraryPage() {
  const { onMenuToggle } = useOutletContext();
  const { favorites, collections } = useLibrary();
  const [gamesById, setGamesById] = useState({});
  const [newName, setNewName] = useState('');
  const [activeCol, setActiveCol] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchGames().then((games) => {
      if (cancelled) return;
      const map = {};
      games.forEach((g) => {
        map[g.id] = g;
      });
      setGamesById(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function addCollection() {
    const name = newName.trim() || 'New collection';
    await createCollection({ name });
    setNewName('');
  }

  const favoriteGames = favorites
    .filter((f) => f.kind === 'game' && f.refId)
    .map((f) => gamesById[f.refId])
    .filter(Boolean);

  return (
    <div className="library-page animate-fade-in">
      <Header title="Library" onMenuClick={onMenuToggle} />

      <section className="library-section glass-card">
        <div className="library-section-head">
          <h2><Heart size={20} /> Favorites</h2>
          <p className="library-muted">Games and tools you&apos;ve starred across Fluxy.</p>
        </div>
        {favoriteGames.length === 0 ? (
          <p className="library-empty">No favorites yet. Tap the heart on a game card or detail page.</p>
        ) : (
          <div className="library-game-grid">
            {favoriteGames.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        )}
      </section>

      <section className="library-section glass-card">
        <div className="library-section-head">
          <h2><FolderPlus size={20} /> Collections</h2>
          <p className="library-muted">Group titles for school, multiplayer nights, or tools.</p>
        </div>
        <div className="library-create-row">
          <input
            className="library-input"
            placeholder="New collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
          />
          <button type="button" className="btn btn-primary" onClick={addCollection}>
            Create
          </button>
        </div>
        {collections.length === 0 ? (
          <p className="library-empty">Create a collection to organize favorites.</p>
        ) : (
          <div className="library-collections">
            {collections.map((col) => (
              <div key={col.id} className="library-collection glass-card">
                <div className="library-collection-top">
                  <button
                    type="button"
                    className={`library-collection-title ${activeCol === col.id ? 'open' : ''}`}
                    onClick={() => setActiveCol((c) => (c === col.id ? null : col.id))}
                  >
                    <GripVertical size={16} className="library-grip" />
                    <span style={{ color: col.color || '#a5b4fc' }}>{col.name}</span>
                  </button>
                  <button
                    type="button"
                    className="library-icon-btn"
                    title="Delete collection"
                    onClick={() => {
                      if (window.confirm('Delete this collection? Items stay in your favorites.')) {
                        deleteCollection(col.id);
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {activeCol === col.id ? (
                  <CollectionEditor
                    col={col}
                    gamesById={gamesById}
                    favorites={favorites}
                    onSave={(items) => saveCollectionItems(col.id, items)}
                  />
                ) : (
                  <p className="library-muted small">
                    {(col.items || []).length} item{(col.items || []).length === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CollectionEditor({ col, gamesById, favorites, onSave }) {
  const gameFavorites = favorites.filter((f) => f.kind === 'game');
  function addFromFavorites(gameId) {
    const items = [...(col.items || [])];
    if (items.some((i) => i.kind === 'game' && i.id === gameId)) return;
    const g = gamesById[gameId];
    items.push({
      kind: 'game',
      id: gameId,
      order: items.length,
      title: g?.name || gameId,
    });
    onSave(items);
  }
  function removeAt(idx) {
    const items = [...(col.items || [])];
    items.splice(idx, 1);
    onSave(items);
  }
  return (
    <div className="library-collection-body">
      <p className="library-muted small">Add from your game favorites</p>
      <div className="library-pick-list">
        {gameFavorites.length === 0 ? (
          <span className="library-muted">Favorite some games first.</span>
        ) : (
          gameFavorites.map((f) => (
            <button
              key={f.refId}
              type="button"
              className="library-pick-chip"
              onClick={() => addFromFavorites(f.refId)}
            >
              + {f.title || f.refId}
            </button>
          ))
        )}
      </div>
      <ul className="library-collection-items">
        {(col.items || []).map((item, idx) => (
          <li key={`${item.kind}-${item.id}-${idx}`}>
            <Link to={item.kind === 'game' ? `/game/${item.id}` : '/'}>
              {item.title || item.id}
            </Link>
            <button type="button" className="library-icon-btn" onClick={() => removeAt(idx)}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
