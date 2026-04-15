import { useState, useEffect, useCallback } from 'react';
import { Loader2, Gavel } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import GlassModal from '../glass/GlassModal';
import './AppealsStaffPanel.css';

const STATUSES = ['all', 'pending', 'under_review', 'accepted', 'denied', 'modified'];
const TYPES = ['all', 'ban', 'mute', 'warning'];

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '—';
  }
}

export default function AppealsStaffPanel() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('pending');
  const [ptype, setPtype] = useState('all');
  const [sort, setSort] = useState('newest');
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);

  const [staffResponse, setStaffResponse] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [muteReduceMinutes, setMuteReduceMinutes] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const q = new URLSearchParams();
      if (status && status !== 'all') q.set('status', status);
      q.set('sort', sort);
      q.set('limit', '80');
      const data = await apiJson(`/api/appeals?${q.toString()}`);
      let rows = data.appeals || [];
      if (ptype !== 'all') rows = rows.filter((a) => a.punishmentType === ptype);
      setAppeals(rows);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  }, [status, sort, ptype]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(id) {
    setDetailId(id);
    setDetail(null);
    setStaffResponse('');
    setInternalNotes('');
    setDetailLoading(true);
    try {
      const data = await apiJson(`/api/appeals/${encodeURIComponent(id)}`);
      setDetail(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendReview(action, extra = {}) {
    if (!detailId) return;
    setReviewBusy(true);
    setErr('');
    try {
      await apiJson(`/api/appeals/${encodeURIComponent(detailId)}/review`, {
        method: 'POST',
        body: {
          action,
          staffResponse: staffResponse.trim() || undefined,
          internalNotes: internalNotes.trim() || undefined,
          ...extra,
        },
      });
      setDetailId(null);
      setDetail(null);
      await load();
    } catch (e) {
      setErr(e.message || 'Review failed');
    } finally {
      setReviewBusy(false);
    }
  }

  const a = detail?.appeal;
  const pun = detail?.punishment;
  const hist = detail?.moderationHistory;

  return (
    <section className="admin-section glass-card appeals-staff">
      <div className="admin-section-header">
        <Gavel size={20} />
        <div>
          <h3>Appeals</h3>
          <p>Review user appeals for bans, mutes, and warnings.</p>
        </div>
      </div>
      {err && <p className="admin-error-banner">{err}</p>}

      <div className="appeals-staff-filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select value={ptype} onChange={(e) => setPtype(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All' : t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="admin-loading">
          <Loader2 size={20} className="spin" /> Loading…
        </div>
      ) : (
        <div className="appeals-staff-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>User</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {appeals.map((row) => (
                <tr key={row.id}>
                  <td>{row.punishmentType}</td>
                  <td>{row.status}</td>
                  <td className="admin-muted">{row.userId?.slice(0, 10)}…</td>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>
                    <button type="button" className="admin-btn admin-btn-ghost admin-btn-xs" onClick={() => openDetail(row.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!appeals.length && <p className="admin-muted">No appeals match filters.</p>}
        </div>
      )}

      {detailId && (
        <GlassModal
          open
          className="fluxy-glass-modal--layer-top"
          icon={<Gavel size={22} />}
          title={detailLoading ? 'Loading…' : `Appeal · ${a?.punishmentType || ''}`}
          subtitle={a ? `Status: ${a.status}` : ''}
          primaryLabel="Close"
          onPrimary={() => {
            setDetailId(null);
            setDetail(null);
          }}
          primaryDisabled={reviewBusy}
          secondaryLabel=""
        >
          {detailLoading && (
            <p className="appeals-staff-muted">Loading details…</p>
          )}
          {!detailLoading && a && (
            <div className="appeals-staff-detail">
              <div className="appeals-staff-block">
                <h4>User</h4>
                <p>
                  {detail.userSummary?.username || '—'} · {detail.userSummary?.uid}
                </p>
                <p className="appeals-staff-muted">
                  Warnings: {detail.userSummary?.warningsCount ?? '—'} · Muted:{' '}
                  {detail.userSummary?.mutedUntil ? 'yes' : 'no'} · Banned:{' '}
                  {detail.userSummary?.banned ? 'yes' : 'no'}
                </p>
              </div>
              <div className="appeals-staff-block">
                <h4>Original punishment</h4>
                <pre className="appeals-staff-pre">{pun?.reason || a.punishmentReason || '—'}</pre>
              </div>
              <div className="appeals-staff-actions" style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  disabled={reviewBusy || a.status === 'under_review'}
                  onClick={() => sendReview('mark_review')}
                >
                  Mark under review
                </button>
              </div>

              <div className="appeals-staff-block">
                <h4>Appeal text</h4>
                <pre className="appeals-staff-pre">{a.appealMessage}</pre>
                {a.perspectiveMessage ? (
                  <p>
                    <strong>Perspective:</strong> {a.perspectiveMessage}
                  </p>
                ) : null}
                {a.whyRemoveMessage ? (
                  <p>
                    <strong>Why remove:</strong> {a.whyRemoveMessage}
                  </p>
                ) : null}
                {a.evidenceLinks ? (
                  <p>
                    <strong>Evidence:</strong> {a.evidenceLinks}
                  </p>
                ) : null}
              </div>
              {hist?.warnings?.length ? (
                <div className="appeals-staff-block">
                  <h4>Warning history (snapshot)</h4>
                  <ul className="appeals-staff-warn-list">
                    {hist.warnings.slice(0, 12).map((w, i) => (
                      <li key={i}>
                        {formatWhen(w.at)} — {w.reason || '—'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="appeals-staff-label">
                Staff response (sent to user)
                <textarea
                  value={staffResponse}
                  onChange={(e) => setStaffResponse(e.target.value)}
                  rows={3}
                  placeholder="Visible to the user when you resolve the appeal."
                />
              </label>
              <label className="appeals-staff-label">
                Internal notes (mods only)
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                />
              </label>

              {a.punishmentType === 'mute' && (
                <label className="appeals-staff-label">
                  Shorten mute (minutes from now, modify action)
                  <input
                    type="number"
                    min={5}
                    max={10080}
                    value={muteReduceMinutes}
                    onChange={(e) => setMuteReduceMinutes(Number(e.target.value))}
                  />
                </label>
              )}

              <div className="appeals-staff-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  disabled={reviewBusy}
                  onClick={() => sendReview('accept')}
                >
                  Accept (lift punishment)
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  disabled={reviewBusy}
                  onClick={() => sendReview('deny')}
                >
                  Deny
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  disabled={reviewBusy}
                  onClick={() => {
                    const extra = { muteReduceMinutes };
                    if (a.punishmentType === 'ban') extra.unban = true;
                    if (a.punishmentType === 'warning') extra.removeWarning = true;
                    sendReview('modify', extra);
                  }}
                >
                  Modify
                </button>
              </div>
              <p className="appeals-staff-hint">
                Modify: for bans, removes ban; for mutes, shortens to the minutes above; for warnings, removes the
                warning entry.
              </p>
            </div>
          )}
        </GlassModal>
      )}
    </section>
  );
}
