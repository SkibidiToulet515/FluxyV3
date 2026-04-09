/**
 * Provider configuration — central registry for all web engine providers.
 *
 * Environment variable overrides:
 *   SCRAMJET_ENABLED — "true"/"false" (default: true)
 *   UV_ENABLED       — "true"/"false" (default: true)
 */

function envBool(key, fallback = true) {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === 'true' || v === '1';
}

const providers = {
  scramjet: {
    id: 'scramjet',
    name: 'Scramjet',
    enabled: envBool('SCRAMJET_ENABLED'),
    prefix: '/scram/',
  },
  ultraviolet: {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    enabled: envBool('UV_ENABLED'),
    prefix: '/uv/',
  },
};

export function getProviderConfig(id) {
  return providers[id] ?? null;
}

export function getAllProviderConfigs() {
  return Object.values(providers);
}

export function getEnabledProviders() {
  return Object.values(providers).filter((p) => p.enabled);
}

export default providers;
