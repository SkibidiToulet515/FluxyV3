import { useId } from 'react';
import './FilmGrain.css';

export default function FilmGrain() {
  const id = useId().replace(/:/g, '');
  const filterId = `film-grain-${id}`;

  return (
    <div className="film-grain-layer" aria-hidden>
      <svg className="film-grain-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="3"
              stitchTiles="stitch"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.88;0.95;0.82;0.9;0.88"
                dur="12s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feColorMatrix in="noise" type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  );
}
