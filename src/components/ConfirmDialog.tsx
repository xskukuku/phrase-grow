import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认删除',
  busy = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      eyebrow="REMOVE WORD"
      title={title}
    >
      <div className="confirm-body">
        <div className="confirm-icon" aria-hidden="true">
          <Trash2 size={22} />
        </div>
        <p>{description}</p>
      </div>
      <div className="modal-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onClose}
          disabled={busy}
        >
          先留着
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
          {busy ? '删除中…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
