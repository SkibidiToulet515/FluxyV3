import { useEffect, useRef } from 'react';

const COUNT_MIN = 10;
const COUNT_MAX = 16;
const LIFETIME = 500;
const SPEED = 4;
const SIZE_MIN = 3;
const SIZE_MAX = 7;

const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond'];

function pickShape() {
  return SHAPES[Math.floor(Math.random() * SHAPES.length)];
}

function drawStar(ctx, cx, cy, r, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const method = i === 0 ? 'moveTo' : 'lineTo';
    ctx[method](cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDiamond(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.65, cy);
  ctx.lineTo(cx, cy + s);
  ctx.lineTo(cx - s * 0.65, cy);
  ctx.closePath();
  ctx.fill();
}

function drawTriangle(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.87, cy + s * 0.5);
  ctx.lineTo(cx - s * 0.87, cy + s * 0.5);
  ctx.closePath();
  ctx.fill();
}

export default function useClickEffect(enabled = true) {
  const particlesRef = useRef([]);
  const rafRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:9999;pointer-events:none;width:100%;height:100%';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function getColors() {
      const s = getComputedStyle(document.documentElement);
      const accent = s.getPropertyValue('--accent').trim() || '#6366f1';
      const end = s.getPropertyValue('--gradient-end').trim() || '#8b5cf6';
      return [hexToRgb(accent), hexToRgb(end)];
    }

    function hexToRgb(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function spawn(x, y) {
      const count = COUNT_MIN + Math.floor(Math.random() * (COUNT_MAX - COUNT_MIN + 1));
      const [c1, c2] = getColors();
      const now = performance.now();

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        const speed = SPEED * (0.4 + Math.random() * 0.9);
        const size = SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN);
        const [r, g, b] = Math.random() > 0.5 ? c1 : c2;

        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          r, g, b,
          born: now,
          shape: pickShape(),
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.15,
        });
      }

      if (!activeRef.current) {
        activeRef.current = true;
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    function animate(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter(p => {
        const age = time - p.born;
        if (age > LIFETIME) return false;

        const progress = age / LIFETIME;
        const alpha = 1 - progress * progress;
        const scale = 1 - progress * 0.3;

        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.vy += 0.05;
        p.rotation += p.rotSpeed;

        const s = p.size * scale;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.shadowColor = `rgba(${p.r},${p.g},${p.b},${alpha * 0.5})`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        switch (p.shape) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(0, 0, s, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'square':
            ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
            break;
          case 'triangle':
            drawTriangle(ctx, 0, 0, s);
            break;
          case 'star':
            drawStar(ctx, 0, 0, s, 5);
            break;
          case 'diamond':
            drawDiamond(ctx, 0, 0, s);
            break;
        }

        ctx.restore();
        return true;
      });

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        activeRef.current = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    function handlePointerDown(e) {
      spawn(e.clientX, e.clientY);
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
      canvas.remove();
    };
  }, [enabled]);
}
