import { useState, useEffect } from 'react';
import { X, RotateCcw, Save, Eye } from 'lucide-react';
import { useTheme } from '../themes/ThemeContext';
import './ThemeMaker.css';

const EDITABLE_VARS = [
  { key: '--bg-primary', label: 'Background', type: 'color' },
  { key: '--bg-card', label: 'Card Background', type: 'color' },
  { key: '--text-primary', label: 'Text Primary', type: 'color' },
  { key: '--text-secondary', label: 'Text Secondary', type: 'color' },
  { key: '--accent', label: 'Accent', type: 'color' },
  { key: '--accent-hover', label: 'Accent Hover', type: 'color' },
  { key: '--gradient-start', label: 'Gradient Start', type: 'color' },
  { key: '--gradient-end', label: 'Gradient End', type: 'color' },
  { key: '--border', label: 'Border', type: 'color' },
];

const DEFAULT_CUSTOM = {
  '--bg-primary': '#0b0b1e',
  '--bg-secondary': 'rgba(255,255,255,0.04)',
  '--bg-card': '#1a1a2e',
  '--bg-card-hover': '#24243e',
  '--bg-sidebar': '#0b0b1e',
  '--bg-input': '#1a1a2e',
  '--text-primary': '#f0f0f5',
  '--text-secondary': '#b0b0c0',
  '--text-muted': '#6e6e82',
  '--accent': '#7b8aff',
  '--accent-hover': '#a5afff',
  '--accent-soft': 'rgba(123,138,255,0.14)',
  '--border': '#2a2a4a',
  '--shadow': '0 8px 40px rgba(0,0,0,0.25)',
  '--blur': '20px',
  '--radius': '16px',
  '--gradient-start': '#7b8aff',
  '--gradient-end': '#c084fc',
};

function toHex(val) {
  if (!val) return '#000000';
  if (val.startsWith('#') && val.length >= 7) return val.slice(0, 7);
  if (val.startsWith('rgba') || val.startsWith('rgb')) {
    const m = val.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      const [r, g, b] = m.map(Number);
      return '#' + [r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
    }
  }
  return '#000000';
}

export default function ThemeMaker({ onClose, onSave }) {
  const { themes } = useTheme();
  const existing = themes.__custom?.vars;
  const [vars, setVars] = useState(() => ({ ...DEFAULT_CUSTOM, ...(existing || {}) }));
  const [previewing, setPreviewing] = useState(true);

  useEffect(() => {
    if (!previewing) return;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    return () => {};
  }, [vars, previewing]);

  function handleChange(key, value) {
    const next = { ...vars };
    next[key] = value;
    if (key === '--accent') {
      next['--accent-soft'] = value + '24';
    }
    if (key === '--bg-card') {
      next['--bg-card-hover'] = value;
      next['--bg-secondary'] = value;
      next['--bg-input'] = value;
      next['--bg-sidebar'] = value;
    }
    setVars(next);
  }

  function handleReset() {
    setVars({ ...DEFAULT_CUSTOM });
  }

  function handleSave() {
    onSave(vars);
    onClose();
  }

  return (
    <div className="tm-overlay" onClick={onClose}>
      <div className="tm-panel glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="tm-header">
          <h3>Custom Theme Maker</h3>
          <button className="tm-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="tm-body">
          {EDITABLE_VARS.map(({ key, label }) => (
            <div key={key} className="tm-row">
              <label className="tm-label">{label}</label>
              <div className="tm-input-wrap">
                <input
                  type="color"
                  value={toHex(vars[key])}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="tm-color-input"
                />
                <span className="tm-color-hex">{toHex(vars[key])}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="tm-preview-bar">
          <div className="tm-preview-swatch" style={{ background: vars['--bg-primary'] }}>
            <span style={{ color: vars['--text-primary'] }}>Aa</span>
          </div>
          <div className="tm-preview-swatch" style={{ background: `linear-gradient(135deg, ${vars['--gradient-start']}, ${vars['--gradient-end']})` }}>
            <span style={{ color: '#fff' }}>Grad</span>
          </div>
          <div className="tm-preview-swatch" style={{ background: vars['--accent'] }}>
            <span style={{ color: '#fff' }}>Accent</span>
          </div>
        </div>

        <div className="tm-actions">
          <button className="btn btn-ghost" onClick={handleReset}><RotateCcw size={14} /> Reset</button>
          <button className="btn btn-ghost" onClick={() => setPreviewing(!previewing)}>
            <Eye size={14} /> {previewing ? 'Stop Preview' : 'Preview'}
          </button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Save Theme</button>
        </div>
      </div>
    </div>
  );
}
