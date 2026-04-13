import { useEffect, useRef, useState } from 'react';
import './CustomCursor.css';

export default function CustomCursor({ enabled = true }) {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const pos = useRef({ x: -100, y: -100 });
  const visible = useRef(false);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove('custom-cursor-active');
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('custom-cursor-active');

    function onMove(e) {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (!visible.current) {
        visible.current = true;
        if (dotRef.current) dotRef.current.style.opacity = '1';
        if (ringRef.current) ringRef.current.style.opacity = '1';
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
      if (ringRef.current && reducedMotion) {
        ringRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    }

    function onOver(e) {
      const t = e.target;
      if (t.matches?.('button, a, input, textarea, select, [role="button"], label, .sidebar-link, .taskbar-link, .dc-chat-item, .game-card')) {
        setHovering(true);
      }
    }

    function onOut(e) {
      const t = e.target;
      if (t.matches?.('button, a, input, textarea, select, [role="button"], label, .sidebar-link, .taskbar-link, .dc-chat-item, .game-card')) {
        setHovering(false);
      }
    }

    function onLeave() {
      visible.current = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    }

    let raf;
    function animateRing() {
      if (ringRef.current && !reducedMotion) {
        const rect = ringRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = cx + (pos.current.x - cx) * 0.15;
        const ny = cy + (pos.current.y - cy) * 0.15;
        ringRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
      }
      raf = requestAnimationFrame(animateRing);
    }
    raf = requestAnimationFrame(animateRing);

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      document.documentElement.classList.remove('custom-cursor-active');
      cancelAnimationFrame(raf);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={dotRef} className="cc-dot" style={{ opacity: 0 }} />
      <div ref={ringRef} className={`cc-ring ${hovering ? 'cc-ring-hover' : ''}`} style={{ opacity: 0 }} />
    </>
  );
}
