import { useEffect, useCallback } from 'react';

const KEYS = {
  density: 'fluxy-ui-density',
  motion: 'fluxy-ui-motion',
};

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

/** Apply saved UI prefs to <html> (density, reduced motion). Call once in Layout. */
export function useFluxyUiPreferences() {
  const apply = useCallback(() => {
    const root = document.documentElement;
    const density = read(KEYS.density, 'comfortable');
    const motion = read(KEYS.motion, 'full');
    root.dataset.fluxyDensity = density === 'compact' ? 'compact' : 'comfortable';
    root.dataset.fluxyMotion = motion === 'reduced' ? 'reduced' : 'full';
  }, []);

  useEffect(() => {
    apply();
    function onStorage(e) {
      if (!e.key || e.key.startsWith('fluxy-ui-')) apply();
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('fluxy-ui-prefs', apply);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fluxy-ui-prefs', apply);
    };
  }, [apply]);

  return { apply };
}

export function setFluxyUiPreference(key, value) {
  if (key === 'density') localStorage.setItem(KEYS.density, value);
  if (key === 'motion') localStorage.setItem(KEYS.motion, value);
  try {
    window.dispatchEvent(new Event('fluxy-ui-prefs'));
  } catch {
    /* ignore */
  }
}
