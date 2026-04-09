/*
 * Fluxy combined service worker.
 *
 * Loads proxy engines lazily and routes fetch requests by URL prefix:
 *   /scram/      → Scramjet
 *   /uv/service/ → Ultraviolet
 *
 * If an engine fails to initialise the SW still stays alive so the
 * page can report the error instead of a blanket registration failure.
 */

let scramjet = null;
let uv = null;
let initError = null;

try {
  importScripts('/uv/uv.bundle.js');
  importScripts('/uv/uv.config.js');
  importScripts('/uv/uv.sw.js');
  uv = new UVServiceWorker();
} catch (e) {
  console.warn('[Fluxy SW] Ultraviolet init failed:', e);
}

try {
  importScripts('/scram/scramjet.codecs.js');
  importScripts('/scram/scramjet.config.js');
  importScripts('/scram/scramjet.bundle.js');
  importScripts('/scram/scramjet.worker.js');
  scramjet = new ScramjetServiceWorker();
} catch (e) {
  console.warn('[Fluxy SW] Scramjet init failed:', e);
}

if (!scramjet && !uv) {
  initError = 'Neither Scramjet nor Ultraviolet could be initialised.';
  console.error('[Fluxy SW]', initError);
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (scramjet && url.startsWith(location.origin + '/scram/')) {
    if (scramjet.route(event)) {
      event.respondWith(scramjet.fetch(event));
      return;
    }
  }

  if (uv && url.startsWith(location.origin + '/uv/service/')) {
    if (uv.route(event)) {
      event.respondWith(uv.fetch(event));
      return;
    }
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'fluxy-ping') {
    event.source.postMessage({
      type: 'fluxy-pong',
      scramjet: !!scramjet,
      uv: !!uv,
      error: initError,
    });
  }
});
