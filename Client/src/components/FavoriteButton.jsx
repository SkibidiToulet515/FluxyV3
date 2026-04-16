import { Heart } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useLibrary } from '../contexts/LibraryContext';
import './FavoriteButton.css';

export default function FavoriteButton({
  kind = 'game',
  refId,
  meta = {},
  className = '',
  size = 18,
}) {
  const { user } = useAuth();
  const { isFavorite, toggleFavorite } = useLibrary();
  const on = Boolean(refId && isFavorite(kind, refId));

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    try {
      await toggleFavorite(kind, refId, meta);
    } catch {
      /* ignore */
    }
  }

  if (!user) return null;

  return (
    <button
      type="button"
      className={`favorite-btn ${on ? 'favorite-btn--on' : ''} ${className}`.trim()}
      onClick={toggle}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={on}
    >
      <Heart size={size} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
