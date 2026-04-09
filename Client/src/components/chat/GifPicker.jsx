import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, AlertCircle, TrendingUp } from 'lucide-react';
import { fetchTrending, searchGifs } from '../../services/giphy';

export default function GifPicker({ open, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    setLoading(true);
    setError(null);
    try {
      const results = q.trim() ? await searchGifs(q) : await fetchTrending();
      setGifs(results);
    } catch (err) {
      setError(err.message);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    doSearch('');
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open, doSearch]);

  function handleInput(val) {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  }

  if (!open) return null;

  return (
    <div className="dc-gif-picker">
      <div className="dc-gif-header">
        <div className="dc-gif-search">
          <Search size={14} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search GIFs..."
            value={query}
            onChange={(e) => handleInput(e.target.value)}
          />
          {query && (
            <button
              className="dc-gif-clear"
              onClick={() => { setQuery(''); doSearch(''); }}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button className="dc-gif-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {!query && !loading && gifs.length > 0 && (
        <div className="dc-gif-trending-label">
          <TrendingUp size={13} />
          <span>Trending</span>
        </div>
      )}

      <div className="dc-gif-grid">
        {loading && (
          <div className="dc-gif-status">
            <Loader2 size={22} className="spin" />
            <span>Loading GIFs...</span>
          </div>
        )}
        {error && (
          <div className="dc-gif-status dc-gif-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && gifs.length === 0 && (
          <div className="dc-gif-status">
            <span>No GIFs found</span>
          </div>
        )}
        {!loading &&
          !error &&
          gifs.map((gif) => (
            <button
              key={gif.id}
              className="dc-gif-item"
              onClick={() => {
                onSelect({
                  id: gif.id,
                  title: gif.title,
                  url: gif.url,
                  preview: gif.preview,
                });
                onClose();
              }}
              title={gif.title}
            >
              <img
                src={gif.preview}
                alt={gif.title}
                loading="lazy"
                draggable={false}
              />
            </button>
          ))}
      </div>

      <div className="dc-gif-footer">
        <img
          src="https://giphy.com/static/img/giphy_logo_square_social.png"
          alt="Giphy"
          className="dc-giphy-attr-icon"
        />
        <span className="dc-giphy-attr-text">Powered by GIPHY</span>
      </div>
    </div>
  );
}
