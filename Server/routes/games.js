import express from 'express';
import fs from 'fs/promises';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';
import { UGS_DIR } from '../config/paths.js';

/** @type {{ at: number, data: Array<{ id: string, name: string, file: string, category: string, playUrl?: string | null }> } | null} */
let mergedCache = null;
const MERGE_TTL_MS = 45_000;

async function getMergedGames() {
  if (mergedCache && Date.now() - mergedCache.at < MERGE_TTL_MS) {
    return mergedCache.data;
  }
  const data = await loadAllGames();
  mergedCache = { at: Date.now(), data };
  return data;
}

/** Words used for greedy segmentation of concatenated lowercase names (longest first). */
const SEGMENT_TOKENS = [
  ...new Set([
    'basketball',
    'platform',
    'survival',
    'battleship',
    'basket',
    'football',
    'baseball',
    'volleyball',
    'defense',
    'mystery',
    'robbery',
    'shooting',
    'platformer',
    'adventure',
    'challenge',
    'multiplayer',
    'battle',
    'combat',
    'bullet',
    'escape',
    'horror',
    'puzzle',
    'racing',
    'soccer',
    'tennis',
    'player',
    'zombie',
    'night',
    'scary',
    'slice',
    'match',
    'mario',
    'sonic',
    'drift',
    'drive',
    'bike',
    'room',
    'dark',
    'race',
    'jump',
    'ball',
    'bank',
    'mini',
    'super',
    'hero',
    'tower',
    'world',
    'mania',
    'rush',
    'run',
    'gun',
    'car',
    'war',
    'age',
    'of',
    'the',
    'and',
    'vs',
    'in',
    'to',
    'io',
    '3d',
    '2d',
  ]),
].sort((a, b) => b.length - a.length);

