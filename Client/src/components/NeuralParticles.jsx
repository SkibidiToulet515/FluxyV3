import { useEffect, useRef } from 'react';
import './NeuralParticles.css';

const DEFAULT_LINK = 120;

/**
 * @param {{ dotCount?: number, linkDistance?: number, frameSkip?: number }} props
 * dotCount 0 = render nothing (lite tier).
 */
export default function NeuralParticles({
  dotCount = 80,
  linkDistance = DEFAULT_LINK,
  frameSkip = 0,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const dotsRef = useRef([]);
  const frameRef = useRef(0);

  useEffect(() => {
    if (dotCount <= 0) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const linkDistSq = linkDistance * linkDistance;

    let w = 0;
    let h = 0;

    function resize() {
      const ow = w;
      const oh = h;
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const dots = dotsRef.current;
      if (dots.length !== dotCount) {
        dotsRef.current = Array.from({ length: dotCount }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * (reduced ? 0 : 0.35),
          vy: (Math.random() - 0.5) * (reduced ? 0 : 0.35),
        }));
      } else if (ow > 0 && oh > 0) {
        for (const d of dots) {
          d.x = (d.x / ow) * w;
          d.y = (d.y / oh) * h;
        }
      }
    }

    function themeRgb() {
      const fallback = [99, 102, 241];
      const s = getComputedStyle(document.documentElement);
      let hex = (s.getPropertyValue('--accent') || '#6366f1').trim();
      if (!hex.startsWith('#')) return fallback;
      hex = hex.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const n = parseInt(hex, 16);
      if (!Number.isFinite(n)) return fallback;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    resize();
    window.addEventListener('resize', resize);

    function drawStaticFrame() {
      const dots = dotsRef.current;
      const [r, g, b] = themeRgb();
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          if (dx * dx + dy * dy < linkDistSq) {
            ctx.strokeStyle = `rgba(${r},${g},${b},0.12)`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
        ctx.beginPath();
        ctx.arc(dots[i].x, dots[i].y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (reduced) {
      drawStaticFrame();
      const onR = () => {
        resize();
        drawStaticFrame();
      };
      window.removeEventListener('resize', resize);
      window.addEventListener('resize', onR);
      return () => {
        window.removeEventListener('resize', onR);
      };
    }

    function tick() {
      frameRef.current += 1;
      if (frameSkip > 0 && frameRef.current % (frameSkip + 1) !== 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const dots = dotsRef.current;
      const [r, g, b] = themeRgb();

      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
        d.x = Math.max(0, Math.min(w, d.x));
        d.y = Math.max(0, Math.min(h, d.y));
      }

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDistSq) {
            const a = (1 - d2 / linkDistSq) * 0.22;
            ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      for (const d of dots) {
        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [dotCount, linkDistance, frameSkip]);

  if (dotCount <= 0) {
    return null;
  }

  return <canvas ref={canvasRef} className="neural-particles-canvas" aria-hidden />;
}
