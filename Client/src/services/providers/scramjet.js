/**
 * Scramjet provider adapter.
 *
 * Uses the plain codec (encodeURIComponent) to build proxied URLs under /scram/.
 * The service worker intercepts requests matching this prefix and proxies them.
 */

const PREFIX = '/scram/';

export const scramjetAdapter = {
  id: 'scramjet',

  encode(input) {
    const url = normalizeInput(input);
    return PREFIX + encodeURIComponent(url);
  },

  get prefix() {
    return PREFIX;
  },

  get healthEndpoint() {
    return '/api/providers/scramjet/status';
  },
};

function normalizeInput(raw) {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
}
