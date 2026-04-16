import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useInclides } from '../../contexts/InclidesContext';
import { formatInclidesAmount, formatInclidesLine } from '../../services/inclidesApi';
import InclidesSymbol from './InclidesSymbol';
import './DailyInclidesCard.css';

export default function DailyInclidesCard() {
  const {
    canClaimToday,
    previewNextReward,
    streak,
    claimDaily,
  } = useInclides();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  async function onClaim() {
    if (!canClaimToday || busy) return;
    setBusy(true);
    setToast(null);
    try {
      const out = await claimDaily();
      const amt = formatInclidesAmount(out.earned);
      setToast(
        `You earned ${amt} Inclides!${out.streak >= 2 ? ` 🔥 ${out.streak}-day streak` : ''}`,
      );
      setTimeout(() => setToast(null), 5200);
    } catch (e) {
      setToast(e.message || 'Could not claim');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  const segments = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7));

  return (
    <section className="daily-inclides glass-card fluxy-premium-surface">
      <div className="daily-inclides-head">
        <InclidesSymbol size={22} />
        <div>
          <h3>Daily Inclides</h3>
          <p className="daily-inclides-sub">
            Earn Inclides daily for showing up — streaks add a little extra.
          </p>
        </div>
      </div>
      <div className="daily-inclides-streak" aria-hidden>
        {segments.map((on, i) => (
          <span key={i} className={`daily-inclides-dot ${on ? 'on' : ''}`} />
        ))}
      </div>
      <p className="daily-inclides-meta">
        {canClaimToday
          ? `Next: ${formatInclidesLine(previewNextReward)}`
          : `Come back tomorrow — current streak ${streak} day${streak === 1 ? '' : 's'}.`}
      </p>
      <button
        type="button"
        className="btn btn-primary daily-inclides-btn"
        disabled={!canClaimToday || busy}
        onClick={onClaim}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="spin" /> Claiming…
          </>
        ) : canClaimToday ? (
          <>
            <Sparkles size={16} /> Claim daily Inclides
          </>
        ) : (
          'Claimed today'
        )}
      </button>
      {toast ? (
        <div className="daily-inclides-toast" role="status">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
