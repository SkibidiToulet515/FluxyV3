import fs from 'fs';
import path from 'path';

/** Repo root (parent of Server/) */
export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');

/**
 * UGS HTML games folder. Prefer Client/UGS Files; fall back to legacy locations.
 */
export function resolveUgsDir() {
  const candidates = [
    path.join(REPO_ROOT, 'Client', 'UGS Files'),
    path.join(REPO_ROOT, 'UGS Files'),
    path.join(REPO_ROOT, 'Server', 'UGS Files'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.statSync(dir).isDirectory()) return dir;
    } catch {
      /* missing */
    }
  }
  return candidates[0];
}

export const UGS_DIR = resolveUgsDir();
