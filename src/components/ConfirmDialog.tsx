import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      title={title}
      size="sm"
      icon={
        <span className={danger ? "confirm-icon danger" : "confirm-icon"}>
          <AlertTriangle size={19} />
        </span>
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t("common.cancel")}
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 size={15} className="spin" />}
            {confirmLabel ?? t("common.confirm")}
          </button>
        </>
      }
    >
      <div className="confirm-description">{description}</div>
    </Modal>
  );
}
