import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Ban,
  Check,
  Copy,
  FileJson,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ApiError, cancelTask, getTask, replayTask } from "../lib/api";
import {
  buildCurl,
  copyText,
  formatAbsolute,
  formatDuration,
  formatRelative,
  prettyJson,
} from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { ConnectionConfig, Task } from "../types";
import { CodeBadge, MethodBadge, StatusBadge } from "./Badges";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

interface TaskDrawerProps {
  open: boolean;
  config: ConnectionConfig;
  task: Task | null;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (task: Task) => void;
}

type PendingAction = "cancel" | "replay";

export function TaskDrawer({ open, config, task, onClose, onChanged, onEdit }: TaskDrawerProps) {
  const toast = useToast();
  const { t, statusLabel } = useI18n();
  const titleId = useId();
  const [detail, setDetail] = useState<Task | null>(task);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<PendingAction | null>(null);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const taskId = task?.id ?? null;

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Let the confirm dialog handle Escape while it is on top of the drawer.
      if (event.key === "Escape" && !busy && !confirm) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, confirm, onClose]);

  useEffect(() => {
    if (!open) return;
    setDetail(task);
    setError(null);
    setBusy(null);
    setConfirm(null);
    setCopied(null);
    // List refreshes replace the task object frequently; only reset when the
    // drawer opens or the selected task changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  useEffect(() => {
    if (!open || !taskId) return;
    const controller = new AbortController();
    setLoading(true);
    getTask(config, taskId, controller.signal)
      .then((fresh) => {
        setDetail(fresh);
        setError(null);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof ApiError ? fetchError.message : t("error.taskDetail"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, taskId, config, t]);

  const copy = async (value: string, key: string, label: string) => {
    try {
      await copyText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1600);
      toast.success(t("drawer.copied"), label);
    } catch {
      toast.error(t("common.copyFailed"), t("common.clipboardDenied"));
    }
  };

  const refreshDetail = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const fresh = await getTask(config, taskId);
      setDetail(fresh);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof ApiError ? refreshError.message : t("error.refresh"));
    } finally {
      setLoading(false);
    }
  }, [config, taskId, t]);

  const handleCancel = async () => {
    if (!taskId) return;
    setBusy("cancel");
    try {
      await cancelTask(config, taskId);
      setConfirm(null);
      toast.success(t("drawer.cancelSuccessTitle"), t("drawer.cancelSuccessDescription"));
      onChanged();
      await refreshDetail();
    } catch (actionError) {
      toast.error(
        t("error.cancel"),
        actionError instanceof ApiError ? actionError.message : t("common.retryLater"),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleReplay = async () => {
    if (!taskId) return;
    setBusy("replay");
    try {
      const rearmed = await replayTask(config, taskId);
      setDetail(rearmed);
      setConfirm(null);
      toast.success(t("drawer.replaySuccessTitle"), t("drawer.replaySuccessDescription"));
      onChanged();
    } catch (actionError) {
      toast.error(
        t("error.replay"),
        actionError instanceof ApiError ? actionError.message : t("common.retryLater"),
      );
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const attempts = detail?.attempts ?? [];
  const terminal = detail ? ["succeeded", "failed", "cancelled"].includes(detail.status) : false;

  return createPortal(
    <>
      <div
        className="drawer-layer"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) onClose();
        }}
      >
        <aside className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="drawer-header">
            <div className="drawer-title-row">
              <div className="drawer-title-copy">
                <div className="drawer-eyebrow">
                  <span id={titleId}>{t("drawer.title")}</span>
                  {detail && <StatusBadge status={detail.status} />}
                </div>
                <div className="drawer-id">
                  <code>{taskId}</code>
                  {taskId && (
                    <button
                      type="button"
                      className="icon-btn tiny"
                      onClick={() => void copy(taskId, "taskId", t("drawer.taskId"))}
                      aria-label={t("drawer.copyTaskId")}
                      title={t("drawer.copyTaskId")}
                    >
                      {copied === "taskId" ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="drawer-header-actions">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => void refreshDetail()}
                  disabled={loading}
                  aria-label={t("drawer.refresh")}
                  title={t("drawer.refresh")}
                >
                  <RefreshCw size={16} className={loading ? "spin" : ""} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={onClose}
                  aria-label={t("drawer.close")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>

          <div className="drawer-body">
            {error && (
              <div className="inline-alert inline-alert-error" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {!detail ? (
              <div className="drawer-loading">
                <Loader2 size={22} className="spin" />
                {t("drawer.loading")}
              </div>
            ) : (
              <>
                <section className="detail-hero">
                  <div className="detail-target-line">
                    <MethodBadge method={detail.method} />
                    <span className="detail-url">{detail.url}</span>
                  </div>
                  <div className="detail-hero-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void copy(detail.url, "url", t("drawer.targetUrl"))}
                    >
                      <Copy size={14} />
                      {t("drawer.copyUrl")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void copy(buildCurl(detail), "curl", t("drawer.curlCommand"))}
                    >
                      <Copy size={14} />
                      {t("drawer.copyCurl")}
                    </button>
                  </div>
                </section>

                <section className="detail-section">
                  <h3>{t("drawer.overview")}</h3>
                  <div className="detail-grid">
                    <DetailItem
                      label={t("drawer.scheduledAt")}
                      value={formatAbsolute(detail.execute_at)}
                      sub={formatRelative(detail.execute_at)}
                    />
                    <DetailItem
                      label={t("drawer.finishedAt")}
                      value={detail.finished_at ? formatAbsolute(detail.finished_at) : "—"}
                      sub={detail.finished_at ? formatRelative(detail.finished_at) : undefined}
                    />
                    <DetailItem
                      label={t("drawer.retryPolicy")}
                      value={t("drawer.retryPolicyValue", detail.retries, detail.retry_interval)}
                      sub={
                        detail.retry_mode === "exponential"
                          ? t("drawer.retryExponential")
                          : t("drawer.retryFixed")
                      }
                    />
                    <DetailItem
                      label={t("drawer.timeout")}
                      value={
                        detail.timeout_ms
                          ? formatDuration(detail.timeout_ms)
                          : t("drawer.timeoutDefault")
                      }
                      sub={detail.timeout_ms ? `${detail.timeout_ms} ms` : undefined}
                    />
                    <DetailItem
                      label={t("drawer.schedule")}
                      value={detail.schedule || t("drawer.once")}
                      sub={detail.schedule ? t("drawer.scheduleNext") : undefined}
                    />
                    <DetailItem
                      label={t("drawer.onFailure")}
                      value={detail.on_failure_url || t("common.notSet")}
                      sub={
                        detail.on_failure_url ? t("drawer.onFailureSub") : t("drawer.defaultPolicy")
                      }
                    />
                    <DetailItem
                      label={t("drawer.idempotencyKey")}
                      value={detail.idempotency_key || t("common.notSet")}
                      mono={Boolean(detail.idempotency_key)}
                    />
                    <DetailItem
                      label={t("drawer.status")}
                      value={statusLabel(detail.status)}
                      sub={
                        detail.attempts?.length
                          ? t("drawer.attemptsRecorded", detail.attempts.length)
                          : t("drawer.noAttempts")
                      }
                    />
                  </div>
                </section>

                <section className="detail-section">
                  <div className="detail-section-head">
                    <h3>{t("drawer.requestBody")}</h3>
                    {detail.payload !== undefined && detail.payload !== null && (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          void copy(
                            typeof detail.payload === "string"
                              ? detail.payload
                              : prettyJson(detail.payload),
                            "payload",
                            t("drawer.requestBody"),
                          )
                        }
                      >
                        <Copy size={13} />
                        {t("drawer.copy")}
                      </button>
                    )}
                  </div>
                  {detail.payload === undefined || detail.payload === null ? (
                    <p className="detail-empty">{t("drawer.noBody")}</p>
                  ) : (
                    <pre className="code-block">
                      {typeof detail.payload === "string"
                        ? detail.payload
                        : prettyJson(detail.payload)}
                    </pre>
                  )}
                </section>

                <section className="detail-section">
                  <h3>{t("drawer.requestHeaders")}</h3>
                  {detail.headers && Object.keys(detail.headers).length > 0 ? (
                    <div className="headers-list">
                      {Object.entries(detail.headers).map(([key, value]) => (
                        <div className="header-item" key={key}>
                          <code>{key}</code>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-empty">{t("drawer.noHeaders")}</p>
                  )}
                </section>

                <section className="detail-section">
                  <div className="detail-section-head">
                    <h3>{t("drawer.attempts")}</h3>
                    <span className="detail-count">{attempts.length}</span>
                  </div>
                  {attempts.length === 0 ? (
                    <p className="detail-empty">{t("drawer.attemptsEmpty")}</p>
                  ) : (
                    <ol className="attempt-timeline">
                      {attempts.map((attempt) => (
                        <li className="attempt-item" key={`${attempt.n}-${attempt.fired_at}`}>
                          <span
                            className={`timeline-dot ${attempt.status_code >= 200 && attempt.status_code < 300 ? "ok" : "error"}`}
                            aria-hidden
                          />
                          <div className="attempt-head">
                            <span className="attempt-number">
                              {t("drawer.attemptNumber", attempt.n)}
                            </span>
                            <CodeBadge code={attempt.status_code} />
                            <span className="attempt-time">
                              {formatAbsolute(attempt.fired_at)}
                              <span className="attempt-relative">
                                {" "}
                                · {formatRelative(attempt.fired_at)}
                              </span>
                            </span>
                            <span className="attempt-duration">
                              {formatDuration(attempt.duration_ms)}
                            </span>
                          </div>
                          {attempt.error && <p className="attempt-error">{attempt.error}</p>}
                          {attempt.response_body && (
                            <details className="attempt-response">
                              <summary>
                                <FileJson size={13} />
                                {t("drawer.responseBody")}
                                {attempt.response_body_truncated && (
                                  <span className="truncated-tag">{t("drawer.truncated")}</span>
                                )}
                              </summary>
                              <pre className="code-block small">{attempt.response_body}</pre>
                            </details>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            )}
          </div>

          {detail && (
            <footer className="drawer-footer">
              {detail.status === "pending" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onEdit(detail)}
                  disabled={Boolean(busy)}
                >
                  <Pencil size={15} />
                  {t("drawer.edit")}
                </button>
              )}
              {terminal && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setConfirm("replay")}
                  disabled={Boolean(busy)}
                >
                  <Play size={15} />
                  {t("drawer.replay")}
                </button>
              )}
              {(detail.status === "pending" || detail.status === "running") && (
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => setConfirm("cancel")}
                  disabled={Boolean(busy)}
                >
                  {busy === "cancel" ? <Loader2 size={15} className="spin" /> : <Ban size={15} />}
                  {t("drawer.cancel")}
                </button>
              )}
              <span className="drawer-footer-spacer" />
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                {t("drawer.closeAction")}
              </button>
            </footer>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === "cancel"}
        title={t("drawer.cancelConfirmTitle")}
        description={
          <>
            {t("drawer.cancelConfirmPrefix")}
            <strong>cancelled</strong>
            {t("drawer.cancelConfirmSuffix")}
          </>
        }
        confirmLabel={t("drawer.cancel")}
        cancelLabel={t("common.back")}
        danger
        loading={busy === "cancel"}
        onConfirm={() => void handleCancel()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "replay"}
        title={t("drawer.replayConfirmTitle")}
        description={
          <>
            {t("drawer.replayConfirmPrefix")}
            <strong>{t("drawer.replayConfirmStrong")}</strong>
            {t("drawer.replayConfirmSuffix")}
          </>
        }
        confirmLabel={t("drawer.confirmReplay")}
        cancelLabel={t("common.back")}
        loading={busy === "replay"}
        onConfirm={() => void handleReplay()}
        onClose={() => setConfirm(null)}
      />
    </>,
    document.body,
  );
}

function DetailItem({
  label,
  value,
  sub,
  mono = false,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="detail-item">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${mono ? "mono" : ""}`} title={value}>
        {value}
      </span>
      {sub && <span className="detail-sub">{sub}</span>}
    </div>
  );
}
