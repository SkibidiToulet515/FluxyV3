/**
 * Provider service — manages the active web engine provider.
 *
 * Reads/writes localStorage, exposes helpers consumed by pages and settings.
 * All provider switching flows through this module.
 */

import { DEFAULT_PROVIDER, getProvider, getAllProviders, PROVIDER_IDS } from './registry.js';

const STORAGE_KEY = 'fluxy-web-provider';
/** One-time migration: Scramjet 1.x SW is incompatible with bare-mux v2 (invalid MessagePort). */
const SCRAMJET_BARE2_MIGRATION = 'fluxy-migrate-scramjet-to-uv-v1';

export function getActiveProviderId() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && PROVIDER_IDS.includes(stored)) {
    if (stored === 'scramjet' && !localStorage.getItem(SCRAMJET_BARE2_MIGRATION)) {
      localStorage.setItem(STORAGE_KEY, 'ultraviolet');
      localStorage.setItem(SCRAMJET_BARE2_MIGRATION, '1');
      return 'ultraviolet';
    }
    return stored;
  }
  return DEFAULT_PROVIDER;
}

export function setActiveProviderId(id) {
  if (!PROVIDER_IDS.includes(id)) return;
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent('fluxy-provider-change', { detail: id }));
}

export function getActiveProvider() {
  return getProvider(getActiveProviderId());
}

/**
 * Ask the backend whether a specific provider is available.
 * Returns { available: boolean, message?: string }.
 */
export async function checkProviderHealth(id) {
  const provider = getProvider(id);
  if (!provider) return { available: false, message: 'Unknown provider' };

  try {
    const res = await fetch(provider.adapter.healthEndpoint);
    if (!res.ok) return { available: false, message: `HTTP ${res.status}` };
    return await res.json();
  } catch {
    return { available: false, message: 'Cannot reach provider backend' };
  }
}

export { getProvider, getAllProviders, PROVIDER_IDS, DEFAULT_PROVIDER };
