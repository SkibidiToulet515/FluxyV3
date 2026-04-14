import { useEffect, useRef } from 'react';

const CONFETTI_COUNT = 60;
const CONFETTI_LIFETIME_MS = 900;
const RIPPLE_LIFETIME_MS = 650;
const RIPPLE_MAX_RADIUS = 120;

const BUTTON_SELECTOR =
  'button, .btn, [role="button"], a.btn, input[type="submit"], input[type="button"], .game-card';

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function themeRgbPair() {
  const s = getComputedStyle(document.documentElement);
  const accent = s.getPropertyValue('--accent').trim() || '#6366f1';
  const end = s.getPropertyValue('--gradient-end').trim() || '#8b5cf6';
  const cyan = '#22d3ee';
  const pink = '#f472b6';
  return [
    hexToRgb(accent),
    hexToRgb(end),
    hexToRgb(cyan),
    hexToRgb(pink),
  ];
}

/**
 * Full-page ripple on every click; 60-particle glowing confetti on button clicks.
 */
export default function useGlobalClickEffects(enabled = true) {
  const ripplesRef = useRef([]);
  const confettiRef = useRef([]);
  const rafRef = useRef(0);
  const activeRef = useRef(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:9998;pointer-events:none;width:100%;height:100%';
    document.body.appendChild(canvas);
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnRipple(x, y) {
      if (reducedMotion) return;
      ripplesRef.current.push({ x, y, born: performance.now() });
      ensureLoop();
    }

    function spawnConfetti(x, y) {
      if (reducedMotion) return;
      const palette = themeRgbPair();
      const now = performance.now();
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / CONFETTI_COUNT + (Math.random() - 0.5) * 0.85;
        const speed = 5 + Math.random() * 9;
        const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];
        const w = 3 + Math.random() * 5;
        const h = 2 + Math.random() * 4;
        confettiRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          w,
          h,
          r,
          g,
          b,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.25,
          born: now,
        });
      }
      ensureLoop();
    }

    function ensureLoop() {
      if (!activeRef.current) {
        activeRef.current = true;
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    function animate(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ripplesRef.current = ripplesRef.current.filter((r) => {
        const age = time - r.born;
        if (age > RIPPLE_LIFETIME_MS) return false;
        const t = age / RIPPLE_LIFETIME_MS;
        const radius = t * RIPPLE_MAX_RADIUS;
        const alpha = (1 - t) * 0.45;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 114, 182, ${alpha * 0.7})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        return true;
      });

      confettiRef.current = confettiRef.current.filter((p) => {
        const age = time - p.born;
        if (age > CONFETTI_LIFETIME_MS) return false;
        const progress = age / CONFETTI_LIFETIME_MS;
        const alpha = (1 - progress) * (1 - progress);

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.vy += 0.12;
        p.rot += p.rotSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = `rgba(${p.r},${p.g},${p.b},${Math.min(1, alpha * 1.2)})`;
        ctx.shadowBlur = 12;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
        return true;
      });

      if (ripplesRef.current.length > 0 || confettiRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        activeRef.current = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    function handlePointerDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      spawnRipple(e.clientX, e.clientY);
      const el = e.target?.closest?.(BUTTON_SELECTOR);
      if (el && !el.disabled && el.getAttribute('aria-disabled') !== 'true') {
        const rect = el.getBoundingClientRect();
        spawnConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
      canvas.remove();
      canvasRef.current = null;
    };
  }, [enabled]);
}
