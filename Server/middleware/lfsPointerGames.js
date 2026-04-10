import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const POINTER_PREFIX = 'version https://git-lfs.github.com/spec/v1';

/**
 * Parse oid from a Git LFS pointer file body (first ~2KiB is enough).
 * @param {string} text
 * @returns {string | null}
 */
function parseLfsOid(text) {
  const m = text.match(/^oid sha256:([a-f0-9]{64})\s*$/m);
  return m ? m[1] : null;
}

/**
 * Middleware mounted at `/games`: if the on-disk file is an LFS pointer, serve the
 * real blob from `.git/lfs/objects/...` when present. Otherwise `next()` to `express.static`.
 *
 * @param {string} ugsDir resolved game root (e.g. Client/UGS Files)
 * @param {string} repoRoot parent of `.git`
 */
export function lfsPointerGamesMiddleware(ugsDir, repoRoot) {
  const ugsResolved = path.resolve(ugsDir);

  return async function lfsGamesMw(req, res, next) {
    try {
      // Under app.use('/games', ...), req.url is the path after /games (e.g. /foo/bar.html)
      const raw = (req.url || '/').split('?')[0].replace(/^\//, '');
      let decoded;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        return next();
      }
      if (decoded.includes('..')) return next();

      const abs = path.resolve(ugsResolved, decoded);
      if (!abs.startsWith(ugsResolved)) return next();

      let st;
      try {
        st = await fs.stat(abs);
      } catch {
        return next();
      }
      if (!st.isFile()) return next();

      const peekSize = Math.min(Number(st.size), 2048);
      const headBuf = Buffer.alloc(peekSize);
      const fh = await fs.open(abs, 'r');
      try {
        await fh.read(headBuf, 0, peekSize, 0);
      } finally {
        await fh.close();
      }
      const head = headBuf.toString('utf8');
      if (!head.startsWith(POINTER_PREFIX)) {
        return next();
      }

      let oid = parseLfsOid(head);
      if (!oid && st.size > peekSize) {
        oid = parseLfsOid(await fs.readFile(abs, 'utf8'));
      }
      if (!oid) return next();

      const blobPath = path.join(repoRoot, '.git', 'lfs', 'objects', oid.slice(0, 2), oid.slice(2));
      try {
        await fs.access(blobPath);
      } catch {
        res.status(503).type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Game unavailable</title></head><body>
<h1>Game file not on server</h1>
<p>This game is stored with <strong>Git LFS</strong>, but the real file was not checked out
(only the small pointer is present).</p>
<p>On the machine that runs this server, run:</p>
<pre>git lfs install
git lfs pull</pre>
<p>For Firebase App Hosting, ensure the build installs <code>git-lfs</code> and runs
<code>git lfs pull</code> before the app starts.</p>
</body></html>`);
        return;
      }

      if (abs.toLowerCase().endsWith('.html')) {
        res.type('text/html; charset=utf-8');
      }
      fsSync.createReadStream(blobPath).pipe(res);
    } catch (err) {
      next(err);
    }
  };
}
