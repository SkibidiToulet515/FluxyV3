import { useState } from 'react';
import { X, Check, Star, Eye, Loader2 } from 'lucide-react';
import { normalizeFirestoreGameUrlInput } from '../../utils/gamePlayUrl';
import { SUBJECT_KEYS } from '../../config/subjects';
import { CATEGORIES } from './adminHelpers';

export default function GameForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || 'Uncategorized');
  const [subject, setSubject] = useState(initial?.subject || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [gameFile, setGameFile] = useState(null);
  const [featured, setFeatured] = useState(initial?.featured || false);
  const [visible, setVisible] = useState(initial?.visible !== false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const urlTrim = url.trim();
    if (!initial && !urlTrim && !gameFile) return;
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          category,
          subject: subject || null,
          description: description.trim(),
          thumbnail: thumbnail.trim(),
          url: normalizeFirestoreGameUrlInput(urlTrim),
          featured,
          visible,
        },
        gameFile || undefined,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-game-form glass-card" onSubmit={handleSubmit}>
      <div className="admin-form-header">
        <h4>{initial ? 'Edit Game' : 'Add New Game'}</h4>
        <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={onCancel}><X size={16} /></button>
      </div>
      <div className="admin-form-grid">
        <label>
          <span>Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Game title" required />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span>Subject</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Auto (infer from title)</option>
            {SUBJECT_KEYS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="span-2">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" rows={2} />
        </label>
        <label>
          <span>Thumbnail URL</span>
          <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://..." />
        </label>
        <label className="span-2">
          <span>Game HTML file (Firebase Storage)</span>
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={(e) => setGameFile(e.target.files?.[0] || null)}
          />
          <span className="admin-form-hint">
            Optional if you set a URL below. Mods/admins only; max ~100MB. Re-upload replaces the file in Storage.
          </span>
        </label>
        <label className="span-2">
          <span>Game URL / Path</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="games/MyGame.html or external https://…" />
          <span className="admin-form-hint">
            For UGS library games use <code>games/FileName.html</code> (not the API URL — those hit LFS stubs). Leave empty when uploading a file.
          </span>
        </label>
        <div className="admin-form-toggles">
          <label className="admin-toggle-label">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <Star size={13} /> Featured
          </label>
          <label className="admin-toggle-label">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            <Eye size={13} /> Visible
          </label>
        </div>
      </div>
      <div className="admin-form-actions">
        <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          type="submit"
          className="admin-btn admin-btn-primary"
          disabled={
            saving
            || !title.trim()
            || (!initial && !url.trim() && !gameFile)
          }
        >
          {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
          {initial ? 'Save Changes' : 'Create Game'}
        </button>
      </div>
    </form>
  );
}
