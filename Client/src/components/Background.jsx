import { useEffect, useRef } from 'react';
import './Background.css';

const STAR_COUNT = 200;
const NEBULA_COUNT = 5;
const SHOOTING_STAR_INTERVAL = 3200;

export default function Background() {
  const canvasRef = useRef(null);
  const stateRef = useRef({ stars: [], nebulae: [], shootingStars: [] });
  const rafRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      init();
    }

    function getThemeColors() {
      const s = getComputedStyle(document.documentElement);
      const hex = (v, fb) => s.getPropertyValue(v).trim() || fb;
      return {
        start: hexToRgb(hex('--gradient-start', '#6366f1')),
        end: hexToRgb(hex('--gradient-end', '#8b5cf6')),
        accent: hexToRgb(hex('--accent', '#6366f1')),
      };
    }

    function hexToRgb(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function init() {
      const st = stateRef.current;
      st.stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.3 + Math.random() * 1.8,
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinklePhase: Math.random() * Math.PI * 2,
        depth: 0.2 + Math.random() * 0.8,
      }));
      st.nebulae = Array.from({ length: NEBULA_COUNT }, (_, i) => ({
        x: (w * (i + 0.5)) / NEBULA_COUNT + (Math.random() - 0.5) * w * 0.3,
        y: h * 0.25 + Math.random() * h * 0.5,
        radius: 220 + Math.random() * 320,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.18,
        phase: Math.random() * Math.PI * 2,
        useEnd: i % 2 === 1,
      }));
      st.shootingStars = [];
    }

    function spawnShootingStar() {
      const st = stateRef.current;
      if (st.shootingStars.length >= 2) return;
      const angle = -0.3 - Math.random() * 0.5;
      const speed = 7 + Math.random() * 7;
      st.shootingStars.push({
        x: Math.random() * w * 1.2,
        y: -10,
        vx: Math.cos(angle) * speed,
        vy: -Math.sin(angle) * speed,
        life: 0,
        maxLife: 40 + Math.random() * 30,
        size: 1 + Math.random() * 1.5,
      });
    }

    let shootingTimer = setInterval(spawnShootingStar, SHOOTING_STAR_INTERVAL);

    function onMouseMove(e) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    resize();
    window.addEventListener('resize', resize);

    function draw(time) {
      ctx.clearRect(0, 0, w, h);
      const { stars, nebulae, shootingStars } = stateRef.current;
      const colors = getThemeColors();
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const neb of nebulae) {
        neb.x += neb.vx;
        neb.y += neb.vy;
        if (neb.x < -neb.radius) neb.x = w + neb.radius;
        if (neb.x > w + neb.radius) neb.x = -neb.radius;
        if (neb.y < -neb.radius) neb.y = h + neb.radius;
        if (neb.y > h + neb.radius) neb.y = -neb.radius;

        const pulse = Math.sin(time * 0.0004 + neb.phase) * 0.22 + 1;
        const r = neb.radius * pulse;
        const [cr, cg, cb] = neb.useEnd ? colors.end : colors.start;

        const grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, r);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.07)`);
        grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.03)`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(neb.x, neb.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      const [ar, ag, ab] = colors.accent;
      for (const star of stars) {
        const parallax = star.depth * 0.02;
        const sx = star.x + (mx - w / 2) * parallax;
        const sy = star.y + (my - h / 2) * parallax;

        const twinkle =
          0.3 + 0.7 * ((Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase) + 1) / 2);
        const alpha = twinkle * (0.4 + star.depth * 0.6);

        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgb(${200 + ar * 0.2},${200 + ag * 0.2},${210 + ab * 0.15})`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();

        if (star.size > 1.2 && twinkle > 0.85) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(sx, sy, star.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const ss = shootingStars[i];
        ss.x += ss.vx;
        ss.y += ss.vy;
        ss.life++;
        if (ss.life > ss.maxLife || ss.x > w + 50 || ss.y > h + 50) {
          shootingStars.splice(i, 1);
          continue;
        }
        const progress = ss.life / ss.maxLife;
        const alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
        const tailLen = 35 + progress * 25;
        const norm = Math.hypot(ss.vx, ss.vy);

        const grad = ctx.createLinearGradient(
          ss.x, ss.y,
          ss.x - (ss.vx / norm) * tailLen * 0.5,
          ss.y - (ss.vy / norm) * tailLen * 0.5,
        );
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = ss.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - (ss.vx / norm) * tailLen, ss.y - (ss.vy / norm) * tailLen);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(shootingTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="animated-background" />;
}
