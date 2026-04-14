/**
 * Copies Client/UGS Files → Client/public/games before Vite build.
 * Firebase Hosting serves /games/<file> from dist/games (no App Hosting / LFS needed).
 * Skips Git LFS pointer files with a warning (they can't be served as games).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const ugsDir = path.join(clientRoot, 'UGS Files');
const outDir = path.join(clientRoot, 'public', 'games');

const LFS_MARKER = 'git-lfs.github.com/spec';

function readHeadIsLfsPointer(absPath) {
  const fd = fs.openSync(absPath, 'r');
  try {
    const buf = Buffer.alloc(220);
    const n = fs.readSync(fd, buf, 0, 220, 0);
    return buf.slice(0, n).toString('utf8').includes(LFS_MARKER);
  } finally {
    fs.closeSync(fd);
  }
}

const KEEP_FILES = new Set(['404.html', '.gitkeep']);

/** Bundled demo HTML shipped in-repo; never delete during UGS sync. */
function isBundledMockGame(name) {
  return /^fluxy-mock-.*\.html$/i.test(name);
}

fs.mkdirSync(outDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) {
  if (KEEP_FILES.has(name) || isBundledMockGame(name)) continue;
  fs.unlinkSync(path.join(outDir, name));
}

if (!fs.existsSync(ugsDir)) {
  console.warn('[syncUgs] Client/UGS Files missing — public/games left empty.');
  process.exit(0);
}

let copied = 0;
let skipped = 0;
for (const name of fs.readdirSync(ugsDir)) {
  const src = path.join(ugsDir, name);
  if (!fs.statSync(src).isFile()) continue;
  const low = name.toLowerCase();
  if (!low.endsWith('.html') && !low.endsWith('.htm')) continue;

  if (readHeadIsLfsPointer(src)) {
    console.warn(`[syncUgs] SKIPPED LFS pointer: "${name}" — this game will not be available on Hosting.`);
    skipped += 1;
    continue;
  }

  fs.copyFileSync(src, path.join(outDir, name));
  copied += 1;
}

console.log(`[syncUgs] Copied ${copied} HTML game(s) → public/games.${skipped ? ` Skipped ${skipped} LFS pointer(s).` : ''}`);