function capitalizeWord(w) {
  if (!w) return '';
  if (/^\d+$/.test(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function stripClPrefixAndExt(filename) {
  const base = filename.replace(/\.html$/i, '');
  if (/^cl/i.test(base) && base.length > 2) {
    return base.slice(2);
  }
  return base;
}

function greedySegment(lower) {
  const result = [];
  let i = 0;
  while (i < lower.length) {
    let matched = false;
    for (const t of SEGMENT_TOKENS) {
      if (lower.startsWith(t, i)) {
        result.push(t);
        i += t.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      let j = i + 1;
      while (j <= lower.length) {
        const rest = lower.slice(j);
        const hit = SEGMENT_TOKENS.some((t) => rest.startsWith(t));
        if (hit || j === lower.length) {
          result.push(lower.slice(i, j));
          i = j;
          break;
        }
        j += 1;
      }
      if (j > lower.length) break;
    }
  }
  return result.filter(Boolean);
}

/** Humanize a filename stem (no extension); used per segment when splitting on digits. */
function humanizeStem(s) {
  if (!s) return '';

  if (/[\s_-]/.test(s)) {
    return s
      .split(/[\s_-]+/)
      .map(capitalizeWord)
      .join(' ');
  }

  let spaced = s
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  if (spaced.includes(' ')) {
    return spaced.split(/\s+/).map(capitalizeWord).join(' ');
  }

  spaced = s.replace(/(\d+)/g, ' $1 ').trim();
  if (spaced.includes(' ')) {
    return spaced.split(/\s+/).map(capitalizeWord).join(' ');
  }

  const lower = s.toLowerCase();
  let withBreaks = lower
    .replace(/([a-z\d])(of)([a-z])/gi, '$1 $2 $3')
    .replace(/([a-z\d])(the)([a-z])/gi, '$1 $2 $3')
    .replace(/([a-z\d])(and)([a-z])/gi, '$1 $2 $3')
    .replace(/([a-z\d])(vs)([a-z])/gi, '$1 $2 $3')
    .replace(/([a-z\d])(in)([a-z])/gi, '$1 $2 $3')
    .replace(/([a-z\d])(to)([a-z])/gi, '$1 $2 $3');

  if (withBreaks.includes(' ')) {
    return withBreaks.split(/\s+/).map(capitalizeWord).join(' ');
  }

  const words = greedySegment(lower);
  if (words.length > 1) {
    return words.map(capitalizeWord).join(' ');
  }

  return capitalizeWord(s);
}

function toDisplayName(filename) {
  const stripped = stripClPrefixAndExt(filename);
  const s = stripped.trim();
  if (!s) return 'Untitled';

  const segments = s.split(/(\d+)/).filter(Boolean);
  if (segments.length === 1) {
    return humanizeStem(segments[0]);
  }

  return segments
    .map((part) => (/^\d+$/.test(part) ? part : humanizeStem(part)))
    .filter(Boolean)
    .join(' ');
}

function categorize(nameLower) {
  const twoPlayer =
    nameLower.includes('2 player') ||
    nameLower.includes('1v1') ||
    nameLower.includes('soccer') ||
    nameLower.includes('tennis') ||
    nameLower.includes('basketball');
  if (twoPlayer) return '2 Player';

  const action =
    nameLower.includes('shoot') ||
    nameLower.includes('gun') ||
    nameLower.includes('war') ||
    nameLower.includes('combat') ||
    nameLower.includes('battle') ||
    nameLower.includes('bullet');
  if (action) return 'Action';

  const adventure =
    nameLower.includes('escape') ||
    nameLower.includes('room') ||
    nameLower.includes('mystery') ||
    nameLower.includes('dark');
  if (adventure) return 'Adventure';

  const horror =
    nameLower.includes('horror') ||
    nameLower.includes('scary') ||
    nameLower.includes('night') ||
    nameLower.includes('zombie') ||
    nameLower.includes('survival');
  if (horror) return 'Horror';

  const puzzle =
    nameLower.includes('puzzle') ||
    nameLower.includes('maze') ||
    nameLower.includes('2048') ||
    nameLower.includes('match') ||
    nameLower.includes('slice');
  if (puzzle) return 'Puzzle';

  const racing =
    nameLower.includes('race') ||
    nameLower.includes('car') ||
    nameLower.includes('bike') ||
    nameLower.includes('drive') ||
    nameLower.includes('drift');
  if (racing) return 'Racing';

  const platformer =
    nameLower.includes('mario') ||
    nameLower.includes('sonic') ||
    nameLower.includes('platform') ||
    nameLower.includes('jump') ||
    nameLower.includes('run');
  if (platformer) return 'Platformer';

  return 'Arcade';
}

function fileId(filename) {
  return filename.replace(/\.html$/i, '');
}

/** UGS HTML served at /games/<file> on API or Hosting — extract filename from any URL shape. */
function extractBundledHtmlFilenameFromHttpUrl(urlString) {
  try {
    const u = new URL(urlString);
    const m = u.pathname.match(/\/games\/([^/]+)$/i);
    if (m && /\.html?$/i.test(m[1])) return decodeURIComponent(m[1]);
  } catch {
    /* ignore */
  }
  return null;
}

function fileFromFirestoreUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    return extractBundledHtmlFilenameFromHttpUrl(t);
  }
  const m =
    t.match(/\/games\/([^/?#]+)$/i) ||
    t.match(/^\/?games\/([^/?#]+)$/i) ||
    t.match(/^([^/]+\.html)$/i);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

/** API responses: never expose playUrl for our own /games/*.html (avoids LFS stubs on App Hosting). */
function normalizeGameForClient(game) {
  if (!game.playUrl || typeof game.playUrl !== 'string') return game;
  const extracted = extractBundledHtmlFilenameFromHttpUrl(game.playUrl.trim());
  if (!extracted) return game;
  return {
    ...game,
    file: game.file || extracted,
    playUrl: null,
  };
}

function normalizeGamesForClient(list) {
  return list.map(normalizeGameForClient);
}

function mapFirestoreCategory(cat) {
  if (!cat || cat === 'Uncategorized') return 'Arcade';
  const allowed = [
    'Action', 'Adventure', 'Arcade', 'Horror', '2 Player', 'Puzzle', 'Racing', 'Platformer',
    'Sports', 'Strategy', 'Shooting', 'Simulation', 'RPG', 'Other',
  ];
  return allowed.includes(cat) ? cat : 'Arcade';
}

async function loadFirestoreGamesList() {
  if (!isFirebaseAdminReady()) return [];
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('games').get();
    const out = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      if (d.visible === false) continue;
      const title = (d.title || '').trim();
      if (!title) continue;
      const url = (d.url || '').trim();
      const file = fileFromFirestoreUrl(url);
      const playUrl = /^https?:\/\//i.test(url) && !file ? url : null;
      if (!file && !playUrl) continue;
      out.push({
        id: doc.id,
        name: title,
        file: file || '',
        category: mapFirestoreCategory(d.category),
        playUrl,
        thumbnail: d.thumbnail || null,
      });
    }
    return out;
  } catch (err) {
    console.warn('[games] Firestore list failed:', err.message);
    return [];
  }
}

async function scanGames() {
  const entries = await fs.readdir(UGS_DIR, { withFileTypes: true });
  const htmlFiles = entries
    .filter((e) => e.isFile() && /\.html$/i.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return htmlFiles.map((file) => {
    const name = toDisplayName(file);
    const nameLower = name.toLowerCase();
    return {
      id: fileId(file),
      name,
      file,
      category: categorize(nameLower),
      playUrl: null,
    };
  });
}

function mergeGameLists(fsGames, dbGames) {
  const byKey = new Map();
  for (const g of fsGames) {
    byKey.set(`f:${g.file}`, g);
  }
  for (const g of dbGames) {
    const key = g.file ? `f:${g.file}` : `d:${g.id}`;
    if (!byKey.has(key)) byKey.set(key, g);
  }
  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

async function loadAllGames() {
  let fsGames = [];
  try {
    fsGames = await scanGames();
  } catch (err) {
    console.warn('[games] UGS folder missing or unreadable (normal on App Hosting):', err.code || err.message);
  }
  const dbGames = await loadFirestoreGamesList();
  return mergeGameLists(fsGames, dbGames);
}

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const list = normalizeGamesForClient(await getMergedGames());
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const cachedGames = normalizeGamesForClient(await getMergedGames());
    const q = String(req.query.q ?? '')
      .trim()
      .toLowerCase();
    if (!q) {
      return res.json(cachedGames);
    }
    const filtered = cachedGames.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.file || '').toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q),
    );
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

export default router;
