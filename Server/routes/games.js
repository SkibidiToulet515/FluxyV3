import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const UGS_DIR = path.resolve(import.meta.dirname, '..', '..', 'UGS Files');

/** @type {Array<{ id: string, name: string, file: string, category: string }> | null} */
let cachedGames = null;

function posixRel(rel) {
  return rel.split(path.sep).join('/');
}

/** @param {string} relPath relative path under UGS_DIR using native separators */
function relativeHtmlId(relPath) {
  return posixRel(relPath).replace(/\.html$/i, '');
}

/**
 * @returns {Promise<string[]>} .html paths relative to rootDir (native separators)
 */
async function walkHtmlRelPaths(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(rootDir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkHtmlRelPaths(full)));
    } else if (e.isFile() && /\.html$/i.test(e.name)) {
      out.push(path.relative(UGS_DIR, full));
    }
  }
  return out;
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

async function scanGames() {
  const relPaths = await walkHtmlRelPaths(UGS_DIR);
  relPaths.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return relPaths.map((relPath) => {
    const file = posixRel(relPath);
    const basename = path.basename(relPath);
    const name = toDisplayName(basename);
    const nameLower = name.toLowerCase();
    return {
      id: relativeHtmlId(relPath),
      name,
      file,
      category: categorize(nameLower),
    };
  });
}

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    if (!cachedGames) {
      cachedGames = await scanGames();
    }
    res.json(cachedGames);
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    if (!cachedGames) {
      cachedGames = await scanGames();
    }
    const q = String(req.query.q ?? '')
      .trim()
      .toLowerCase();
    if (!q) {
      return res.json(cachedGames);
    }
    const filtered = cachedGames.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.file.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q),
    );
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

export default router;
