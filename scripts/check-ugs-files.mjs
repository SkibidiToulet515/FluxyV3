#!/usr/bin/env node
/**
 * Scan UGS Files/ for size stats and any file over GitHub's 100MB blob limit.
 * Run from repo root: npm run check-ugs
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const UGS_DIR = path.join(REPO_ROOT, 'UGS Files');
const GITHUB_LIMIT = 100 * 1024 * 1024; // 100 MiB

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** @returns {Promise<string[]>} */
async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  if (!(await exists(UGS_DIR))) {
    console.error(`Missing folder: ${UGS_DIR}`);
    process.exit(1);
  }

  const allPaths = await walkFiles(UGS_DIR);
  const stats = await Promise.all(
    allPaths.map(async (p) => {
      const st = await fs.stat(p);
      return { p, size: st.size };
    }),
  );

  let totalBytes = 0;
  const overLimit = [];
  let htmlCount = 0;
  let htmlTopLevel = 0;

  for (const { p, size } of stats) {
    totalBytes += size;
    if (size > GITHUB_LIMIT) {
      overLimit.push({ p, size });
    }
    if (/\.html$/i.test(p)) {
      htmlCount += 1;
      if (path.dirname(p) === UGS_DIR) {
        htmlTopLevel += 1;
      }
    }
  }

  console.log(`Folder: ${UGS_DIR}`);
  console.log(`Total files (recursive): ${stats.length}`);
  console.log(`.html files (recursive): ${htmlCount}`);
  console.log(`.html files (top-level only): ${htmlTopLevel}`);
  if (htmlCount > htmlTopLevel) {
    console.log(
      '  Note: nested .html files are included by /api/games (recursive scan).',
    );
  }
  console.log(`Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MiB`);

  if (overLimit.length === 0) {
    console.log(`Files over 100 MiB: none`);
    process.exit(0);
  }

  console.log(`\nFiles over 100 MiB (${overLimit.length}) — use Git LFS or split:`);
  for (const { p, size } of overLimit.sort((a, b) => b.size - a.size)) {
    const rel = path.relative(REPO_ROOT, p);
    console.log(`  ${(size / (1024 * 1024)).toFixed(2)} MiB  ${rel}`);
  }
  process.exit(overLimit.length > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
