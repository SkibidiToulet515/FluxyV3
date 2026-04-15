import { createHash } from 'crypto';

/** Stable id for legacy warning rows that lack `id` (matches server + client). */
export function fingerprintLegacyWarning(entry) {
  const s = `${entry.at || ''}|${(entry.reason || '').trim()}|${entry.by || ''}`;
  return createHash('sha256').update(s).digest('hex').slice(0, 24);
}

export function legacyWarningPunishmentId(entry) {
  return `legacy-w-${fingerprintLegacyWarning(entry)}`;
}

export function syntheticBanId(uid) {
  return `synthetic-ban-${uid}`;
}

export function syntheticMuteId(uid) {
  return `synthetic-mute-${uid}`;
}
