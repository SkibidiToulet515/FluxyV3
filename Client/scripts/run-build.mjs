/**
 * Windows-safe build entry (npm may invoke PowerShell 5, where `&&` is unsupported).
 * Runs sync steps and Vite in-process so `npm run build` avoids flaky child spawns
 * under some Windows / bundled-Node setups.
 *
 * Env:
 *   FLUXY_SKIP_UGS_SYNC=1 — skip copying thousands of HTML games (e.g. App Hosting API image).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PROXY_ASSETS = ['baremux/worker.js', 'baremux/index.mjs', 'epoxy/index.mjs'];

function assertFiles(relRoot, label) {
  for (const rel of PROXY_ASSETS) {
    const f = path.join(root, relRoot, rel);
    if (!fs.existsSync(f)) {
      console.error(
        `[build] Missing ${label}/${rel}. ` +
          'Run npm ci --prefix Server, then rebuild (syncProxyToPublic copies bare-mux + epoxy into public/).',
      );
      process.exit(1);
    }
  }
}

async function importRun(rel) {
  await import(pathToFileURL(path.join(root, rel)).href);
}

if (process.env.FLUXY_SKIP_UGS_SYNC === '1') {
  console.log('[build] skip UGS sync (FLUXY_SKIP_UGS_SYNC=1)');
} else {
  await importRun('scripts/syncUgsToPublic.mjs');
}

await importRun('scripts/syncProxyToPublic.mjs');
assertFiles('public', 'public');

const { build } = await import('vite');
await build({
  root,
  configFile: path.join(root, 'vite.config.js'),
});

assertFiles('dist', 'dist');
