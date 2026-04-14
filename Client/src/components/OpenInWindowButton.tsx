import { AppWindow } from 'lucide-react';
import { openStandaloneWindow } from '../standalone/openStandaloneWindow';
import './OpenInWindowButton.css';

export interface OpenInWindowButtonProps {
  /** Internal path only (e.g. `/games/my-id`, `/chat`). */
  path: string;
  className?: string;
  label?: string;
  /** If true, only the icon is shown (still has accessible name). */
  iconOnly?: boolean;
}

export default function OpenInWindowButton({
  path,
  className = '',
  label = 'Open in window',
  iconOnly = false,
}: OpenInWindowButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn-ghost open-in-window-btn ${className}`.trim()}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openStandaloneWindow(path);
      }}
    >
      <AppWindow size={16} aria-hidden />
      {!iconOnly && <span className="open-in-window-btn__text">{label}</span>}
    </button>
  );
}
