const base = () => (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function fetchGameReviews(gameId, { sort = 'recent', limit = 24 } = {}) {
  const b = base();
  if (!b) return { reviews: [], summary: { avg: null, count: 0 } };
  const qs = new URLSearchParams({ sort, limit: String(limit) });
  const res = await fetch(`${b}/api/reviews/${encodeURIComponent(gameId)}?${qs}`);
  if (!res.ok) return { reviews: [], summary: { avg: null, count: 0 } };
  return res.json();
}

export async function submitReview(getToken, { gameId, rating, text, tags }) {
  const b = base();
  if (!b) throw new Error('API not configured');
  const token = await getToken();
  if (!token) throw new Error('Sign in required');
  const res = await fetch(`${b}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ gameId, rating, text, tags }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to submit review');
  return data;
}

export async function deleteReview(getToken, gameId) {
  const b = base();
  if (!b) throw new Error('API not configured');
  const token = await getToken();
  if (!token) throw new Error('Sign in required');
  const res = await fetch(`${b}/api/reviews/${encodeURIComponent(gameId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to delete');
  return data;
}
