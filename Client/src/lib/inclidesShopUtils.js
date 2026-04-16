/** Mirrors Server/lib/inclidesCatalog CATEGORY_TO_SLOT */
export const CATEGORY_ORDER = [
  'Frames',
  'Effects',
  'Banners',
  'Name effects',
  'Badges',
  'Profile backgrounds',
  'Extras',
];

export const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };

export function slotKeyForCategory(category) {
  const m = {
    Frames: 'frames',
    Effects: 'effects',
    Banners: 'banners',
    'Name effects': 'name_effects',
    Badges: 'badges',
    'Profile backgrounds': 'profile_backgrounds',
    Extras: 'extras',
  };
  return m[category] || 'extras';
}

export function rarityRank(r) {
  return RARITY_ORDER[r] ?? 0;
}
