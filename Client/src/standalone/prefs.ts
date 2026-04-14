import { STANDALONE_PREFS_KEY } from './constants';

export interface StandalonePrefs {
  lastWidth?: number;
  lastHeight?: number;
}

export function readStandalonePrefs(): StandalonePrefs {
  try {
    const raw = localStorage.getItem(STANDALONE_PREFS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return {};
    const w = (o as { lastWidth?: unknown }).lastWidth;
    const h = (o as { lastHeight?: unknown }).lastHeight;
    return {
      lastWidth: typeof w === 'number' && w > 200 ? w : undefined,
      lastHeight: typeof h === 'number' && h > 200 ? h : undefined,
    };
  } catch {
    return {};
  }
}

export function writeStandalonePrefs(partial: Partial<StandalonePrefs>): void {
  try {
    const cur = readStandalonePrefs();
    const next = { ...cur, ...partial };
    localStorage.setItem(STANDALONE_PREFS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}
