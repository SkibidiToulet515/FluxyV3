/**
 * Game HTML is served by the Node server at /games/<file>.
 * In production the frontend is on Firebase Hosting, so use VITE_API_URL.
 */
export function getGamePlaySrc(game) {
  if (!game) return '';
  if (game.playUrl) return game.playUrl;
  const file = game.file || '';
  if (!file) return '';
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (base) return `${base}/games/${encodeURIComponent(file)}`;
  return `/games/${encodeURIComponent(file)}`;
}
