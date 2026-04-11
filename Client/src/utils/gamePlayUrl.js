/**
 * Game HTML sources:
 * - If VITE_GAMES_ON_HOSTING=true: always use same-origin /games/<file> (Firebase Hosting
 *   static copy from prebuild). This overrides Firestore playUrl when it points at the API
 *   /games/... URL — those responses are often Git LFS pointer stubs on App Hosting.
 * - Otherwise: external playUrl (itch, etc.), or API /games/<file>, or dev proxy /games/.
 */

/** Same rule as Server/routes/games.js — bundled UGS HTML at /games/<name>.html */
export function extractBundledHtmlFilenameFromUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return '';
  try {
    const u = new URL(urlString);
    const m = u.pathname.match(/\/games\/([^/]+)$/i);
    if (m && /\.html?$/i.test(m[1])) {
      return decodeURIComponent(m[1]);
    }
  } catch {
    /* ignore */
  }
  return '';
}

/**
 * Admin / Firestore: turn "https://api…/games/Foo.html" into "games/Foo.html"
 * so we store a path, not an absolute API URL (which serves LFS stubs on App Hosting).
 */
export function normalizeFirestoreGameUrlInput(raw) {
  const t = (raw || '').trim();
  if (!t) return '';
  if (!/^https?:\/\//i.test(t)) return t;
  const fname = extractBundledHtmlFilenameFromUrl(t);
  if (fname) return `games/${fname}`;
  return t;
}

export function getGamePlaySrc(game) {
  if (!game) return '';

  const hosting = import.meta.env.VITE_GAMES_ON_HOSTING === 'true';
  const file =
    (game.file && String(game.file).trim())
    || extractBundledHtmlFilenameFromUrl(game.playUrl || '');

  if (hosting && file) {
    return `/games/${encodeURIComponent(file)}`;
  }

  if (game.playUrl) return game.playUrl;

  if (!file) return '';

  const encoded = encodeURIComponent(file);
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (base) return `${base}/games/${encoded}`;
  return `/games/${encoded}`;
}
