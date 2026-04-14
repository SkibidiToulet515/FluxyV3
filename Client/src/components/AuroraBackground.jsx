import './AuroraBackground.css';

/**
 * @param {{ variant?: 'animated' | 'static' }} props
 * static = CSS gradients only (no animated blobs — much cheaper on weak GPUs).
 */
export default function AuroraBackground({ variant = 'animated' }) {
  const staticOnly = variant === 'static';

  return (
    <div className={`aurora-bg${staticOnly ? ' aurora-bg--static-only' : ''}`} aria-hidden>
      {!staticOnly && (
        <>
          <div className="aurora-blob aurora-blob--a" />
          <div className="aurora-blob aurora-blob--b" />
          <div className="aurora-blob aurora-blob--c" />
          <div className="aurora-blob aurora-blob--d" />
        </>
      )}
    </div>
  );
}
