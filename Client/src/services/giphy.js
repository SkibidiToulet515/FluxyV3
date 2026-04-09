const API_BASE = '/api/giphy';

export async function fetchTrending() {
  const res = await fetch(`${API_BASE}/trending`);
  if (!res.ok) throw new Error(`Giphy trending failed: ${res.status}`);
  const data = await res.json();
  return data.gifs || [];
}

export async function searchGifs(query) {
  if (!query.trim()) return fetchTrending();
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Giphy search failed: ${res.status}`);
  const data = await res.json();
  return data.gifs || [];
}
