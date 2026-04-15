import './GlassModal.css';

/**
 * Shared premium glass modal shell (giveaways, referral, announcements).
 * Matches dark navy glass + neon cyan border + blurred backdrop.
 */
export default function GlassModal({
  open,
  icon,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  footerExtra,
  className = '',
}) {
  const secondary = secondaryLabel === undefined ? 'Maybe later' : secondaryLabel;
  if (!open) return null;

  return (
    <div className={`fluxy-glass-modal-overlay ${className}`} role="dialog" aria-modal="true" aria-labelledby="fluxy-glass-modal-title">
      <div className="fluxy-glass-modal-backdrop" aria-hidden />
      <div className="fluxy-glass-modal-card">
        {icon && <div className="fluxy-glass-modal-icon">{icon}</div>}
        {title && (
          <h2 id="fluxy-glass-modal-title" className="fluxy-glass-modal-title">
            {title}
          </h2>
        )}
        {subtitle && <p className="fluxy-glass-modal-subtitle">{subtitle}</p>}
        <div className="fluxy-glass-modal-body">{children}</div>
        <div className="fluxy-glass-modal-actions">
          <button
            type="button"
            className="fluxy-glass-modal-btn-primary"
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
          >
            {primaryLoading ? <span className="fluxy-glass-modal-spinner" /> : null}
            {primaryLabel}
          </button>
          {secondary != null && secondary !== '' && (
            <button type="button" className="fluxy-glass-modal-btn-secondary" onClick={onSecondary}>
              {secondary}
            </button>
          )}
        </div>
        {footerExtra ? <div className="fluxy-glass-modal-footer-extra">{footerExtra}</div> : null}
      </div>
    </div>
  );
}
