import { useEffect, useRef, useState } from 'react';

/**
 * When the element enters the viewport, sets visible=true so staggered children can animate.
 */
export function useRevealStagger(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? true
      : false,
  );

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: options.threshold ?? 0.06, rootMargin: options.rootMargin ?? '0px 0px -8%' },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [options.threshold, options.rootMargin]);

  return { ref, visible };
}
