import { apiJson } from './apiClient';

export function formatInclidesAmount(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v.toLocaleString();
}

/** Display string: "1,240 Inclides" */
export function formatInclidesLine(n) {
  return `${formatInclidesAmount(n)} Inclides`;
}

export async function fetchInclidesMe() {
  return apiJson('/api/inclides/me');
}

export async function postDailyClaim() {
  return apiJson('/api/inclides/daily-claim', { method: 'POST' });
}

export async function fetchInclidesTransactions(limit = 50) {
  return apiJson(`/api/inclides/transactions?limit=${limit}`);
}

export async function fetchInclidesShop() {
  return apiJson('/api/inclides/shop');
}

export async function postInclidesPurchase(itemId) {
  return apiJson('/api/inclides/purchase', { method: 'POST', body: { itemId } });
}

export async function postInclidesEquip(itemId) {
  return apiJson('/api/inclides/equip', { method: 'POST', body: { itemId: itemId ?? null } });
}
