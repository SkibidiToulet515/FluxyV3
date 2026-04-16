import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useInclides } from '../../contexts/InclidesContext';
import { formatInclidesAmount, formatInclidesLine, postDailyClaim } from '../../services/inclidesApi';
import InclidesSymbol from './InclidesSymbol';
import './DailyInclidesCard.css';

export default function DailyInclidesCard() {
  const {
    previewNextReward,
    streak,
    refresh,
  } = useInclides();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [exiting, setExiting] = useState(false);

  async function onClaim() {
    if (busy) return;
    setBusy(true);
    setToast(null);
    try {
      const out = await postDailyClaim();
      const amt = formatInclidesAmount(out.earned);
      setToast(
        `You earned ${amt} Inclides!${out.streak >= 2 ? ` 🔥 ${out.streak}-day streak` : ''}`,
      );
      setExiting(true);
      setTimeout(() => setToast(null), 4800);
      await new Promise((r) => setTimeout(r, 420));
      await refresh();
    } catch (e) {
      setExiting(false);
      setToast(e.message || 'Could not claim');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  const segments = Array.from({ length: 7 }, (_, i) => i < Math.min(streak, 7));

  return (
    <section
      className={`daily-inclides glass-card fluxy-premium-surface${exiting ? ' daily-inclides--exit' : ''}`}
    >
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
        Next: {formatInclidesLine(previewNextReward)}
      </p>
      <button
        type="button"
        className="btn btn-primary daily-inclides-btn"
        disabled={busy || exiting}
        onClick={onClaim}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="spin" /> Claiming…
          </>
        ) : (
          <>
            <Sparkles size={16} /> Claim daily Inclides
          </>
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
