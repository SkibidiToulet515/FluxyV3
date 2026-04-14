import { useEffect, useState } from 'react';
import { TOAST_EVENT, type ToastPayload } from '../utils/toast';
import './ToastHost.css';

export default function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<ToastPayload>;
      if (!ce.detail?.message) return;
      setToast({ ...ce.detail });
    }
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const duration = toast.duration ?? 4200;
    const t = window.setTimeout(() => setToast(null), duration);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <div
      className={`toast-host glass-card toast-host--${toast.variant ?? 'info'}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}
