export type ToastVariant = 'info' | 'error';

export interface ToastPayload {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export const TOAST_EVENT = 'fluxy-toast' as const;

export function showToast(payload: ToastPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}
