import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const Icon =
    toast.tone === 'error'
      ? AlertCircle
      : toast.tone === 'info'
        ? Info
        : CheckCircle2;

  return (
    <div
      className={`toast toast-${toast.tone}`}
      role="status"
      aria-live="polite"
    >
      <Icon size={18} />
      <span>{toast.message}</span>
      <button
        type="button"
        className="toast-dismiss"
        onClick={onDismiss}
        aria-label="关闭提示"
      >
        知道了
      </button>
    </div>
  );
}
