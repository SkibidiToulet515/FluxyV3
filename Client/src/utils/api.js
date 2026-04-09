const API_BASE = '/api';

export async function fetchGames() {
  const res = await fetch(`${API_BASE}/games`);
  return res.json();
}

export async function searchGames(query) {
  const res = await fetch(`${API_BASE}/games/search?q=${encodeURIComponent(query)}`);
  return res.json();
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
