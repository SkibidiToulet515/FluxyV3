import fs from 'fs';
import path from 'path';

const LFS_MARKER = 'git-lfs.github.com/spec';

function isLfsPointerFile(absPath) {
  try {
    const fd = fs.openSync(absPath, 'r');
    try {
      const buf = Buffer.alloc(200);
      const n = fs.readSync(fd, buf, 0, 200, 0);
      return buf.slice(0, n).toString('utf8').includes(LFS_MARKER);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

/**
 * Before serving UGS HTML, reject Git LFS pointer stubs (deploy without `git lfs pull`).
 */
export function ugsLfsGuard(ugsDir) {
  const root = path.resolve(ugsDir);

  return function ugsLfsGuardMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const rel = (req.path || '').replace(/^\/+/, '');
    if (!rel || rel.includes('..')) {
      next();
      return;
    }

    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root)) {
      res.status(400).end('Bad path');
      return;
    }

    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      next();
      return;
    }

    if (!st.isFile()) {
      next();
      return;
    }

    const ext = path.extname(abs).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      next();
      return;
    }

    if (!isLfsPointerFile(abs)) {
      next();
      return;
    }

    res.status(503);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Game unavailable</title>
<style>
body{font-family:system-ui,sans-serif;background:#0f0f12;color:#e8e8ec;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
code{background:#1a1a22;padding:0.15em 0.4em;border-radius:4px;font-size:0.9em}
h1{font-size:1.25rem}
</style>
</head>
<body>
<h1>Game files were not fully deployed</h1>
<p>This file is still a <strong>Git LFS pointer</strong> on the server (text starting with <code>version https://git-lfs.github.com/spec/v1</code>), not the real HTML game.</p>
<p><strong>Fix:</strong> In Firebase App Hosting, the build must install Git LFS and run <code>git lfs pull</code> before <code>npm ci</code>. This repo’s <code>apphosting.yaml</code> is set up for that. Redeploy after pulling the latest config.</p>
<p>Other options: add games as full <code>https://</code> URLs in the Admin panel, or stop using LFS for small HTML under <code>Client/UGS Files</code> and commit the real files.</p>
</body>
</html>`);
  };
}
