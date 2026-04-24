import { auth } from './firebase';

function normalizeHomepagePayload(d) {
  if (!d || typeof d !== 'object') return null;
  if ('config' in d && d.config != null && typeof d.config === 'object') return d.config;
  return d;
}

/** Homepage layout: static JSON on hosting first (no 401), then API with optional Firebase token. */
export async function fetchCmsHomepageConfig() {
  try {
    const local = await fetch('/cms/homepage.json', { cache: 'no-store' });
    if (local.ok) {
      const d = await local.json();
      const cfg = normalizeHomepagePayload(d);
      if (cfg) return cfg;
    }
  } catch {
    /* ignore */
  }

  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  if (!base) return null;
  /* Anonymous calls often 401 on hosted API (IAM); only use API when signed in. */
  let u = null;
  try {
    u = auth.currentUser;
  } catch {
    /* ignore */
  }
  if (!u) return null;

  const headers = { Accept: 'application/json' };
  try {
    const t = await u.getIdToken();
    headers.Authorization = `Bearer ${t}`;
  } catch {
    /* ignore */
  }
  const r = await fetch(`${base}/api/cms/homepage`, { headers });
  if (!r.ok) return null;
  try {
    const d = await r.json();
    return normalizeHomepagePayload(d);
  } catch {
    return null;
  }
}
