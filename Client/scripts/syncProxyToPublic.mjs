/**
 * Copies Ultraviolet, Scramjet, bare-mux, and epoxy-transport assets from
 * Server/node_modules into Client/public so Firebase Hosting can serve them
 * (service worker importScripts + Proxy page fetch).
 *
 * Run after `npm ci` in Server/. Invoked from run-build.mjs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(clientRoot, '..');
const serverNm = path.join(repoRoot, 'Server', 'node_modules');
const pub = path.join(clientRoot, 'public');

function mergeCopyDir(src, dest, { skip = new Set() } = {}) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) mergeCopyDir(s, d, { skip });
    else fs.copyFileSync(s, d);
  }
  return true;
}

function firstExisting(...dirs) {
  for (const d of dirs) {
    if (fs.existsSync(d)) return d;
  }
  return null;
}

const UV_PKG = path.join(serverNm, '@titaniumnetwork-dev', 'ultraviolet');
const SCRAM_PKG = path.join(serverNm, '@mercuryworkshop', 'scramjet');
const BARE_PKG = path.join(serverNm, '@mercuryworkshop', 'bare-mux');
const EPOXY_PKG = path.join(serverNm, '@mercuryworkshop', 'epoxy-transport', 'dist');

let ok = 0;

const uvSrc = firstExisting(path.join(UV_PKG, 'dist'), path.join(UV_PKG, 'lib'));
if (uvSrc) {
  fs.mkdirSync(path.join(pub, 'uv'), { recursive: true });
  if (mergeCopyDir(uvSrc, path.join(pub, 'uv'), { skip: new Set(['uv.config.js']) })) {
    ok += 1;
    console.log(`[syncProxy] Ultraviolet → public/uv (${path.basename(uvSrc)})`);
  }
} else {
  console.warn('[syncProxy] SKIP Ultraviolet — install Server deps (npm ci --prefix Server)');
}

const scramSrc = firstExisting(path.join(SCRAM_PKG, 'dist'), path.join(SCRAM_PKG, 'lib'));
if (scramSrc) {
  fs.mkdirSync(path.join(pub, 'scram'), { recursive: true });
  if (mergeCopyDir(scramSrc, path.join(pub, 'scram'), { skip: new Set(['scramjet.config.js']) })) {
    ok += 1;
    console.log(`[syncProxy] Scramjet → public/scram (${path.basename(scramSrc)})`);
  }
} else {
  console.warn('[syncProxy] SKIP Scramjet — install Server deps');
}

const bareSrc = path.join(BARE_PKG, 'dist');
if (fs.existsSync(bareSrc)) {
  fs.mkdirSync(path.join(pub, 'baremux'), { recursive: true });
  if (mergeCopyDir(bareSrc, path.join(pub, 'baremux'))) {
    ok += 1;
    console.log('[syncProxy] bare-mux → public/baremux');
  }
} else {
  console.warn('[syncProxy] SKIP bare-mux — install Server deps');
}

if (fs.existsSync(EPOXY_PKG)) {
  fs.mkdirSync(path.join(pub, 'epoxy'), { recursive: true });
  if (mergeCopyDir(EPOXY_PKG, path.join(pub, 'epoxy'))) {
    ok += 1;
    console.log('[syncProxy] epoxy-transport → public/epoxy');
  }
} else {
  console.warn('[syncProxy] SKIP epoxy-transport — install Server deps');
}

if (ok === 0) {
  console.warn('[syncProxy] No proxy assets copied — private browsing may fail on static hosting until Server deps are installed.');
} else {
  console.log(`[syncProxy] Done (${ok} packages). Keep public/uv/uv.config.js + public/scram/scramjet.config.js for Fluxy paths.`);
}
