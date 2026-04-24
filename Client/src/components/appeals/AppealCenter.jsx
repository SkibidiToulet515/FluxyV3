import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Ban, LogOut } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import { useAuth } from '../../utils/AuthContext';
import './AppealCenter.css';

const MIN_LEN = 40;

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function typeLabel(t) {
  if (t === 'ban') return 'Ban';
  if (t === 'mute') return 'Mute';
  if (t === 'warning') return 'Warning';
  return t;
}

function PunishmentPill({ type }) {
  const cls =
    type === 'ban' ? 'appeal-pill appeal-pill-ban' : type === 'mute' ? 'appeal-pill appeal-pill-mute' : 'appeal-pill appeal-pill-warning';
  return <span className={cls}>{typeLabel(type)}</span>;
}

export default function AppealCenter({ variant = 'default' }) {
  const { account, logout, profile } = useAuth();
  const isBanned = account?.isBanned === true;

  const [eligible, setEligible] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [perspectiveMessage, setPerspectiveMessage] = useState('');
  const [whyRemoveMessage, setWhyRemoveMessage] = useState('');
  const [evidenceLinks, setEvidenceLinks] = useState('');
  const [confirmAck, setConfirmAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const didAutoSelectBan = useRef(false);

  const load = useCallback(async () => {
    didAutoSelectBan.current = false;
    setLoading(true);
    setError('');
    try {
      const [e, h] = await Promise.all([
        apiJson('/api/appeals/eligible'),
        apiJson('/api/appeals/me'),
      ]);
      setEligible(e.punishments || []);
      setHistory(h.appeals || []);
    } catch (err) {
      setError(err.message || 'Could not load appeals');
      setEligible([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Banned users often only need to appeal the ban — select it once when it is the only option. */
  useEffect(() => {
    if (loading || !isBanned || didAutoSelectBan.current) return;
    if (eligible.length !== 1) return;
    const only = eligible[0];
    if (only?.type !== 'ban') return;
    didAutoSelectBan.current = true;
    setSelectedId(only.id);
  }, [loading, isBanned, eligible]);

  const selected = eligible.find((p) => p.id === selectedId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedId || !selected) return;
    if (appealMessage.trim().length < MIN_LEN) {
      setError(`Please write at least ${MIN_LEN} characters explaining your appeal.`);
      return;
    }
    if (!confirmAck) {
      setError('Please confirm you understand false or spam appeals may be denied.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiJson('/api/appeals', {
        method: 'POST',
        body: {
          punishmentId: selectedId,
          appealMessage: appealMessage.trim(),
          perspectiveMessage: perspectiveMessage.trim() || undefined,
          whyRemoveMessage: whyRemoveMessage.trim() || undefined,
          evidenceLinks: evidenceLinks.trim() || undefined,
          confirmAck: true,
        },
      });
      setAppealMessage('');
      setPerspectiveMessage('');
      setWhyRemoveMessage('');
      setEvidenceLinks('');
      setConfirmAck(false);
      setSelectedId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  const showPunishments =
    isBanned || (profile?.warnings?.length > 0) || profile?.mutedUntil || eligible.length > 0;

  const inner = (
    <div className="appeal-center">
      <div className="appeal-hero-card">
        <div className="appeal-hero-icon">
          {isBanned ? <Ban size={24} /> : <Gavel size={24} />}
        </div>
        <h1 className="appeal-hero-title">
          {isBanned ? 'Account suspended' : 'Moderation & appeals'}
        </h1>
        <p className="appeal-hero-sub">
          {isBanned
            ? 'Your account is banned from the rest of the site. Review the action below and submit an appeal if you believe it was a mistake.'
            : 'View active warnings or mutes and submit an appeal. You can track status and staff responses here.'}
        </p>
      </div>

      {loading ? (
        <p className="appeal-hero-sub">Loading…</p>
      ) : (
        <>
          {error && !selectedId && <p className="appeal-error">{error}</p>}

          {showPunishments && (
            <div className="appeal-hero-card" style={{ textAlign: 'left' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#e2e8f0' }}>Punishments you can appeal</h2>
              {eligible.length === 0 ? (
                <p className="appeal-hero-sub" style={{ textAlign: 'left' }}>
                  No appealable punishments right now (or a cooldown applies). Check history below.
                </p>
              ) : (
                eligible.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`appeal-punishment-card ${selectedId === p.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedId(p.id);
                      setError('');
                    }}
                    style={{ width: '100%', cursor: 'pointer', border: 'none', color: 'inherit', font: 'inherit' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <PunishmentPill type={p.type} />
                      {p.synthetic ? (
                        <span className="appeal-pill">Record</span>
                      ) : null}
                    </div>
                    <p className="appeal-punishment-meta">
                      Issued {formatWhen(p.issuedAt)}
                      {p.expiresAt ? ` · Expires ${formatWhen(p.expiresAt)}` : ''}
                    </p>
                    <p className="appeal-punishment-reason">{p.reason || '—'}</p>
                  </button>
                ))
              )}
            </div>
          )}

          {selected && (
            <form className="appeal-hero-card appeal-form" onSubmit={handleSubmit}>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#e2e8f0' }}>Appeal this action</h2>
              <p className="appeal-punishment-meta" style={{ marginBottom: '0.75rem' }}>
                {typeLabel(selected.type)} · {selected.id.slice(0, 18)}
                {selected.id.length > 18 ? '…' : ''}
              </p>
              <label htmlFor="appeal-msg">Appeal message (required)</label>
              <textarea
                id="appeal-msg"
                value={appealMessage}
                onChange={(e) => setAppealMessage(e.target.value)}
                placeholder={`Explain your side in at least ${MIN_LEN} characters…`}
                required
              />
              <label htmlFor="persp">What happened from your perspective? (optional)</label>
              <textarea
                id="persp"
                value={perspectiveMessage}
                onChange={(e) => setPerspectiveMessage(e.target.value)}
                rows={3}
              />
              <label htmlFor="why">Why should this be reduced or removed? (optional)</label>
              <textarea id="why" value={whyRemoveMessage} onChange={(e) => setWhyRemoveMessage(e.target.value)} rows={3} />
              <label htmlFor="ev">Evidence — links or text (optional)</label>
              <textarea
                id="ev"
                value={evidenceLinks}
                onChange={(e) => setEvidenceLinks(e.target.value)}
                placeholder="Paste URLs or describe evidence…"
                rows={2}
              />
              <label className="appeal-check">
                <input
                  type="checkbox"
                  checked={confirmAck}
                  onChange={(e) => setConfirmAck(e.target.checked)}
                />
                <span>I understand false appeals or spam appeals may be denied.</span>
              </label>
              {error && <p className="appeal-error">{error}</p>}
              <button type="submit" className="appeal-btn-primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit appeal'}
              </button>
            </form>
          )}

          <div className="appeal-hero-card" style={{ textAlign: 'left' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#e2e8f0' }}>Appeal history</h2>
            {history.length === 0 ? (
              <p className="appeal-hero-sub" style={{ textAlign: 'left' }}>
                No appeals yet.
              </p>
            ) : (
              history.map((a) => (
                <div key={a.id} className="appeal-history-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>
                      <PunishmentPill type={a.punishmentType} /> {formatWhen(a.createdAt)}
                    </span>
                    <span className={`appeal-status appeal-status-${a.status}`}>{a.status.replace('_', ' ')}</span>
                  </div>
                  {a.staffResponse ? (
                    <p style={{ margin: '0.5rem 0 0', color: '#cbd5e1' }}>{a.staffResponse}</p>
                  ) : null}
                  {a.modificationSummary ? (
                    <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                      Outcome: {a.modificationSummary}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );

  if (variant === 'banned') {
    return (
      <div className="appeal-banned-backdrop">
        <div className="appeal-banned-top">
          <Link to="/" className="appeal-banned-brand">
            <img src="/brand/fluxy-mark.svg" alt="" width={28} height={28} />
            fluxy
          </Link>
          <button type="button" className="appeal-banned-logout" onClick={() => logout()}>
            <LogOut size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Sign out
          </button>
        </div>
        {inner}
      </div>
    );
  }

  return inner;
}
