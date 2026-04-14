/**
 * Paths that may be opened in a separate window with ?mode=window.
 * Uses normal in-app URLs only (same origin).
 */
const GAME_DETAIL = /^\/games\/[^/]+$/;
const PLAY_ALIAS = /^\/play\/[^/]+$/;
const TOOL_DETAIL = /^\/tools\/[^/]+$/;
const CHAT = /^\/chat\/?$/;

export function isStandaloneCapablePath(pathname: string): boolean {
  const p = pathname.split('?')[0] || '';
  return (
    GAME_DETAIL.test(p) ||
    PLAY_ALIAS.test(p) ||
    TOOL_DETAIL.test(p) ||
    CHAT.test(p)
  );
}

/** Canonical game player path for “Open in window” (matches public route). */
export function gameStandalonePath(gameId: string): string {
  return `/games/${encodeURIComponent(gameId)}`;
}

export function toolStandalonePath(toolId: string): string {
  return `/tools/${encodeURIComponent(toolId)}`;
}

export const CHAT_STANDALONE_PATH = '/chat' as const;
