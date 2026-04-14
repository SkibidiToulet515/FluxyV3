import './GlitchText.css';

/**
 * Cyberpunk-style RGB split (cyan / pink). Hover to glitch, or pass auto for a looping glitch.
 */
export default function GlitchText({
  children,
  as: Tag = 'span',
  auto = false,
  className = '',
}) {
  const text = typeof children === 'string' ? children : '';
  const cls = ['fluxy-glitch-text', auto && 'fluxy-glitch-text--auto', className].filter(Boolean).join(' ');

  return (
    <Tag className={cls} data-text={text || undefined}>
      {children}
    </Tag>
  );
}
