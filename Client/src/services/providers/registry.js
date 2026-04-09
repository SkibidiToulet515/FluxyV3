/**
 * Provider registry — single source of truth for all web engine providers.
 *
 * Each provider entry describes how the client should render/initialize it.
 * Provider-specific logic is isolated in adapter files alongside this registry.
 *
 * To add a provider: create an adapter in this folder, then add an entry here.
 */

import { scramjetAdapter } from './scramjet.js';
import { ultravioletAdapter } from './ultraviolet.js';

const PROVIDERS = {
  scramjet: {
    id: 'scramjet',
    name: 'Scramjet',
    description: 'High-performance web proxy with service worker interception',
    icon: 'Zap',
    adapter: scramjetAdapter,
  },
  ultraviolet: {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    description: 'Advanced web proxy with broad site compatibility',
    icon: 'Shield',
    adapter: ultravioletAdapter,
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);
export const DEFAULT_PROVIDER = 'scramjet';

export function getProvider(id) {
  return PROVIDERS[id] ?? null;
}

export function getAllProviders() {
  return Object.values(PROVIDERS);
}

export default PROVIDERS;
