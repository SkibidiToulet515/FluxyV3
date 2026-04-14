import { useEffect, useRef, useState } from 'react';
import './CustomCursor.css';

const GLOW_LERP = 0.055;

export default function CustomCursor({ enabled = true }) {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const hoveringRef = useRef(false);
  const pos = useRef({ x: -100, y: -100 });
  const glowPos = useRef({ x: -100, y: -100 });
  const visible = useRef(false);
  const pressedRef = useRef(false);

  useEffect(() => {
    hoveringRef.current = hovering;
  }, [hovering]);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove('custom-cursor-active');
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('custom-cursor-active');

    function applyDotTransform(x, y) {
      const el = dotRef.current;
      if (!el) return;
      const p = pressedRef.current;
      const h = hoveringRef.current;
      let sx = 1;
      let sy = 1;
      if (p) {
        sx = 0.86;
        sy = 1.16;
      } else if (h) {
        sx = 1.42;
        sy = 1.42;
      }
      el.style.transform = `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
    }

    function onMove(e) {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (!visible.current) {
        visible.current = true;
        glowPos.current = { x: e.clientX, y: e.clientY };
        if (dotRef.current) dotRef.current.style.opacity = '1';
        if (ringRef.current) ringRef.current.style.opacity = '1';
        if (glowRef.current) glowRef.current.style.opacity = '1';
      }
      applyDotTransform(e.clientX, e.clientY);
      if (ringRef.current && reducedMotion) {
        const p = pressedRef.current;
        const h = hoveringRef.current;
        const sx = p ? 0.82 : h ? 1.22 : 1;
        const sy = p ? 1.1 : h ? 1.22 : 1;
        ringRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) scale(${sx}, ${sy})`;
      }
    }

    function onOver(e) {
      const t = e.target;
      if (
        t.matches?.(
          'button, a, input, textarea, select, [role="button"], label, .sidebar-link, .taskbar-link, .dc-chat-item, .game-card, summary',
        )
      ) {
        hoveringRef.current = true;
        setHovering(true);
      }
    }

    function onOut(e) {
      const t = e.target;
      if (
        t.matches?.(
          'button, a, input, textarea, select, [role="button"], label, .sidebar-link, .taskbar-link, .dc-chat-item, .game-card, summary',
        )
      ) {
        hoveringRef.current = false;
        setHovering(false);
      }
    }

    function onLeave() {
      visible.current = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
      if (glowRef.current) glowRef.current.style.opacity = '0';
    }

    function onDown() {
      pressedRef.current = true;
      applyDotTransform(pos.current.x, pos.current.y);
    }

    function onUp() {
      pressedRef.current = false;
      applyDotTransform(pos.current.x, pos.current.y);
    }

    let raf;
    function animateRing() {
      if (!reducedMotion) {
        if (ringRef.current) {
          const rect = ringRef.current.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const nx = cx + (pos.current.x - cx) * 0.15;
          const ny = cy + (pos.current.y - cy) * 0.15;
          const p = pressedRef.current;
          const h = hoveringRef.current;
          const sx = p ? 0.78 : h ? 1.32 : 1;
          const sy = p ? 1.12 : h ? 1.32 : 1;
          ringRef.current.style.transform = `translate(${nx}px, ${ny}px) scale(${sx}, ${sy})`;
        }
        if (glowRef.current && visible.current) {
          const g = glowPos.current;
          const tx = pos.current.x;
          const ty = pos.current.y;
          g.x += (tx - g.x) * GLOW_LERP;
          g.y += (ty - g.y) * GLOW_LERP;
          const glowScale = pressedRef.current ? 0.9 : hoveringRef.current ? 1.15 : 1;
          glowRef.current.style.transform = `translate(${g.x}px, ${g.y}px) scale(${glowScale})`;
        }
      } else if (glowRef.current) {
        glowRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px)`;
      }
      raf = requestAnimationFrame(animateRing);
    }
    raf = requestAnimationFrame(animateRing);

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('pointercancel', onUp, { capture: true });

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointerup', onUp, { capture: true });
      window.removeEventListener('pointercancel', onUp, { capture: true });
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={glowRef} className="cc-glow" style={{ opacity: 0 }} aria-hidden />
      <div ref={dotRef} className="cc-dot" style={{ opacity: 0 }} />
      <div
        ref={ringRef}
        className={`cc-ring ${hovering ? 'cc-ring-hover' : ''}`}
        style={{ opacity: 0 }}
      />
    </>
  );
}
