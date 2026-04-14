import { useEffect, useState } from 'react';
import './ScrollProgressBar.css';

export default function ScrollProgressBar() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function update() {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max <= 0 ? 0 : (el.scrollTop / max) * 100;
      setPct(Math.min(100, Math.max(0, p)));
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    if (reduced) {
      return () => {
        window.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }

    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="scroll-progress-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Page scroll progress">
      <div className="scroll-progress-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
