import { Menu } from 'lucide-react';
import './Header.css';

export default function Header({ title, onMenuClick, children }) {
  return (
    <header className="page-header">
      <div className="header-left">
        <button className="header-menu-btn" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}
