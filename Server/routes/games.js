import express from 'express';
import fs from 'fs/promises';
import { getAdminFirestore, isFirebaseAdminReady } from '../config/firebase.js';
import { UGS_DIR } from '../config/paths.js';
import { inferSubject, normalizeSubject } from '../lib/gameSubject.js';

/** @type {{ at: number, data: Array<{ id: string, name: string, file: string, category: string, subject: string, playUrl?: string | null }> } | null} */
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
    'basketball', 'multiplayer', 'platformer', 'volleyball', 'battleship',
    'challenge', 'adventure', 'crossword', 'wordsmith', 'freestyle',
    'snowboard', 'solitaire', 'submarine', 'fireplace',
    'shooting', 'survival', 'platform', 'baseball', 'football', 'climbing',
    'treasure', 'stickman', 'dinosaur', 'creature', 'monster', 'running',
    'fishing', 'parking', 'cooking', 'driving', 'falling', 'getting',
    'hitting', 'jumping', 'killing', 'looking', 'loading', 'missing',
    'nothing', 'opening', 'picking', 'putting', 'rolling', 'setting',
    'sitting', 'smiling', 'talking', 'trading', 'walking', 'working',
    'writing', 'bowling', 'boxing', 'dancing', 'drawing', 'eating',
    'farming', 'flying', 'gaming', 'hiking', 'mining', 'racing',
    'riding', 'saving', 'skiing', 'sliding', 'surfing', 'swing',
    'defense', 'mystery', 'robbery', 'traffic',
    'battle', 'combat', 'bullet', 'escape', 'horror', 'puzzle', 'soccer',
    'tennis', 'player', 'zombie', 'basket', 'rocket', 'island', 'knight',
    'dragon', 'spider', 'pirate', 'temple', 'castle', 'forest', 'garden',
    'jungle', 'desert', 'ocean', 'space', 'galaxy', 'planet', 'orbit',
    'chicken', 'monkey', 'penguin', 'rabbit',
    'night', 'scary', 'slice', 'match', 'mario', 'sonic', 'drift',
    'drive', 'water', 'money', 'point', 'power', 'pixel', 'paper',
    'stack', 'color', 'crazy', 'happy', 'ninja', 'shark', 'snake',
    'wheel', 'stone', 'steel', 'stick', 'block', 'break', 'brick',
    'clash', 'blast', 'craft', 'cross', 'crush', 'dodge', 'fight',
    'flash', 'float', 'frost', 'house', 'light', 'merge', 'quest',
    'retro', 'rider', 'royal', 'score', 'shape', 'shift', 'shoot',
    'slope', 'speed', 'spell', 'spike', 'squad', 'storm', 'swing',
    'sword', 'throw', 'track', 'train', 'trick', 'twist', 'ultra',
    'tiny', 'bike', 'room', 'dark', 'race', 'jump', 'ball', 'bank',
    'mini', 'tank', 'bomb', 'boom', 'boss', 'burn', 'buzz', 'cage',
    'call', 'calm', 'camp', 'cape', 'card', 'cave', 'chef', 'chip',
    'city', 'club', 'coal', 'cold', 'cook', 'cool', 'corn', 'crab',
    'cube', 'curl', 'cute', 'dart', 'dash', 'dead', 'deal', 'deep',
    'deer', 'dino', 'dirt', 'doom', 'door', 'down', 'drop', 'duck',
    'duel', 'dump', 'dunk', 'dust', 'edge', 'epic', 'evil', 'face',
    'fall', 'farm', 'fast', 'fear', 'feed', 'fill', 'find', 'fire',
    'fish', 'flag', 'flip', 'flow', 'fold', 'food', 'foot', 'four',
    'frog', 'fury', 'fuse', 'gate', 'gear', 'girl', 'glow', 'goat',
    'gold', 'golf', 'grab', 'grid', 'grow', 'hack', 'halo', 'hang',
    'hard', 'head', 'heap', 'heat', 'hide', 'hill', 'hook', 'hoop',
    'idle', 'iron', 'item', 'jack', 'jail', 'jaws', 'jelly', 'keep',
    'kick', 'king', 'kite', 'land', 'lane', 'lava', 'life', 'lime',
    'line', 'link', 'lion', 'lock', 'logo', 'long', 'loop', 'lord',
    'lost', 'luck', 'ludo', 'mage', 'main', 'make', 'maze', 'mega',
    'melt', 'mine', 'miss', 'mode', 'moon', 'move', 'mush', 'myth',
    'neon', 'nest', 'next', 'note', 'nova', 'oink', 'open', 'over',
    'pack', 'pair', 'palm', 'park', 'pass', 'path', 'peak', 'peel',
    'pick', 'pile', 'ping', 'pipe', 'plan', 'play', 'plot', 'plug',
    'plus', 'pong', 'pool', 'port', 'prop', 'pull', 'pump', 'push',
    'quad', 'quiz', 'raid', 'rain', 'ramp', 'rank', 'rave', 'reef',
    'rest', 'ring', 'rise', 'road', 'rock', 'roll', 'roof', 'root',
    'rope', 'ruby', 'rush', 'safe', 'sand', 'shot', 'sign', 'sink',
    'size', 'slam', 'slip', 'slug', 'snow', 'soak', 'soar', 'solo',
    'sort', 'soul', 'spin', 'spit', 'spot', 'star', 'stay', 'step',
    'stop', 'stun', 'surf', 'swap', 'swim', 'tail', 'tame', 'tape',
    'taxi', 'team', 'test', 'tide', 'tile', 'time', 'toll', 'tomb',
    'tops', 'toss', 'town', 'trap', 'tree', 'trek', 'trim', 'trip',
    'tron', 'tube', 'tuna', 'tune', 'turn', 'twin', 'type', 'unit',
    'vibe', 'void', 'volt', 'vortex', 'wade', 'walk', 'wall', 'wand',
    'ward', 'wave', 'west', 'wide', 'wild', 'wilt', 'wind', 'wing',
    'wipe', 'wire', 'wish', 'wolf', 'wood', 'word', 'wrap', 'yard',
    'yell', 'yoga', 'zero', 'zone', 'zoom',
    'super', 'hero', 'tower', 'world', 'mania',
    'rush', 'run', 'gun', 'car', 'war', 'age', 'ice', 'sky', 'fly',
    'box', 'top', 'pop', 'cop', 'hop', 'mad', 'bad', 'red', 'big',
    'hit', 'bit', 'dig', 'pig', 'rig', 'oil', 'bow', 'cow', 'fox',
    'gem', 'gym', 'hex', 'hog', 'hub', 'ink', 'jam', 'jar', 'jet',
    'jig', 'job', 'jog', 'joy', 'key', 'kit', 'lab', 'lap', 'log',
    'lot', 'low', 'map', 'mat', 'max', 'mix', 'mob', 'mud', 'mug',
    'nap', 'net', 'new', 'nib', 'nod', 'nut', 'oak', 'odd', 'old',
    'ore', 'orb', 'out', 'owl', 'pad', 'pan', 'paw', 'pay', 'pen',
    'pet', 'pin', 'pit', 'pod', 'pot', 'pup', 'put', 'rag', 'ram',
    'rap', 'rat', 'raw', 'ray', 'rib', 'rim', 'rip', 'rob', 'rod',
    'rot', 'row', 'rub', 'rug', 'sag', 'saw', 'sea', 'set', 'shy',
    'sim', 'sip', 'sir', 'sit', 'six', 'sob', 'sod', 'son', 'spy',
    'sub', 'sum', 'sun', 'sup', 'tab', 'tag', 'tan', 'tap', 'tar',
    'ten', 'the', 'tin', 'tip', 'toe', 'ton', 'too', 'tow', 'toy',
    'try', 'tub', 'tug', 'two', 'van', 'vet', 'vim', 'vow', 'web',
    'wig', 'win', 'wit', 'woe', 'wok', 'won', 'woo', 'wow', 'yam',
    'yap', 'yaw', 'yew', 'zip', 'zoo',
    'of', 'vs', 'in', 'to', 'io', 'up',
    '3d', '2d',
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
      const cat = mapFirestoreCategory(d.category);
      const nameLower = title.toLowerCase();
      const subject =
        normalizeSubject(d.subject) || inferSubject(nameLower, cat);
      out.push({
        id: doc.id,
        name: title,
        file: file || '',
        category: cat,
        subject,
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
    const category = categorize(nameLower);
    return {
      id: fileId(file),
      name,
      file,
      category,
      subject: inferSubject(nameLower, category),
      playUrl: null,
    };
  });
}

function mergeGameLists(fsGames, dbGames) {
  const byKey = new Map();
  for (const g of fsGames) {
    byKey.set(`f:${g.file}`, { ...g });
  }
  for (const g of dbGames) {
    const key = g.file ? `f:${g.file}` : `d:${g.id}`;
    if (!byKey.has(key)) {
      byKey.set(key, g);
    } else if (g.file) {
      const existing = byKey.get(key);
      const merged = { ...existing };
      if (g.subject) merged.subject = g.subject;
      if (g.category && g.category !== 'Arcade') merged.category = g.category;
      if (g.thumbnail) merged.thumbnail = g.thumbnail;
      byKey.set(key, merged);
    }
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
        g.id.toLowerCase().includes(q) ||
        (g.subject && g.subject.toLowerCase().includes(q)) ||
        (g.category && g.category.toLowerCase().includes(q)),
    );
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

export default router;
