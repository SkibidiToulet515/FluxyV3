/**
 * Ultraviolet provider adapter.
 *
 * Uses the xor codec (matching UV's default) to build proxied URLs under /uv/service/.
 * The service worker intercepts requests matching this prefix and proxies them.
 */

import { normalizeInput } from './normalizeInput.js';

const PREFIX = '/uv/service/';

function xorEncode(input) {
  const factor = 2;
  return encodeURIComponent(
    input
      .split('')
      .map((ch, i) => (i % factor ? String.fromCharCode(ch.charCodeAt(0) ^ factor) : ch))
      .join(''),
  );
}

export const ultravioletAdapter = {
  id: 'ultraviolet',

  encode(input) {
    const url = normalizeInput(input);
    return PREFIX + xorEncode(url);
  },

  get prefix() {
    return PREFIX;
  },

  get healthEndpoint() {
    return (import.meta.env.VITE_API_URL || '') + '/api/providers/ultraviolet/status';
  },
};
