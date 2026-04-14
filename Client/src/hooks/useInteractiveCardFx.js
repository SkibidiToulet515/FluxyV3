import { useCallback, useEffect, useRef } from 'react';

/**
 * Spotlight + 3D tilt + CSS vars for premium card surface.
 * Respects prefers-reduced-motion (spotlight only, no tilt).
 */
export function useInteractiveCardFx() {
  const ref = useRef(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const onMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--spot-x', `${(px + 0.5) * 100}%`);
    el.style.setProperty('--spot-y', `${(py + 0.5) * 100}%`);
    if (!reducedRef.current) {
      el.style.setProperty('--tilt-x', `${py * -14}deg`);
      el.style.setProperty('--tilt-y', `${px * 14}deg`);
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--spot-x', '50%');
    el.style.setProperty('--spot-y', '50%');
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
