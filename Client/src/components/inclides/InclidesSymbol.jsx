import { useId } from 'react';

/**
 * Brand mark for Inclides — abstract crystal / presence glyph.
 */
export default function InclidesSymbol({ size = 18, className = '' }) {
  const gid = useId().replace(/:/g, '');
  const gradId = `inclides-g-${gid}`;
  return (
    <svg
      className={`inclides-symbol ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2L4 8.5V15.5L12 22L20 15.5V8.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        fill={`url(#${gradId})`}
        fillOpacity="0.22"
      />
      <path
        d="M12 7L8 10.25V14.75L12 18L16 14.75V10.25L12 7Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <circle cx="12" cy="12.5" r="1.35" fill="currentColor" fillOpacity="0.85" />
      <defs>
        <linearGradient id={gradId} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
    </svg>
  );
}
