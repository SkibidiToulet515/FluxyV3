import { useEffect, useRef } from 'react';

const STRENGTH = 0.28;
const MAX_SHIFT = 14;

/**
 * Subtle pull of a button toward cursor (CTAs).
 */
export function useMagneticButton() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    function onMove(e) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) * STRENGTH;
      let dy = (e.clientY - cy) * STRENGTH;
      dx = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dx));
      dy = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, dy));
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    function onLeave() {
      el.style.transform = '';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return ref;
}
