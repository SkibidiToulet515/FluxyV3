/**
 * Games catalog at /games (legacy /math redirects to /games).
 * SUBJECT_KEYS kept for Firestore / admin game docs.
 */

export const SUBJECT_KEYS = [
  'Math',
  'History',
  'Chemistry',
  'Social Studies',
  'English',
  'Science',
];

export const GAMES_CATALOG_PATH = '/games';

export const GAMES_SECTION_PATHS = ['/games', '/math'];

export function isGamesSectionPath(pathname) {
  return GAMES_SECTION_PATHS.includes(pathname);
}

export function isProxySectionPath(pathname) {
  return pathname === '/history' || pathname === '/proxy';
}
