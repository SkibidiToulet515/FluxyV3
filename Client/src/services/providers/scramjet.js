/**
 * Scramjet provider adapter.
 *
 * Uses the plain codec (encodeURIComponent) to build proxied URLs under /scram/.
 * The service worker intercepts requests matching this prefix and proxies them.
 */

import { normalizeInput } from './normalizeInput.js';

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
    return (import.meta.env.VITE_API_URL || '') + '/api/providers/scramjet/status';
  },
};
