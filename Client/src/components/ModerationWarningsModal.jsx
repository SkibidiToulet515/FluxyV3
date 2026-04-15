import { useMemo, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import GlassModal from './glass/GlassModal';
import './ModerationWarningsModal.css';

const STORAGE_ACK = 'fluxy-mod-warnings-ack';
const STORAGE_SESSION = 'fluxy-mod-warnings-session-dismiss';

function warningsSignature(warnings) {
  if (!warnings?.length) return '';
  return warnings.map((w) => `${w.id || ''}|${w.at}|${w.reason}|${w.by}`).join(';;');
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
}

/**
 * Shows moderation warnings from Firestore `users/{uid}.warnings` in the shared GlassModal shell.
 * Acknowledge persists until the warning set changes; "Maybe later" hides for this session only.
 */
export default function ModerationWarningsModal() {
  const { profile } = useAuth();
  const warnings = useMemo(() => {
    const w = profile?.warnings;
    if (!Array.isArray(w) || !w.length) return [];
    return [...w].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }, [profile?.warnings]);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!warnings.length) {
      setOpen(false);
      return;
    }
    const sig = warningsSignature(warnings);
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_SESSION) === sig) {
        setOpen(false);
        return;
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_ACK) === sig) {
        setOpen(false);
        return;
      }
    } catch {
      /* storage blocked */
    }
    setOpen(true);
  }, [warnings]);

  function acknowledge() {
    const sig = warningsSignature(warnings);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_ACK, sig);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_SESSION);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function remindLater() {
    const sig = warningsSignature(warnings);
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STORAGE_SESSION, sig);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open || !warnings.length) return null;

  return (
    <GlassModal
      className="fluxy-glass-modal--layer-top"
      open
      icon={<AlertTriangle size={24} strokeWidth={2} />}
      title="Account notice"
      subtitle="A moderator has recorded a warning on your account. Review the details below."
      primaryLabel="I've read and understand"
      onPrimary={acknowledge}
      secondaryLabel="Maybe later"
      onSecondary={remindLater}
    >
      <ul className="mod-warnings-modal-list">
        {warnings.map((w, i) => (
          <li key={`${w.at}-${i}`} className="mod-warnings-modal-item">
            <time className="mod-warnings-modal-time">{formatWhen(w.at)}</time>
            <p className="mod-warnings-modal-reason">{w.reason?.trim() || '(No reason provided.)'}</p>
          </li>
        ))}
      </ul>
    </GlassModal>
  );
}
