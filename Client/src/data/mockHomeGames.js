/**
 * Placeholder catalog when the games API returns nothing or fails.
 * Home also pads Featured / Trending rows if the live list is short.
 * Files live in Client/public/games/fluxy-mock-*.html (kept by syncUgsToPublic.mjs).
 */

const FILES = ['fluxy-mock-snake.html', 'fluxy-mock-pong.html', 'fluxy-mock-reflex.html'];

function pickFile(i) {
  return FILES[i % FILES.length];
}

export const MOCK_FEATURED = [
  { id: 'mock-feat-1', name: 'Cosmic Drift', file: pickFile(0), category: 'Racing', subject: 'math', playUrl: null },
  { id: 'mock-feat-2', name: 'Pixel Panic', file: pickFile(1), category: 'Arcade', subject: 'math', playUrl: null },
  { id: 'mock-feat-3', name: 'Orb Runner', file: pickFile(2), category: 'Platformer', subject: 'math', playUrl: null },
  { id: 'mock-feat-4', name: 'Neon Stack', file: pickFile(3), category: 'Puzzle', subject: 'math', playUrl: null },
  { id: 'mock-feat-5', name: 'Gravity Well', file: pickFile(4), category: 'Arcade', subject: 'science', playUrl: null },
  { id: 'mock-feat-6', name: 'Turbo Maze', file: pickFile(5), category: 'Puzzle', subject: 'math', playUrl: null },
];

export const MOCK_TRENDING = [
  { id: 'mock-trend-1', name: 'Solar Sprint', file: pickFile(0), category: 'Racing', subject: 'science', playUrl: null },
  { id: 'mock-trend-2', name: 'Void Hopper', file: pickFile(1), category: 'Platformer', subject: 'math', playUrl: null },
  { id: 'mock-trend-3', name: 'Crystal Cascade', file: pickFile(2), category: 'Puzzle', subject: 'math', playUrl: null },
  { id: 'mock-trend-4', name: 'Hyper Blocks', file: pickFile(3), category: 'Arcade', subject: 'math', playUrl: null },
  { id: 'mock-trend-5', name: 'Star Forge', file: pickFile(4), category: 'Action', subject: 'science', playUrl: null },
  { id: 'mock-trend-6', name: 'Lunar Lander', file: pickFile(5), category: 'Arcade', subject: 'science', playUrl: null },
  { id: 'mock-trend-7', name: 'Quantum Flip', file: pickFile(6), category: 'Puzzle', subject: 'math', playUrl: null },
  { id: 'mock-trend-8', name: 'Echo Arena', file: pickFile(7), category: '2 Player', subject: 'math', playUrl: null },
];

const byId = new Map();
for (const g of [...MOCK_FEATURED, ...MOCK_TRENDING]) {
  byId.set(g.id, g);
}

/** Full fallback list for fetchGames when API is empty or unreachable. */
export const ALL_MOCK_GAMES = [...byId.values()];

export function getMockGameById(id) {
  return byId.get(id) || null;
}

/** Pad `list` with entries from `mocks` until length `target` (dedupe by id). */
export function padGameRow(list, mocks, target) {
  if (list.length >= target) return list.slice(0, target);
  const seen = new Set(list.map((g) => g.id));
  const out = [...list];
  for (const m of mocks) {
    if (out.length >= target) break;
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}
