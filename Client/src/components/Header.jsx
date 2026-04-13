import { Menu } from 'lucide-react';
import './Header.css';

export default function Header({ title, onMenuClick, children, className = '', eyebrow, titleId }) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="header-left">
        <button type="button" className="header-menu-btn" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div className="header-titles">
          {eyebrow ? <span className="header-eyebrow">{eyebrow}</span> : null}
          <h1 id={titleId} className="header-title">{title}</h1>
        </div>
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}
