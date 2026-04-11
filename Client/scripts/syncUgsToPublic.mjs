/**
 * Copies Client/UGS Files → Client/public/games before Vite build.
 * Firebase Hosting serves /games/<file> from dist/games (no App Hosting / LFS needed).
 * Fails if any .html is still a Git LFS pointer on disk.
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

fs.mkdirSync(outDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) {
  if (KEEP_FILES.has(name)) continue;
  fs.unlinkSync(path.join(outDir, name));
}

if (!fs.existsSync(ugsDir)) {
  console.warn('[syncUgs] Client/UGS Files missing — public/games left empty.');
  process.exit(0);
}

let copied = 0;
for (const name of fs.readdirSync(ugsDir)) {
  const src = path.join(ugsDir, name);
  if (!fs.statSync(src).isFile()) continue;
  const low = name.toLowerCase();
  if (!low.endsWith('.html') && !low.endsWith('.htm')) continue;

  if (readHeadIsLfsPointer(src)) {
    console.error(`
[syncUgs] BLOCKED: "${name}" is a Git LFS pointer (starts with "version https://git-lfs.github.com/spec/v1").

On your machine, run:
  git lfs install && git lfs pull

Then build again. If GitHub LFS quota is exhausted, you cannot pull — either add LFS data
packs on GitHub OR replace Client/UGS Files with the real HTML and remove the LFS line
from .gitattributes, then commit the actual files (not pointers).

Production iframes use /games/ on Firebase Hosting (see VITE_GAMES_ON_HOSTING), so real
files must exist in the repo checkout when CI runs "npm run build".
`);
    process.exit(1);
  }

  fs.copyFileSync(src, path.join(outDir, name));
  copied += 1;
}

console.log(`[syncUgs] Copied ${copied} HTML game(s) → public/games (served as /games/ on Hosting).`);
