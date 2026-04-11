const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api/giphy';

async function giphyFetch(url) {
  const res = await fetch(url);
  if (res.status === 503) {
    throw new Error('GIF service is not configured yet. Ask an admin to set the GIPHY_API_KEY.');
  }
  if (!res.ok) throw new Error('Could not load GIFs. Try again later.');
  const data = await res.json();
  return data.gifs || [];
}

export async function fetchTrending() {
  return giphyFetch(`${API_BASE}/trending`);
}

export async function searchGifs(query) {
  if (!query.trim()) return fetchTrending();
  return giphyFetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
}
