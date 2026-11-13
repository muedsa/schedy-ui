import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { ApiError, bulkDeleteTasks } from "../lib/api";
import { toLocalDateTimeInput } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { ConnectionConfig, TaskStatus } from "../types";
import { TASK_STATUSES } from "../types";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

interface BulkDeleteModalProps {
  open: boolean;
  config: ConnectionConfig;
  currentStatus: TaskStatus | "all";
  onClose: () => void;
  onDeleted: (count: number) => void;
}

export function BulkDeleteModal({
  open,
  config,
  currentStatus,
  onClose,
  onDeleted,
}: BulkDeleteModalProps) {
  const toast = useToast();
  const { t, statusLabel } = useI18n();
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [url, setUrl] = useState("");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus(currentStatus === "all" ? "" : currentStatus);
    setUrl("");
    setBefore("");
    setAfter("");
    setSubmitting(false);
    setError(null);
  }, [open, currentStatus]);

  const filters: string[] = [];
  if (status) filters.push(t("bulk.filterStatus", statusLabel(status)));
  if (url.trim()) filters.push(t("bulk.filterUrl", url.trim()));
  if (before) filters.push(t("bulk.filterBefore", before.replace("T", " ")));
  if (after) filters.push(t("bulk.filterAfter", after.replace("T", " ")));

  const applyPreset = (preset: "failed" | "cancelled") => {
    const date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    setStatus(preset);
    setUrl("");
    setAfter("");
    setBefore(toLocalDateTimeInput(date));
    setError(null);
  };

  const handleDelete = async () => {
    if (filters.length === 0) {
      setError(t("bulk.requiresFilter"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await bulkDeleteTasks(config, {
        status: status || undefined,
        url: url.trim() || undefined,
        before: before ? new Date(before).toISOString() : undefined,
        after: after ? new Date(after).toISOString() : undefined,
      });
      toast.success(t("bulk.deletedTitle", result.deleted), t("bulk.deletedDescription"));
      onDeleted(result.deleted);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : t("error.delete"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={t("bulk.title")}
      description={t("bulk.description")}
      icon={
        <span className="danger-icon">
          <Trash2 size={19} />
        </span>
      }
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void handleDelete()}
            disabled={submitting || filters.length === 0}
          >
            {submitting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
            {t("bulk.permanentDelete")}
          </button>
        </>
      }
    >
      <div className="inline-alert inline-alert-warning">
        <AlertTriangle size={16} />
        <span>{t("bulk.warning")}</span>
      </div>

      <div className="preset-row">
        <span className="preset-label">{t("bulk.quickFilters")}</span>
        <button type="button" className="chip-button" onClick={() => applyPreset("failed")}>
          {t("bulk.presetFailed")}
        </button>
        <button type="button" className="chip-button" onClick={() => applyPreset("cancelled")}>
          {t("bulk.presetCancelled")}
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">{t("bulk.status")}</span>
          <select
            className="select"
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus | "")}
            disabled={submitting}
          >
            <option value="">{t("bulk.anyStatus")}</option>
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">{t("bulk.urlExact")}</span>
          <input
            className="input"
            placeholder={t("bulk.urlPlaceholder")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={submitting}
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span className="field-label">{t("bulk.before")}</span>
          <input
            className="input"
            type="datetime-local"
            step="1"
            value={before}
            onChange={(event) => setBefore(event.target.value)}
            disabled={submitting}
          />
        </label>

        <label className="field">
          <span className="field-label">{t("bulk.after")}</span>
          <input
            className="input"
            type="datetime-local"
            step="1"
            value={after}
            onChange={(event) => setAfter(event.target.value)}
            disabled={submitting}
          />
        </label>
      </div>

      <div className={`delete-summary ${filters.length === 0 ? "empty" : ""}`}>
        <span className="delete-summary-label">{t("bulk.summaryLabel")}</span>
        {filters.length === 0 ? (
          <span>{t("bulk.summaryEmpty")}</span>
        ) : (
          <span>{t("bulk.summary", filters.join(t("bulk.filterJoin")))}</span>
        )}
      </div>

      {error && (
        <div className="inline-alert inline-alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </Modal>
  );
}
