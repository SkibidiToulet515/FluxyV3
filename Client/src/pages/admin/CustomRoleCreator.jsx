import { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../../utils/permissions';
import { roleTierFromDefinition, tierRank } from '../../lib/rbacClient';

export default function CustomRoleCreator({ onCreated }) {
  const [key, setKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState(() =>
    Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])),
  );
  const [grantable, setGrantable] = useState(PERMISSION_KEYS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [dangerAck, setDangerAck] = useState(false);

  useEffect(() => {
    apiJson('/api/roles')
      .then((d) => setGrantable(Array.isArray(d.grantablePermissions) ? d.grantablePermissions : PERMISSION_KEYS))
      .catch(() => setGrantable(PERMISSION_KEYS));
  }, []);

  function togglePerm(p) {
    if (!grantable.includes(p)) return;
    setPerms((prev) => ({ ...prev, [p]: !prev[p] }));
  }

  const highSelected = tierRank(roleTierFromDefinition({ key: 'custom', permissions: perms })) >= 2;

  async function handleCreate(e) {
    e.preventDefault();
    setMsg('');
    if (highSelected && !dangerAck) {
      setMsg('Acknowledge high-privilege role creation below.');
      return;
    }
    setSaving(true);
    try {
      await apiJson('/api/roles', {
        method: 'POST',
        body: {
          key: key.trim().toLowerCase(),
          displayName: displayName.trim(),
          description: description.trim(),
          permissions: perms,
        },
      });
      setKey('');
      setDisplayName('');
      setDescription('');
      setPerms(Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])));
      setDangerAck(false);
      onCreated?.();
      setMsg('Role created.');
    } catch (err) {
      setMsg(err.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-custom-role glass-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
      <h4 className="admin-custom-role-title">Create custom role</h4>
      <p className="admin-form-hint" style={{ marginBottom: '0.75rem' }}>
        Permissions you cannot grant are hidden. High-privilege roles require confirmation. Server enforces limits.
      </p>
      <form className="admin-form-grid" onSubmit={handleCreate}>
        <label>
          <span>Role key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="support_staff" required />
        </label>
        <label>
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Support Staff" required />
        </label>
        <label className="span-2">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </label>
        <div className="span-2 admin-perm-grid">
          {PERMISSION_KEYS.filter((p) => grantable.includes(p)).map((p) => (
            <label key={p} className="admin-toggle-label">
              <input type="checkbox" checked={!!perms[p]} onChange={() => togglePerm(p)} />
              {PERMISSION_LABELS[p] || p}
            </label>
          ))}
        </div>
        {highSelected && (
          <label className="span-2 admin-toggle-label admin-danger-ack">
            <input type="checkbox" checked={dangerAck} onChange={(e) => setDangerAck(e.target.checked)} />
            I understand this role may include admin-level capabilities
          </label>
        )}
        {msg && <p className="span-2 admin-muted">{msg}</p>}
        <div className="span-2">
          <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={saving}>
            {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
            Create role
          </button>
        </div>
      </form>
    </div>
  );
}
