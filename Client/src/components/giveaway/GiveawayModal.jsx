import { useState, useEffect, useCallback } from 'react';
import { Gift, PartyPopper } from 'lucide-react';
import { apiJson } from '../../services/apiClient';
import GlassModal from '../glass/GlassModal';
import './GiveawayModal.css';

/**
 * Active giveaway entry UI (shared GlassModal). Fetches GET /api/giveaways/active.
 */
export default function GiveawayModal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('offer');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiJson('/api/giveaways/active');
      const g = res.giveaway || null;
      if (g?.id && typeof sessionStorage !== 'undefined') {
        if (sessionStorage.getItem(`fluxy-gw-dismiss-${g.id}`)) {
          setData(null);
          return;
        }
      }
      setData(g);
      if (g?.hasEntered) setPhase('success');
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleEnter() {
    if (!data?.id) return;
    const req = data.requirementRules || {};
    if (req.mustAcceptTerms && !acceptedTerms) {
      setError('Please accept the terms to enter.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await apiJson(`/api/giveaways/${encodeURIComponent(data.id)}/enter`, {
        method: 'POST',
        body: { acceptedTerms: req.mustAcceptTerms ? acceptedTerms : true },
      });
      setPhase('success');
      await load();
    } catch (e) {
      setError(e.message || 'Could not enter');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDismiss() {
    if (!data?.id) return;
    try {
      if (dontShow) {
        await apiJson(`/api/giveaways/${encodeURIComponent(data.id)}/dismiss`, { method: 'POST' });
      } else if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`fluxy-gw-dismiss-${data.id}`, '1');
      }
    } catch {
      /* still close */
    }
    setData(null);
  }

  if (loading || !data) return null;

  const req = data.requirementRules || {};
  if (phase === 'success' || data.hasEntered) {
    return (
      <GlassModal
        open
        icon={<PartyPopper size={24} />}
        title={data.title}
        subtitle={data.successText || "You're in! Good luck."}
        primaryLabel="Awesome"
        onPrimary={() => setData(null)}
        secondaryLabel=""
      >
        <p className="giveaway-modal-msg muted">
          {data.winnerAnnouncementText
            ? String(data.winnerAnnouncementText).slice(0, 280)
            : 'Winners will be announced after the giveaway ends.'}
        </p>
      </GlassModal>
    );
  }

  return (
    <GlassModal
      open
      icon={
        data.prizeImageUrl ? (
          <img src={data.prizeImageUrl} alt="" className="giveaway-modal-prize-img" />
        ) : (
          <Gift size={24} />
        )
      }
      title={data.title}
      subtitle={data.description || 'Enter below for a chance to win.'}
      primaryLabel={submitting ? 'Entering…' : data.buttonText || 'Enter giveaway'}
      primaryLoading={submitting}
      primaryDisabled={submitting}
      onPrimary={handleEnter}
      secondaryLabel="Maybe later"
      onSecondary={handleDismiss}
      footerExtra={
        req.mustAcceptTerms ? (
          <span className="giveaway-modal-footer-hint">Read the terms in the checkbox above before entering.</span>
        ) : null
      }
    >
      <div className="giveaway-modal-inner">
        {data.longMessage ? (
          <div className="giveaway-modal-long">{data.longMessage}</div>
        ) : null}
        {data.prize ? (
          <p className="giveaway-modal-prize">
            <strong>Prize:</strong> {data.prize}
          </p>
        ) : null}

        {req.mustAcceptTerms ? (
          <label className="giveaway-modal-check">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>{req.termsText || 'I agree to the giveaway rules.'}</span>
          </label>
        ) : null}

        <label className="giveaway-modal-check subtle">
          <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
          <span>Don&apos;t show this again</span>
        </label>

        {error ? <p className="giveaway-modal-error">{error}</p> : null}
      </div>
    </GlassModal>
  );
}
