import { useEffect, useRef } from 'react';
import './Background.css';

/**
 * @param {{ mode?: 'static' | 'light' | 'full' }} props
 * - static: one gradient frame (cheapest)
 * - light: fewer meteors / particles / spawns (balanced tier)
 * - full: original effect
 */
export default function Background({ mode = 'full' }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ meteors: [], particles: [] });
  const rafRef = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w;
    let h;

    const meteorMax = mode === 'light' ? 10 : 18;
    const particleMax = mode === 'light' ? 28 : 60;
    const spawnInterval = mode === 'light' ? 360 : 280;
    const particleChance = mode === 'light' ? 0.18 : 0.3;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function hexToRgb(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function getThemeColors() {
      const s = getComputedStyle(document.documentElement);
      const v = (k, fb) => s.getPropertyValue(k).trim() || fb;
      return {
        start: hexToRgb(v('--gradient-start', '#6366f1')),
        end: hexToRgb(v('--gradient-end', '#8b5cf6')),
        accent: hexToRgb(v('--accent', '#6366f1')),
      };
    }

    function drawStatic() {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      const colors = getThemeColors();
      const grad = ctx.createLinearGradient(w, 0, 0, h);
      const [sr, sg, sb] = colors.start;
      const [er, eg, eb] = colors.end;
      grad.addColorStop(0, `rgba(${sr},${sg},${sb},0.08)`);
      grad.addColorStop(1, `rgba(${er},${eg},${eb},0.04)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    function spawnMeteor() {
      const st = stateRef.current;
      if (st.meteors.length >= meteorMax) return;
      const depth = 0.3 + Math.random() * 0.7;
      const speed = (3 + Math.random() * 5) * depth;
      const angle = Math.PI * (0.72 + Math.random() * 0.12);
      st.meteors.push({
        x: Math.random() * (w + 400) - 100,
        y: -20 - Math.random() * h * 0.4,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        size: (1 + Math.random() * 2.5) * depth,
        tailLen: (80 + Math.random() * 120) * depth,
        life: 0,
        maxLife: 120 + Math.random() * 100,
        depth,
        useEnd: Math.random() > 0.5,
      });
    }

    function spawnParticle(x, y, colors) {
      const st = stateRef.current;
      if (st.particles.length >= particleMax) return;
      const [r, g, b] = Math.random() > 0.5 ? colors.start : colors.end;
      st.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: 0.5 + Math.random() * 1.5,
        life: 0,
        maxLife: 40 + Math.random() * 40,
        r,
        g,
        b,
      });
    }

    resize();
    window.addEventListener('resize', resize);

    const useStatic = mode === 'static' || reducedMotion.current;
    if (useStatic) {
      drawStatic();
      const onResizeStatic = () => {
        resize();
        drawStatic();
      };
      window.removeEventListener('resize', resize);
      window.addEventListener('resize', onResizeStatic);
      return () => window.removeEventListener('resize', onResizeStatic);
    }

    let spawnTimer = setInterval(spawnMeteor, spawnInterval);

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const { meteors, particles } = stateRef.current;
      const colors = getThemeColors();

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y -= m.vy;
        m.life++;

        if (m.life > m.maxLife || m.x < -200 || m.x > w + 200 || m.y > h + 200) {
          meteors.splice(i, 1);
          continue;
        }

        const progress = m.life / m.maxLife;
        const fadeIn = Math.min(progress * 5, 1);
        const fadeOut = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
        const alpha = fadeIn * fadeOut * (0.4 + m.depth * 0.6);

        const [cr, cg, cb] = m.useEnd ? colors.end : colors.start;
        const norm = Math.hypot(m.vx, m.vy) || 1;
        const dx = m.vx / norm;
        const dy = -m.vy / norm;

        const tailX = m.x - dx * m.tailLen;
        const tailY = m.y + dy * m.tailLen;

        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(0.15, `rgba(${cr},${cg},${cb},${alpha * 0.7})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = m.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(m.x, m.y, Math.max(0, m.size * 1.5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(m.x, m.y, Math.max(0, m.size * 4 * m.depth), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha * 0.12})`;
        ctx.fill();

        if (Math.random() < particleChance) {
          spawnParticle(
            m.x - dx * m.tailLen * (0.2 + Math.random() * 0.5),
            m.y + dy * m.tailLen * (0.2 + Math.random() * 0.5),
            colors,
          );
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life++;
        if (p.life > p.maxLife) {
          particles.splice(i, 1);
          continue;
        }
        const a = 1 - p.life / p.maxLife;
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(spawnTimer);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="animated-background" />;
}
