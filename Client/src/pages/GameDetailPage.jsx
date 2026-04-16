import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Play, Star, Tag, Gamepad2, Sparkles, Link2, Check,
} from 'lucide-react';
import Header from '../components/Header';
import FavoriteButton from '../components/FavoriteButton';
import { SkeletonGrid, SkeletonRow } from '../components/ui/Skeleton';
import { fetchGames } from '../utils/api';
import { getMockGameById } from '../data/mockHomeGames.js';
import { fetchGameReviews, submitReview, deleteReview } from '../services/reviewsApi';
import { logActivity } from '../services/libraryFirestore';
import { auth } from '../services/firebase';
import { useAuth } from '../utils/AuthContext';
import { GAMES_CATALOG_PATH } from '../config/subjects';
import './GameDetailPage.css';

const REACTION_PRESETS = [
  { id: 'fun', label: 'Fun' },
  { id: 'laggy', label: 'Laggy' },
  { id: 'hard', label: 'Hard' },
  { id: 'good_with_friends', label: 'Good with friends' },
  { id: 'underrated', label: 'Underrated' },
];

export default function GameDetailPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [game, setGame] = useState(null);
  const [allGames, setAllGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ avg: null, count: 0 });
  const [revSort, setRevSort] = useState('recent');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const games = await fetchGames();
        if (cancelled) return;
        setAllGames(games);
        const found = games.find((g) => g.id === gameId) || getMockGameById(gameId);
        setGame(found || null);
        if (found) {
          logActivity({
            kind: 'game',
            refId: found.id,
            label: found.name,
            path: `/game/${found.id}`,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  async function loadReviews() {
    if (!gameId) return;
    const data = await fetchGameReviews(gameId, { sort: revSort, limit: 24 });
    setReviews(data.reviews || []);
    setSummary(data.summary || { avg: null, count: 0 });
  }

  useEffect(() => {
    loadReviews();
  }, [gameId, revSort]);

  const related = useMemo(() => {
    if (!game || !allGames.length) return [];
    return allGames
      .filter((g) => g.id !== game.id && g.category === game.category)
      .slice(0, 6);
  }, [game, allGames]);

  async function onSubmitReview(e) {
    e.preventDefault();
    if (!user || !gameId) return;
    setSubmitting(true);
    try {
      await submitReview(() => auth.currentUser?.getIdToken(), {
        gameId,
        rating,
        text,
        tags,
      });
      setText('');
      setTags([]);
      await loadReviews();
    } catch (err) {
      alert(err.message || 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteMine() {
    if (!gameId || !user) return;
    try {
      await deleteReview(() => auth.currentUser?.getIdToken(), gameId);
      await loadReviews();
    } catch (e) {
      alert(e.message || 'Failed');
    }
  }

  function toggleTag(id) {
    setTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 5),
    );
  }

  function copyGameLink() {
    if (!game?.id || typeof window === 'undefined') return;
    const url = `${window.location.origin}/game/${game.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div className="game-detail-page animate-fade-in">
        <Header title="Loading…" />
        <div className="game-detail-hero glass-card">
          <SkeletonRow wide />
          <SkeletonRow />
        </div>
        <SkeletonGrid count={4} />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="game-detail-page">
        <Header title="Not found" />
        <div className="game-detail-empty glass-card">
          <p>We couldn&apos;t find this title.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(GAMES_CATALOG_PATH)}>
            Browse games
          </button>
        </div>
      </div>
    );
  }

  const initials = game.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="game-detail-page animate-fade-in">
      <Header title={game.name} />

      <section className="game-detail-hero glass-card fluxy-premium-surface">
        <button type="button" className="game-detail-back btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="game-detail-hero-grid">
          <div className="game-detail-cover">
            <span className="game-detail-initials">{initials}</span>
            <div className="game-detail-cover-glow" />
          </div>
          <div className="game-detail-meta">
            <div className="game-detail-tags">
              <span className="game-detail-pill">
                <Tag size={14} /> {game.category}
              </span>
              {game.subject ? (
                <span className="game-detail-pill game-detail-pill--muted">{game.subject}</span>
              ) : null}
            </div>
            <h2 className="game-detail-title">{game.name}</h2>
            <p className="game-detail-desc">
              {game.description ||
                'Launch instantly in Fluxy’s player. Use fullscreen for the best experience.'}
            </p>
            <div className="game-detail-rating-line">
              <Star size={18} className="game-detail-star" />
              <strong>{summary.avg != null ? summary.avg.toFixed(1) : '—'}</strong>
              <span className="game-detail-muted">
                {summary.count ? `${summary.count} reviews` : 'No reviews yet'}
              </span>
            </div>
            <div className="game-detail-actions">
              <button
                type="button"
                className="btn btn-primary game-detail-play"
                onClick={() => navigate(`/play/${game.id}`)}
              >
                <Play size={20} /> Play now
              </button>
              <button
                type="button"
                className="btn btn-secondary game-detail-share"
                onClick={copyGameLink}
                title="Copy link to this page"
              >
                {linkCopied ? <Check size={18} /> : <Link2 size={18} />}
                {linkCopied ? 'Copied' : 'Copy link'}
              </button>
              <FavoriteButton
                kind="game"
                refId={game.id}
                meta={{ title: game.name, category: game.category }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="game-detail-section glass-card">
        <h3><Gamepad2 size={18} /> How to play</h3>
        <p className="game-detail-muted">
          Controls depend on the game. Click <strong>Play now</strong> to start. Use the toolbar for fullscreen
          or open in a new tab if the embed is blocked.
        </p>
      </section>

      <section className="game-detail-section glass-card">
        <div className="game-detail-section-head">
          <h3><Sparkles size={18} /> Reviews</h3>
          <select
            className="game-detail-select"
            value={revSort}
            onChange={(e) => setRevSort(e.target.value)}
            aria-label="Sort reviews"
          >
            <option value="recent">Newest</option>
            <option value="rating_high">Highest rated</option>
            <option value="rating_low">Lowest rated</option>
          </select>
        </div>
        {user ? (
          <form className="game-detail-review-form" onSubmit={onSubmitReview}>
            <div className="game-detail-stars-input">
              <span>Your rating</span>
              <div className="game-detail-star-btns">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={n <= rating ? 'active' : ''}
                    onClick={() => setRating(n)}
                  >
                    <Star size={20} fill={n <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="game-detail-textarea"
              rows={3}
              maxLength={2000}
              placeholder="Short review (optional)"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="game-detail-reactions">
              {REACTION_PRESETS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`game-detail-chip ${tags.includes(r.id) ? 'on' : ''}`}
                  onClick={() => toggleTag(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="game-detail-form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Post review'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={onDeleteMine}>
                Remove my review
              </button>
            </div>
          </form>
        ) : (
          <p className="game-detail-muted">Sign in to leave a review.</p>
        )}
        <ul className="game-detail-review-list">
          {reviews.length === 0 ? (
            <li className="game-detail-muted">No reviews yet — be the first.</li>
          ) : (
            reviews.map((r) => (
              <li key={r.id} className="game-detail-review-item">
                <div className="game-detail-review-top">
                  <span className="game-detail-review-author">{r.authorUsername || 'Member'}</span>
                  <span className="game-detail-review-stars">
                    <Star size={14} fill="currentColor" /> {r.rating}/5
                  </span>
                  <time>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}</time>
                </div>
                {r.text ? <p>{r.text}</p> : null}
                {r.tags?.length ? (
                  <div className="game-detail-review-tags">
                    {r.tags.map((t) => (
                      <span key={t}>{t.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      {related.length > 0 ? (
        <section className="game-detail-section">
          <h3 className="game-detail-related-title">Related in {game.category}</h3>
          <div className="game-detail-related-grid">
            {related.map((g) => (
              <Link key={g.id} to={`/game/${g.id}`} className="game-detail-related-card glass-card">
                <strong>{g.name}</strong>
                <span>{g.category}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
