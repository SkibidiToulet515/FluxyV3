import { auth } from './firebase';

function apiBase() {
  return (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
}

/**
 * Authenticated JSON request to the Fluxy API (Bearer Firebase ID token).
 */
export async function apiJson(path, { method = 'GET', body } = {}) {
  const base = apiBase();
  if (!base) throw new Error('VITE_API_URL is not configured');
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not signed in');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

/** Paginated admin user list (Bearer token, access_admin_panel). */
export async function fetchAdminUsersPage({ limit = 150, cursor = null } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  return apiJson(`/api/admin/users?${qs}`);
}
