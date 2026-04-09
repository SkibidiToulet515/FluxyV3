const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function parseJsonArray(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchGames() {
  const res = await fetch(`${API_BASE}/games`);
  if (!res.ok) {
    const err = new Error(`Games API failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return parseJsonArray(res);
}

export async function searchGames(query) {
  const res = await fetch(`${API_BASE}/games/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return parseJsonArray(res);
}

export function getRecentlyPlayed() {
  try {
    return JSON.parse(localStorage.getItem('fluxy-recent') || '[]');
  } catch {
    return [];
  }
}

export function addRecentlyPlayed(game) {
  const recent = getRecentlyPlayed().filter(g => g.id !== game.id);
  recent.unshift(game);
  localStorage.setItem('fluxy-recent', JSON.stringify(recent.slice(0, 20)));
}

export function getLayoutMode() {
  return localStorage.getItem('fluxy-layout') || 'sidebar';
}

export function setLayoutMode(mode) {
  localStorage.setItem('fluxy-layout', mode);
}
