import { useState, useRef } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { apiJson } from '../../services/apiClient';

export default function DataSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');
  const importRef = useRef(null);

  async function handleExport() {
    setExporting(true);
    setMessage('');
    try {
      const data = await apiJson('/api/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fluxy-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded.');
    } catch (err) {
      setMessage(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMessage('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.version !== 1) throw new Error('Invalid export format');
      const res = await apiJson('/api/import', { method: 'POST', body: data });
      setMessage(`Imported: ${res.fieldsUpdated?.join(', ') || 'done'}`);
    } catch (err) {
      setMessage(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="settings-section glass-card">
      <div className="settings-section-header">
        <Download size={20} />
        <div>
          <h3>Data</h3>
          <p>Export or import your Fluxy data</p>
        </div>
      </div>
      <div className="settings-data-actions">
        <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          Export Data
        </button>
        <button className="btn btn-secondary" onClick={() => importRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
          Import Data
        </button>
        <input ref={importRef} type="file" accept="application/json" onChange={handleImport} hidden />
      </div>
      {message && <p className="settings-data-msg">{message}</p>}
      <p className="settings-hint">Export downloads a JSON file of your profile, settings, and memberships. Import restores settings and bio only.</p>
    </section>
  );
}
