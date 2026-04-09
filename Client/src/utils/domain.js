const MIRROR_DOMAINS = [
  'fluxyv3.online',
  'fluxyv3.store',
  'fluxyv3.space',
  'fluxyv3.site',
];

const PRIMARY_DOMAIN = 'fluxyv3.online';
const PRIMARY_URL = 'https://fluxyv3.online';

export function getCurrentHostname() {
  return typeof window !== 'undefined' ? window.location.hostname : '';
}

export function isMirrorDomain() {
  return MIRROR_DOMAINS.includes(getCurrentHostname());
}

export function isPrimaryDomain() {
  return getCurrentHostname() === PRIMARY_DOMAIN;
}

export function getCurrentDomain() {
  const host = getCurrentHostname();
  return MIRROR_DOMAINS.find((d) => d === host) || host;
}

export function getPrimaryUrl(path = '') {
  return `${PRIMARY_URL}${path}`;
}

export { MIRROR_DOMAINS, PRIMARY_DOMAIN, PRIMARY_URL };
