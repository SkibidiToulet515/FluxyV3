import { useState, useEffect } from 'react';
import './LoadingScreen.css';

export default function LoadingScreen({ onDone }) {
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHiding(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hiding) return;
    const timer = setTimeout(() => onDone(), 500);
    return () => clearTimeout(timer);
  }, [hiding, onDone]);

  return (
    <div className={`loading-screen ${hiding ? 'hiding' : ''}`}>
      <div className="loading-glow" />
      <div className="loading-center">
        <div className="loading-logo">
          <span className="loading-logo-letter">F</span>
          <div className="loading-ring" />
          <div className="loading-ring ring-2" />
        </div>
        <div className="loading-text">Fluxy</div>
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
