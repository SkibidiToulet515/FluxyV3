import {
  STANDALONE_MODE_PARAM,
  STANDALONE_MODE_VALUE,
  STANDALONE_WINDOW_NAME,
} from './constants';
import { readStandalonePrefs, writeStandalonePrefs } from './prefs';
import { isStandaloneCapablePath } from './paths';
import { showToast } from '../utils/toast';

export interface OpenStandaloneOptions {
  width?: number;
  height?: number;
  /** Named target so repeated opens reuse the same window when allowed. */
  name?: string;
}

function pathOnly(path: string): string {
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  const end = q >= 0 && h >= 0 ? Math.min(q, h) : q >= 0 ? q : h >= 0 ? h : path.length;
  return path.slice(0, end) || '/';
}

/** Touch / narrow screens: same URL in a full tab instead of a sized pop-up. */
function isLimitedPopupEnvironment(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return window.matchMedia('(max-width: 640px)').matches;
}

/**
 * Opens an internal Fluxy route in a separate window with `?mode=window`.
 * Uses real same-origin URLs only (no blobs, about:blank, or hidden routes).
 */
export function openStandaloneWindow(
  path: string,
  options?: OpenStandaloneOptions,
): Window | null {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const basePath = pathOnly(normalized);

  if (!isStandaloneCapablePath(basePath)) {
    showToast({
      variant: 'error',
      message: 'This view cannot open in a separate window.',
      duration: 4500,
    });
    return null;
  }

  const prefs = readStandalonePrefs();
  const width = options?.width ?? prefs.lastWidth ?? 1120;
  const height = options?.height ?? prefs.lastHeight ?? 720;
  const name = options?.name ?? STANDALONE_WINDOW_NAME;

  const url = new URL(normalized, window.location.origin);
  url.searchParams.set(STANDALONE_MODE_PARAM, STANDALONE_MODE_VALUE);
  const href = `${url.pathname}${url.search}${url.hash}`;

  if (isLimitedPopupEnvironment()) {
    showToast({
      variant: 'info',
      message:
        'Opened in a new browser tab. Pop-up windows are limited on this device — use the tab toolbar to manage the view.',
      duration: 5500,
    });
    window.open(href, '_blank', 'noreferrer');
    return null;
  }

  const features = [
    'popup=yes',
    `width=${width}`,
    `height=${height}`,
    'menubar=no',
    'toolbar=no',
    'location=yes',
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  const win = window.open(href, name, features);

  if (!win || win.closed) {
    showToast({
      variant: 'error',
      message:
        'Your browser blocked the pop-up. Allow pop-ups for this site and try again, or open the link in a new tab from your browser menu.',
      duration: 7500,
    });
    return null;
  }

  writeStandalonePrefs({ lastWidth: width, lastHeight: height });
  try {
    win.focus();
  } catch {
    /* cross-origin policy */
  }
  return win;
}

export function standaloneHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(normalized, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  url.searchParams.set(STANDALONE_MODE_PARAM, STANDALONE_MODE_VALUE);
  return `${url.pathname}${url.search}${url.hash}`;
}

export { STANDALONE_MODE_PARAM, STANDALONE_MODE_VALUE };
