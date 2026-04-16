import { useState, useEffect, useCallback } from 'react';
import {
  Gift, Loader2, Plus, Play, Square, Shuffle, Users, Eye, Ban, RotateCcw,
} from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import './GiveawaysAdminTab.css';

const defaultEligibility = () => ({
  audience: 'all',
  roleKeys: [],
  invitedUserIds: [],
  joinedBefore: null,
  joinedAfter: null,
  minInvites: 0,
  minMessages: 0,
  whitelistUsernames: [],
  blacklistUsernames: [],
  excludeBanned: true,
  excludeFlaggedAlts: true,
});

const defaultReq = () => ({
  mustBeLoggedIn: true,
  mustVerifyEmail: false,
  mustAcceptTerms: false,
  termsText: 'I have read and agree to the giveaway rules.',
  mustCompleteReferralOnboarding: false,
  mustJoinServerId: null,
  minInvitesToEnter: 0,
  accountOlderThanDays: 0,
});

/** Admin: create / manage giveaways + preview eligibility + pick winners */
export default function GiveawaysAdminTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null);
  const [entries, setEntries] = useState(null);
  const [creating, setCreating] = useState(false);
  const [resetUsername, setResetUsername] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    longMessage: '',
    prize: '',
    prizeImageUrl: '',
    buttonText: 'Enter giveaway',
    successText: "You've been entered into the giveaway!",
    closedText: 'This giveaway is closed.',
    winnerAnnouncementText: 'Thanks for participating!',
    endAt: '',
    winnerCount: 1,
    winnerMode: 'random',
    eligibility: { ...defaultEligibility(), blacklistStr: '', whitelistStr: '', roleKeys: '' },
    requirementRules: defaultReq(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson('/api/giveaways');
      setList(data.giveaways || []);
    } catch (e) {
      setMsg(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setMsg('');
    setCreating(true);
    try {
      const eRaw = form.eligibility;
      const roleKeys =
        typeof eRaw.roleKeys === 'string'
          ? eRaw.roleKeys.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(eRaw.roleKeys)
            ? eRaw.roleKeys
            : [];
      const eligibility = {
        audience: eRaw.audience || 'all',
        roleKeys,
        invitedUserIds: eRaw.invitedUserIds || [],
        joinedBefore: eRaw.joinedBefore ?? null,
        joinedAfter: eRaw.joinedAfter ?? null,
        minInvites: Number(eRaw.minInvites) || 0,
        minMessages: Number(eRaw.minMessages) || 0,
        whitelistUsernames: (eRaw.whitelistStr || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        blacklistUsernames: (eRaw.blacklistStr || '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        excludeBanned: eRaw.excludeBanned !== false,
        excludeFlaggedAlts: eRaw.excludeFlaggedAlts !== false,
      };
      await apiJson('/api/giveaways', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description,
          longMessage: form.longMessage,
          prize: form.prize,
          prizeImageUrl: form.prizeImageUrl,
          buttonText: form.buttonText,
          successText: form.successText,
          closedText: form.closedText,
          winnerAnnouncementText: form.winnerAnnouncementText,
          endAt: form.endAt || null,
          winnerCount: form.winnerCount,
          winnerMode: form.winnerMode,
          eligibility,
          requirementRules: form.requirementRules,
        },
      });
      setMsg('Giveaway created (draft). Publish when ready.');
      load();
    } catch (e) {
      setMsg(e.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function previewCount() {
    setMsg('');
    try {
      const body = {
        eligibility: {
          ...form.eligibility,
          roleKeys: typeof form.eligibility.roleKeys === 'string'
            ? form.eligibility.roleKeys.split(',').map((s) => s.trim()).filter(Boolean)
            : form.eligibility.roleKeys || [],
          blacklistUsernames: (form.eligibility.blacklistStr || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          whitelistUsernames: (form.eligibility.whitelistStr || '')
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        },
        maxScan: 8000,
      };
      const data = await apiJson('/api/giveaways/preview-eligibility', { method: 'POST', body });
      setPreview(data);
    } catch (e) {
      setMsg(e.message || 'Preview failed');
    }
  }

  async function publish(id) {
    setMsg('');
    try {
      await apiJson(`/api/giveaways/${encodeURIComponent(id)}/publish`, { method: 'POST' });
      setMsg('Published.');
      load();
    } catch (e) {
      setMsg(e.message || 'Publish failed');
    }
  }

  async function endGw(id) {
    setMsg('');
    try {
      await apiJson(`/api/giveaways/${encodeURIComponent(id)}/end`, { method: 'POST' });
      setMsg('Ended.');
      load();
    } catch (e) {
      setMsg(e.message || 'End failed');
    }
  }

  async function pickWinners(id) {
    setMsg('');
    try {
      const data = await apiJson(`/api/giveaways/${encodeURIComponent(id)}/pick-winners`, {
        method: 'POST',
        body: { replace: true, allowRepeat: false },
      });
      setMsg(`Picked winners: ${(data.winners || []).join(', ')}`);
      load();
    } catch (e) {
      setMsg(e.message || 'Pick failed');
    }
  }

  async function loadEntries(id) {
    setEntries(null);
    try {
      const data = await apiJson(`/api/giveaways/${encodeURIComponent(id)}/entries`);
      setEntries({ id, rows: data.entries || [] });
    } catch (e) {
      setMsg(e.message || 'Entries failed');
    }
  }

  async function disqualify(entryId) {
    try {
      await apiJson(`/api/giveaway-entries/${encodeURIComponent(entryId)}/disqualify`, {
        method: 'POST',
        body: { reason: 'admin' },
      });
      if (entries) loadEntries(entries.id);
    } catch (e) {
      setMsg(e.message || 'Failed');
    }
  }

  async function exportCsv() {
    if (!entries?.rows?.length) return;
    const lines = [['userId', 'username', 'enteredAt', 'disqualified'].join(',')];
    entries.rows.forEach((r) => {
      lines.push([
        r.userId || '',
        `"${(r.username || '').replace(/"/g, '""')}"`,
        r.enteredAt?.seconds || '',
        r.disqualified ? 'yes' : 'no',
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `giveaway-${entries.id}-entrants.csv`;
    a.click();
  }

  async function resetReferral() {
    const q = resetUsername.trim();
    if (!q) return;
    setMsg('');
    try {
      const t = q.toLowerCase();
      let users = [];
      try {
        const data = await apiJson(`/api/admin/users/search?q=${encodeURIComponent(t)}`);
        users = data.users || [];
      } catch (e) {
        if (e?.status === 404 || e?.status === 403) {
          const data = await apiJson(`/api/users?q=${encodeURIComponent(t)}&limit=24`);
          users = data.users || [];
        } else {
          throw e;
        }
      }
      if (users.length === 0) {
        const data = await apiJson(`/api/users?q=${encodeURIComponent(t)}&limit=24`);
        users = data.users || [];
      }
      const hit =
        users.find((u) => (u.username || '').toLowerCase() === t)
        || users[0];
      if (!hit?.uid) {
        setMsg('User not found — try the full username (2+ letters for search).');
        return;
      }
      await apiJson(`/api/admin/users/${encodeURIComponent(hit.uid)}/referral-reset`, { method: 'POST' });
      setMsg(`Referral onboarding reset for ${hit.username || 'user'}.`);
      setResetUsername('');
    } catch (e) {
      setMsg(e.message || 'Reset failed');
    }
  }

  return (
    <div className="admin-giveaway-page">
      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <Gift size={20} />
          <div>
            <h3>Create giveaway</h3>
            <p>
              Draft → publish. One published giveaway is shown at a time. Logged-in users see it as the same
              centered glass popup used elsewhere (after referral onboarding, if that modal applies).
            </p>
          </div>
        </div>
        {msg && <p className="admin-error-banner">{msg}</p>}
        <form className="admin-form-grid giveaway-admin-form" onSubmit={handleCreate}>
          <label><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label><span>Short description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="span-2"><span>Long message</span><textarea value={form.longMessage} onChange={(e) => setForm({ ...form, longMessage: e.target.value })} rows={3} /></label>
          <label><span>Prize</span><input value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} /></label>
          <label><span>Prize image URL</span><input value={form.prizeImageUrl} onChange={(e) => setForm({ ...form, prizeImageUrl: e.target.value })} placeholder="https://…" /></label>
          <label><span>Button text</span><input value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })} /></label>
          <label><span>Success text</span><input value={form.successText} onChange={(e) => setForm({ ...form, successText: e.target.value })} /></label>
          <label><span>End at (local)</span><input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required /></label>
          <label><span>Winner count</span><input type="number" min={1} max={50} value={form.winnerCount} onChange={(e) => setForm({ ...form, winnerCount: Number(e.target.value) })} /></label>
          <label><span>Winner mode</span>
            <select value={form.winnerMode} onChange={(e) => setForm({ ...form, winnerMode: e.target.value })}>
              <option value="random">Random</option>
              <option value="manual">Manual (set UIDs in Firestore/API)</option>
            </select>
          </label>
          <label><span>Audience</span>
            <select
              value={form.eligibility.audience}
              onChange={(e) => setForm({
                ...form,
                eligibility: { ...form.eligibility, audience: e.target.value },
              })}
            >
              <option value="all">All users</option>
              <option value="roles">Specific roles</option>
              <option value="whitelist">Whitelist usernames only</option>
              <option value="invited">Invited user IDs only</option>
            </select>
          </label>
          <label><span>Role keys (comma)</span><input placeholder="mod, admin" value={form.eligibility.roleKeys} onChange={(e) => setForm({ ...form, eligibility: { ...form.eligibility, roleKeys: e.target.value } })} /></label>
          <label><span>Blacklist usernames (comma)</span><input value={form.eligibility.blacklistStr || ''} onChange={(e) => setForm({ ...form, eligibility: { ...form.eligibility, blacklistStr: e.target.value } })} /></label>
          <label><span>Whitelist usernames (comma)</span><input value={form.eligibility.whitelistStr || ''} onChange={(e) => setForm({ ...form, eligibility: { ...form.eligibility, whitelistStr: e.target.value } })} /></label>
          <label className="admin-toggle-label"><input type="checkbox" checked={form.eligibility.excludeBanned} onChange={(e) => setForm({ ...form, eligibility: { ...form.eligibility, excludeBanned: e.target.checked } })} />Exclude banned users</label>
          <label className="admin-toggle-label"><input type="checkbox" checked={form.requirementRules.mustAcceptTerms} onChange={(e) => setForm({ ...form, requirementRules: { ...form.requirementRules, mustAcceptTerms: e.target.checked } })} />Require terms checkbox</label>
          <label className="admin-toggle-label"><input type="checkbox" checked={form.requirementRules.mustVerifyEmail} onChange={(e) => setForm({ ...form, requirementRules: { ...form.requirementRules, mustVerifyEmail: e.target.checked } })} />Require verified email</label>
          <label className="admin-toggle-label"><input type="checkbox" checked={form.requirementRules.mustCompleteReferralOnboarding} onChange={(e) => setForm({ ...form, requirementRules: { ...form.requirementRules, mustCompleteReferralOnboarding: e.target.checked } })} />Require referral onboarding done</label>
          <label><span>Account min age (days)</span><input type="number" min={0} value={form.requirementRules.accountOlderThanDays} onChange={(e) => setForm({ ...form, requirementRules: { ...form.requirementRules, accountOlderThanDays: Number(e.target.value) } })} /></label>
          <div className="span-2 admin-giveaway-actions">
            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={previewCount}><Eye size={14} /> Preview eligible count</button>
            <button type="submit" className="admin-btn admin-btn-primary admin-btn-sm" disabled={creating}>
              {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Save draft
            </button>
          </div>
        </form>
        {preview && (
          <p className="admin-muted">
            Eligible (sample scan): <strong>{preview.matched}</strong> / {preview.scanned} scanned
            {preview.capped ? ' (capped)' : ''}
          </p>
        )}
      </section>

      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <Users size={20} />
          <div>
            <h3>Referral onboarding reset</h3>
            <p>Find by username — user will see the referral modal again.</p>
          </div>
        </div>
        <div className="admin-inline-row">
          <input value={resetUsername} onChange={(e) => setResetUsername(e.target.value)} placeholder="Username" />
          <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={resetReferral}><RotateCcw size={14} /> Reset</button>
        </div>
      </section>

      <section className="admin-section glass-card">
        <div className="admin-section-header">
          <Gift size={20} />
          <div>
            <h3>All giveaways</h3>
          </div>
        </div>
        {loading ? <Loader2 className="spin" /> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Title</th><th>Status</th><th>Ends</th><th /></tr>
              </thead>
              <tbody>
                {list.map((g) => (
                  <tr key={g.id}>
                    <td>{g.title}</td>
                    <td>{g.status}</td>
                    <td>{g.endAt?.seconds ? new Date(g.endAt.seconds * 1000).toLocaleString() : '—'}</td>
                    <td>
                      <div className="admin-gw-row-actions">
                        {g.status === 'draft' && (
                          <button type="button" className="admin-btn admin-btn-xs admin-btn-primary" onClick={() => publish(g.id)}><Play size={12} /> Publish</button>
                        )}
                        {g.status === 'published' && (
                          <>
                            <button type="button" className="admin-btn admin-btn-xs admin-btn-ghost" onClick={() => endGw(g.id)}><Square size={12} /> End</button>
                            <button type="button" className="admin-btn admin-btn-xs admin-btn-ghost" onClick={() => pickWinners(g.id)}><Shuffle size={12} /> Pick winners</button>
                          </>
                        )}
                        <button type="button" className="admin-btn admin-btn-xs admin-btn-ghost" onClick={() => loadEntries(g.id)}><Users size={12} /> Entrants</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries && (
          <div className="admin-gw-entries glass-card">
            <div className="admin-gw-entries-head">
              <strong>Entries — {entries.id}</strong>
              <button type="button" className="admin-btn admin-btn-xs admin-btn-ghost" onClick={exportCsv}>Export CSV</button>
            </div>
            <ul className="admin-gw-entry-list">
              {entries.rows.map((r) => (
                <li key={r.id}>
                  <span>{r.username || r.userId}</span>
                  {r.disqualified ? <span className="admin-badge admin-badge-owner">DQ</span> : null}
                  <button type="button" className="admin-btn admin-btn-xs admin-btn-danger" onClick={() => disqualify(r.id)}><Ban size={12} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
