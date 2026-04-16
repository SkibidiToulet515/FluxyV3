/**
 * Canonical Inclides shop catalog (32 items). Server merges with appConfig/inclides if present.
 */
export const CATEGORY_TO_SLOT = {
  Frames: 'frames',
  Effects: 'effects',
  Banners: 'banners',
  'Name effects': 'name_effects',
  Badges: 'badges',
  'Profile backgrounds': 'profile_backgrounds',
  Extras: 'extras',
};

export function slotKeyForItem(item) {
  const c = item?.category;
  return CATEGORY_TO_SLOT[c] || 'extras';
}

export const INCLIDES_SHOP_ITEMS = [
  { id: 'neon-ring-frame', name: 'Neon Ring Frame', category: 'Frames', description: 'Soft glowing ring around avatar.', price: 120, rarity: 'Common', kind: 'frame' },
  { id: 'frostline-frame', name: 'Frostline Frame', category: 'Frames', description: 'Icy blue edge with shimmer.', price: 180, rarity: 'Rare', kind: 'frame' },
  { id: 'ember-edge-frame', name: 'Ember Edge Frame', category: 'Frames', description: 'Subtle red/orange glow.', price: 220, rarity: 'Rare', kind: 'frame' },
  { id: 'aurora-frame', name: 'Aurora Frame', category: 'Frames', description: 'Gradient shifting colors.', price: 280, rarity: 'Epic', kind: 'frame' },
  { id: 'shadow-core-frame', name: 'Shadow Core Frame', category: 'Frames', description: 'Dark aura with pulse.', price: 400, rarity: 'Epic', kind: 'frame' },
  { id: 'nova-crown-frame', name: 'Nova Crown Frame', category: 'Frames', description: 'Bright radiant halo.', price: 750, rarity: 'Legendary', kind: 'frame' },
  { id: 'pulse-trail', name: 'Pulse Trail', category: 'Effects', description: 'Subtle motion behind avatar.', price: 200, rarity: 'Common', kind: 'effect' },
  { id: 'orbit-dots', name: 'Orbit Dots', category: 'Effects', description: 'Floating particles around profile.', price: 200, rarity: 'Common', kind: 'effect' },
  { id: 'spark-drift', name: 'Spark Drift', category: 'Effects', description: 'Light floating sparkles.', price: 260, rarity: 'Rare', kind: 'effect' },
  { id: 'glitch-flicker', name: 'Glitch Flicker', category: 'Effects', description: 'Digital glitch effect.', price: 320, rarity: 'Rare', kind: 'effect' },
  { id: 'dark-matter-aura', name: 'Dark Matter Aura', category: 'Effects', description: 'Slow moving shadow energy.', price: 500, rarity: 'Epic', kind: 'effect' },
  { id: 'meteor-trail', name: 'Meteor Trail', category: 'Effects', description: 'Fast streak particles.', price: 800, rarity: 'Legendary', kind: 'effect' },
  { id: 'moonlight-banner', name: 'Moonlight Banner', category: 'Banners', description: 'Soft purple gradient.', price: 150, rarity: 'Common', kind: 'banner' },
  { id: 'cyber-grid-banner', name: 'Cyber Grid Banner', category: 'Banners', description: 'Futuristic grid lines.', price: 250, rarity: 'Rare', kind: 'banner' },
  { id: 'crimson-wave-banner', name: 'Crimson Wave Banner', category: 'Banners', description: 'Deep red flowing texture.', price: 300, rarity: 'Rare', kind: 'banner' },
  { id: 'obsidian-glass-banner', name: 'Obsidian Glass Banner', category: 'Banners', description: 'Dark glass shine.', price: 450, rarity: 'Epic', kind: 'banner' },
  { id: 'galaxy-bloom-banner', name: 'Galaxy Bloom Banner', category: 'Banners', description: 'Starfield with glow.', price: 700, rarity: 'Legendary', kind: 'banner' },
  { id: 'soft-glow-name', name: 'Soft Glow Name', category: 'Name effects', description: 'Subtle color glow.', price: 120, rarity: 'Common', kind: 'name_effect' },
  { id: 'electric-blue-name', name: 'Electric Blue Name', category: 'Name effects', description: 'Blue neon glow.', price: 200, rarity: 'Rare', kind: 'name_effect' },
  { id: 'prism-shift-name', name: 'Prism Shift Name', category: 'Name effects', description: 'Color shifting effect.', price: 350, rarity: 'Epic', kind: 'name_effect' },
  { id: 'void-pulse-name', name: 'Void Pulse Name', category: 'Name effects', description: 'Dark flicker glow.', price: 600, rarity: 'Legendary', kind: 'name_effect' },
  { id: 'nebula-badge', name: 'Nebula Badge', category: 'Badges', description: 'Small glowing badge.', price: 150, rarity: 'Common', kind: 'badge' },
  { id: 'pulse-badge', name: 'Pulse Badge', category: 'Badges', description: 'Animated pulse icon.', price: 220, rarity: 'Rare', kind: 'badge' },
  { id: 'elite-badge', name: 'Elite Badge', category: 'Badges', description: 'Clean premium badge.', price: 400, rarity: 'Epic', kind: 'badge' },
  { id: 'deep-space-background', name: 'Deep Space Background', category: 'Profile backgrounds', description: 'Starfield backdrop.', price: 200, rarity: 'Common', kind: 'profile_background' },
  { id: 'neon-grid-background', name: 'Neon Grid Background', category: 'Profile backgrounds', description: 'Bright grid atmosphere.', price: 300, rarity: 'Rare', kind: 'profile_background' },
  { id: 'aurora-field-background', name: 'Aurora Field Background', category: 'Profile backgrounds', description: 'Moving gradient wash.', price: 500, rarity: 'Epic', kind: 'profile_background' },
  { id: 'cosmic-storm-background', name: 'Cosmic Storm Background', category: 'Profile backgrounds', description: 'Intense motion sky.', price: 900, rarity: 'Legendary', kind: 'profile_background' },
  { id: 'glass-card-accent', name: 'Glass Card Accent', category: 'Extras', description: 'Frosted UI effect.', price: 180, rarity: 'Common', kind: 'extra' },
  { id: 'firefly-particles', name: 'Firefly Particles', category: 'Extras', description: 'Tiny floating lights.', price: 350, rarity: 'Rare', kind: 'extra' },
  { id: 'echo-blur-effect', name: 'Echo Blur Effect', category: 'Extras', description: 'Soft trailing blur.', price: 450, rarity: 'Epic', kind: 'extra' },
  { id: 'night-drive-theme', name: 'Night Drive Theme', category: 'Extras', description: 'Dark neon theme.', price: 1000, rarity: 'Legendary', kind: 'extra' },
];
