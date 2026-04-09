import { Search, X } from 'lucide-react';
import './SearchBar.css';

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="search-bar">
      <Search size={18} className="search-icon" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="search-input"
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
