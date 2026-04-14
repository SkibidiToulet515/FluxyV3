/**
 * Fluxy performance: auto-detect by default; override in Settings (Effects).
 * localStorage `fluxy-performance`: omit key = Auto | `low` | `high` (value `auto` is treated as Auto)
 */

export const FLUXY_PERFORMANCE_KEY = 'fluxy-performance';

/** @returns {'auto' | 'low' | 'high'} What the user chose in Settings (not the resolved tier). */
export function getPerformancePreset() {
  if (typeof window === 'undefined') return 'auto';
  const raw = localStorage.getItem(FLUXY_PERFORMANCE_KEY);
  if (raw === 'low') return 'low';
  if (raw === 'high') return 'high';
  /* absent, 'auto', or unknown → follow device */
  return 'auto';
}

/**
 * Tier if preset is Auto (ignores low/high). Use in Settings to show "Auto would pick…".
 * @returns {'lite' | 'balanced' | 'full'}
 */
export function detectTierFromDevice() {
  if (typeof window === 'undefined') return 'balanced';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return 'lite';

  let saveData = false;
  try {
    saveData = window.matchMedia('(prefers-reduced-data: reduce)').matches;
  } catch {
    /* optional API */
  }

  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory;

  if (saveData || cores <= 2 || (mem != null && mem <= 2)) {
    return 'lite';
  }
  if (cores <= 4 || (mem != null && mem <= 4)) {
    return 'balanced';
  }
  return 'full';
}

/**
 * @returns {{
 *   tier: 'lite' | 'balanced' | 'full',
 *   preset: 'auto' | 'low' | 'high',
 *   filmGrain: boolean,
 *   aurora: 'animated' | 'static',
 *   neuralDots: number,
 *   neuralLinkDist: number,
 *   neuralFrameSkip: number,
 *   backgroundMode: 'static' | 'light' | 'full',
 *   cursorGlow: boolean,
 *   magnetic: boolean,
 *   revealInstant: boolean,
 * }}
 */
export function getPerformanceProfile() {
  const preset = getPerformancePreset();

  if (preset === 'low') {
    return { ...makeProfile('lite'), preset };
  }
  if (preset === 'high') {
    return { ...makeProfile('full'), preset };
  }

  const tier = detectTierFromDevice();
  return { ...makeProfile(tier), preset: 'auto' };
}

function makeProfile(tier) {
  if (tier === 'lite') {
    return {
      tier: 'lite',
      filmGrain: false,
      aurora: 'static',
      neuralDots: 0,
      neuralLinkDist: 100,
      neuralFrameSkip: 0,
      backgroundMode: 'static',
      cursorGlow: false,
      magnetic: false,
      revealInstant: true,
    };
  }
  if (tier === 'balanced') {
    return {
      tier: 'balanced',
      filmGrain: false,
      aurora: 'static',
      neuralDots: 28,
      neuralLinkDist: 92,
      neuralFrameSkip: 1,
      backgroundMode: 'light',
      cursorGlow: true,
      magnetic: true,
      revealInstant: false,
    };
  }
  return {
    tier: 'full',
    filmGrain: true,
    aurora: 'animated',
    neuralDots: 80,
    neuralLinkDist: 120,
    neuralFrameSkip: 0,
    backgroundMode: 'full',
    cursorGlow: true,
    magnetic: true,
    revealInstant: false,
  };
}

/** Short labels for Settings / UI */
export const PERFORMANCE_TIER_LABELS = {
  lite: 'Lower graphics',
  balanced: 'Balanced',
  full: 'Full visuals',
};
