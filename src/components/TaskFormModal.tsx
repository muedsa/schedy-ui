import { useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ChevronDown,
  Clock3,
  Code2,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  Repeat2,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { ApiError, createTask, updateTask } from "../lib/api";
import {
  defaultExecuteAt,
  formatAbsolute,
  isHttpUrl,
  localTimezone,
  toDateTimeInput,
  validateGoDuration,
} from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { ConnectionConfig, HttpMethod, RetryMode, Task, TaskRequest } from "../types";
import { HTTP_METHODS, RETRY_MODES } from "../types";
import { Modal } from "./Modal";

interface TaskFormModalProps {
  open: boolean;
  config: ConnectionConfig;
  task?: Task | null;
  onClose: () => void;
  onSaved: (task: Task, mode: "create" | "edit") => void;
}

interface HeaderRow {
  id: string;
  key: string;
  value: string;
}

type TimingMode = "at" | "after";
type PayloadKind = "none" | "json" | "text";
type DelayUnit = "m" | "h" | "d";

type FieldErrors = Partial<
  Record<
    | "url"
    | "executeAt"
    | "delay"
    | "payload"
    | "headers"
    | "retries"
    | "retryInterval"
    | "timeout"
    | "onFailure"
    | "schedule",
    string
  >
>;

function headerRowsFromTask(task?: Task | null): HeaderRow[] {
  if (!task?.headers) return [];
  return Object.entries(task.headers).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value,
  }));
}

function payloadFromTask(task?: Task | null): { kind: PayloadKind; text: string } {
  if (!task || task.payload === undefined || task.payload === null) {
    return { kind: "none", text: "" };
  }
  if (typeof task.payload === "string") return { kind: "text", text: task.payload };
  return { kind: "json", text: JSON.stringify(task.payload, null, 2) };
}

export function TaskFormModal({ open, config, task, onClose, onSaved }: TaskFormModalProps) {
  const { t, durationError } = useI18n();
  const isEdit = Boolean(task);
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [url, setUrl] = useState("");
  const [timing, setTiming] = useState<TimingMode>("at");
  const [executeAt, setExecuteAt] = useState(defaultExecuteAt());
  const [delayValue, setDelayValue] = useState("5");
  const [delayUnit, setDelayUnit] = useState<DelayUnit>("m");
  const [payloadKind, setPayloadKind] = useState<PayloadKind>("none");
  const [payloadText, setPayloadText] = useState("");
  const [headers, setHeaders] = useState<HeaderRow[]>([]);
  const [retries, setRetries] = useState("0");
  const [retryInterval, setRetryInterval] = useState("2000");
  const [retryMode, setRetryMode] = useState<RetryMode>("fixed");
  const [timeoutMs, setTimeoutMs] = useState("");
  const [onFailureUrl, setOnFailureUrl] = useState("");
  const [schedule, setSchedule] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    const payload = payloadFromTask(task);
    setMethod(task?.method ?? "POST");
    setUrl(task?.url ?? "");
    setTiming("at");
    setExecuteAt(task ? toDateTimeInput(task.execute_at) : defaultExecuteAt());
    setDelayValue("5");
    setDelayUnit("m");
    setPayloadKind(payload.kind);
    setPayloadText(payload.text);
    setHeaders(headerRowsFromTask(task));
    setRetries(String(task?.retries ?? 0));
    setRetryInterval(String(task?.retry_interval ?? 2000));
    setRetryMode(task?.retry_mode ?? "fixed");
    setTimeoutMs(task?.timeout_ms ? String(task.timeout_ms) : "");
    setOnFailureUrl(task?.on_failure_url ?? "");
    setSchedule(task?.schedule ?? "");
    setIdempotencyKey(task ? "" : crypto.randomUUID());
    setShowAdvanced(
      Boolean(
        task?.timeout_ms ||
        task?.schedule ||
        task?.on_failure_url ||
        task?.retries ||
        task?.retry_mode === "exponential",
      ),
    );
    setSubmitting(false);
    setFormError(null);
    setFieldErrors({});
  }, [open, task]);

  const clearError = (key: keyof FieldErrors) => {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateHeader = (id: string, patch: Partial<HeaderRow>) => {
    setHeaders((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    clearError("headers");
  };

  const formatJson = () => {
    try {
      const parsed = JSON.parse(payloadText) as unknown;
      setPayloadText(JSON.stringify(parsed, null, 2));
      clearError("payload");
    } catch {
      setFieldErrors((current) => ({ ...current, payload: t("form.err.jsonFormatInvalid") }));
    }
  };

  const validate = (): { body: TaskRequest; idempotencyKey?: string } | null => {
    const errors: FieldErrors = {};

    if (!url.trim()) {
      errors.url = t("form.err.urlRequired");
    } else if (!isHttpUrl(url.trim())) {
      errors.url = t("form.err.urlInvalid");
    }

    let executeAtIso: string | undefined;
    let executeIn: string | undefined;
    if (timing === "at" || isEdit) {
      if (!executeAt) {
        errors.executeAt = t("form.err.executeAtRequired");
      } else {
        const date = new Date(executeAt);
        if (Number.isNaN(date.getTime())) {
          errors.executeAt = t("form.err.executeAtInvalid");
        } else if (date.getTime() <= Date.now() + 1000) {
          errors.executeAt = t("form.err.executeAtPast");
        } else {
          executeAtIso = date.toISOString();
        }
      }
    } else {
      const amount = Number(delayValue);
      if (!delayValue.trim() || !Number.isFinite(amount) || amount <= 0) {
        errors.delay = t("form.err.delayPositive");
      } else if (amount > 3650) {
        errors.delay = t("form.err.delayTooLarge");
      } else {
        executeIn =
          delayUnit === "m" ? `${amount}m` : delayUnit === "h" ? `${amount}h` : `${amount * 24}h`;
      }
    }

    let payloadValue: unknown;
    let hasPayload = false;
    if (payloadKind === "json" && payloadText.trim()) {
      try {
        payloadValue = JSON.parse(payloadText);
        hasPayload = true;
      } catch {
        errors.payload = t("form.err.payloadInvalid");
      }
    } else if (payloadKind === "text" && payloadText) {
      payloadValue = payloadText;
      hasPayload = true;
    }

    const headerObject: Record<string, string> = {};
    const seen = new Set<string>();
    for (const row of headers) {
      const key = row.key.trim();
      if (!key) {
        if (row.value.trim()) errors.headers = t("form.err.headerMissingName");
        continue;
      }
      const lower = key.toLowerCase();
      if (seen.has(lower)) {
        errors.headers = t("form.err.headerDuplicate", key);
      }
      seen.add(lower);
      headerObject[key] = row.value;
    }

    const retriesValue = Number(retries);
    if (!Number.isInteger(retriesValue) || retriesValue < 0) {
      errors.retries = t("form.err.retriesInteger");
    }

    const intervalValue = Number(retryInterval);
    if (!Number.isInteger(intervalValue) || intervalValue < 0) {
      errors.retryInterval = t("form.err.retryIntervalInteger");
    }

    let timeoutValue = 0;
    if (timeoutMs.trim()) {
      timeoutValue = Number(timeoutMs);
      if (!Number.isInteger(timeoutValue) || timeoutValue < 0 || timeoutValue > 300_000) {
        errors.timeout = t("form.err.timeoutRange");
      }
    }

    if (onFailureUrl.trim() && !isHttpUrl(onFailureUrl.trim())) {
      errors.onFailure = t("form.err.onFailureInvalid");
    }

    if (schedule.trim()) {
      const scheduleError = validateGoDuration(schedule);
      if (scheduleError) errors.schedule = durationError(scheduleError);
    }

    setFieldErrors(errors);
    const advancedErrorKeys: (keyof FieldErrors)[] = [
      "retries",
      "retryInterval",
      "timeout",
      "onFailure",
      "schedule",
    ];
    if (advancedErrorKeys.some((key) => errors[key])) setShowAdvanced(true);

    if (Object.keys(errors).length > 0) return null;

    const body: TaskRequest = {
      url: url.trim(),
      method,
      retries: retriesValue,
      retry_interval: intervalValue,
      retry_mode: retryMode,
    };

    if (executeAtIso) body.execute_at = executeAtIso;
    if (executeIn) body.execute_in = executeIn;
    if (hasPayload && method !== "GET" && method !== "HEAD") body.payload = payloadValue;
    if (Object.keys(headerObject).length > 0) body.headers = headerObject;
    if (timeoutValue > 0) body.timeout_ms = timeoutValue;
    if (onFailureUrl.trim()) body.on_failure_url = onFailureUrl.trim();
    if (schedule.trim()) body.schedule = schedule.trim();

    if (isEdit) return { body };

    // Every new task gets its own key so a fresh submission creates a new task.
    // Reusing the same key (e.g. after a failed request) stays idempotent.
    const key = idempotencyKey.trim() || crypto.randomUUID();
    if (!idempotencyKey.trim()) setIdempotencyKey(key);
    return { body, idempotencyKey: key };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const result = validate();
    if (!result) return;

    setSubmitting(true);
    try {
      const saved = task
        ? await updateTask(config, task.id, result.body)
        : await createTask(config, result.body, result.idempotencyKey);
      onSaved(saved, task ? "edit" : "create");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("form.err.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const payloadDisabled = method === "GET" || method === "HEAD";
  const utcPreview =
    (timing === "at" || isEdit) && executeAt && !Number.isNaN(new Date(executeAt).getTime())
      ? new Date(executeAt).toISOString()
      : null;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={isEdit ? t("form.editTitle") : t("form.createTitle")}
      description={isEdit ? t("form.editDescription") : t("form.createDescription")}
      icon={isEdit ? <Pencil size={19} /> : <Plus size={19} />}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            {t("common.cancel")}
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            {isEdit ? t("form.saveChanges") : t("form.create")}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className="task-form" noValidate>
        <div className="url-field-row">
          <label className="field method-field">
            <span className="field-label">{t("form.method")}</span>
            <select
              className="select"
              value={method}
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
              disabled={submitting}
            >
              {HTTP_METHODS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t("form.url")}</span>
            <input
              className={`input ${fieldErrors.url ? "has-error" : ""}`}
              type="url"
              inputMode="url"
              placeholder="https://api.example.com/webhooks/reminder"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                clearError("url");
              }}
              disabled={submitting}
              autoFocus
              spellCheck={false}
              required
            />
            {fieldErrors.url && <span className="field-error">{fieldErrors.url}</span>}
          </label>
        </div>

        <section className="form-section">
          <div className="form-section-head">
            <span className="section-icon">
              <Clock3 size={15} />
            </span>
            <div>
              <h3>{t("form.executeAt")}</h3>
              <p>{t("form.timezoneHint", localTimezone())}</p>
            </div>
          </div>

          {!isEdit && (
            <div
              className="segmented timing-segmented"
              role="group"
              aria-label={t("form.executeAt")}
            >
              <button
                type="button"
                className={timing === "at" ? "segment active" : "segment"}
                onClick={() => setTiming("at")}
                aria-pressed={timing === "at"}
              >
                {t("form.at")}
              </button>
              <button
                type="button"
                className={timing === "after" ? "segment active" : "segment"}
                onClick={() => setTiming("after")}
                aria-pressed={timing === "after"}
              >
                {t("form.after")}
              </button>
            </div>
          )}

          {timing === "at" || isEdit ? (
            <div className="field">
              <label className="field-label" htmlFor="execute-at">
                {isEdit ? t("form.newExecuteAt") : t("form.executeAt")}
              </label>
              <input
                id="execute-at"
                className={`input ${fieldErrors.executeAt ? "has-error" : ""}`}
                type="datetime-local"
                step="1"
                value={executeAt}
                onChange={(event) => {
                  setExecuteAt(event.target.value);
                  clearError("executeAt");
                }}
                disabled={submitting}
              />
              {fieldErrors.executeAt ? (
                <span className="field-error">{fieldErrors.executeAt}</span>
              ) : (
                <span className="hint">
                  {utcPreview ? t("form.utcPreview", utcPreview) : t("form.chooseFuture")}
                </span>
              )}
            </div>
          ) : (
            <div className="field">
              <label className="field-label" htmlFor="delay-value">
                {t("form.fromNow")}
              </label>
              <div className="delay-row">
                <input
                  id="delay-value"
                  className={`input ${fieldErrors.delay ? "has-error" : ""}`}
                  type="number"
                  min="1"
                  step="1"
                  value={delayValue}
                  onChange={(event) => {
                    setDelayValue(event.target.value);
                    clearError("delay");
                  }}
                  disabled={submitting}
                />
                <select
                  className="select delay-unit"
                  value={delayUnit}
                  onChange={(event) => setDelayUnit(event.target.value as DelayUnit)}
                  disabled={submitting}
                  aria-label={t("form.delayUnit")}
                >
                  <option value="m">{t("form.minutes")}</option>
                  <option value="h">{t("form.hours")}</option>
                  <option value="d">{t("form.days")}</option>
                </select>
              </div>
              {fieldErrors.delay && <span className="field-error">{fieldErrors.delay}</span>}
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <span className="section-icon">
              <Code2 size={15} />
            </span>
            <div>
              <h3>{t("form.body")}</h3>
              <p>{t("form.bodyHint")}</p>
            </div>
            {payloadKind === "json" && payloadText.trim() && (
              <button type="button" className="link-btn section-action" onClick={formatJson}>
                {t("form.format")}
              </button>
            )}
          </div>

          <div className="segmented payload-segmented" role="group" aria-label={t("form.body")}>
            {(
              [
                ["none", t("form.payloadNone")],
                ["json", "JSON"],
                ["text", t("form.payloadText")],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={payloadKind === kind ? "segment active" : "segment"}
                onClick={() => setPayloadKind(kind)}
                disabled={submitting || payloadDisabled}
                aria-pressed={payloadKind === kind}
              >
                {label}
              </button>
            ))}
          </div>

          {payloadDisabled ? (
            <p className="hint">{t("form.noBodyHint", method)}</p>
          ) : payloadKind === "none" ? (
            <p className="hint no-payload">{t("form.noPayload")}</p>
          ) : (
            <>
              <textarea
                className={`textarea code-editor ${fieldErrors.payload ? "has-error" : ""}`}
                rows={7}
                spellCheck={false}
                placeholder={
                  payloadKind === "json"
                    ? '{\n  "event": "user.created"\n}'
                    : t("form.textPlaceholder")
                }
                value={payloadText}
                onChange={(event) => {
                  setPayloadText(event.target.value);
                  clearError("payload");
                }}
                disabled={submitting}
              />
              {fieldErrors.payload && <span className="field-error">{fieldErrors.payload}</span>}
            </>
          )}
        </section>

        <section className="form-section">
          <div className="form-section-head">
            <span className="section-icon">
              <ListPlus size={15} />
            </span>
            <div>
              <h3>{t("form.headers")}</h3>
              <p>{t("form.headersHint")}</p>
            </div>
            <button
              type="button"
              className="link-btn section-action"
              onClick={() => {
                setHeaders((current) => [
                  ...current,
                  { id: crypto.randomUUID(), key: "", value: "" },
                ]);
                clearError("headers");
              }}
              disabled={submitting}
            >
              <Plus size={14} />
              {t("form.add")}
            </button>
          </div>

          {headers.length === 0 ? (
            <p className="hint no-payload">{t("form.noHeaders")}</p>
          ) : (
            <div className="headers-editor">
              {headers.map((row) => (
                <div className="header-row" key={row.id}>
                  <input
                    className="input"
                    placeholder={t("form.headerName")}
                    value={row.key}
                    onChange={(event) => updateHeader(row.id, { key: event.target.value })}
                    disabled={submitting}
                    spellCheck={false}
                    aria-label={t("form.headerNameAria")}
                  />
                  <input
                    className="input"
                    placeholder={t("form.headerValue")}
                    value={row.value}
                    onChange={(event) => updateHeader(row.id, { value: event.target.value })}
                    disabled={submitting}
                    spellCheck={false}
                    aria-label={t("form.headerValueAria")}
                  />
                  <button
                    type="button"
                    className="icon-btn danger-subtle"
                    onClick={() => {
                      setHeaders((current) => current.filter((item) => item.id !== row.id));
                      clearError("headers");
                    }}
                    disabled={submitting}
                    aria-label={t("form.deleteHeader")}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {fieldErrors.headers && <span className="field-error">{fieldErrors.headers}</span>}
        </section>

        <section className="form-section advanced-section">
          <button
            type="button"
            className="advanced-toggle"
            onClick={() => setShowAdvanced((current) => !current)}
            aria-expanded={showAdvanced}
          >
            <span className="section-icon">
              <SlidersHorizontal size={15} />
            </span>
            <span className="advanced-toggle-copy">
              <span className="advanced-title">{t("form.advancedTitle")}</span>
              <span className="advanced-sub">{t("form.advancedSub")}</span>
            </span>
            <ChevronDown size={17} className={showAdvanced ? "chevron rotated" : "chevron"} />
          </button>

          {showAdvanced && (
            <div className="advanced-fields">
              <label className="field">
                <span className="field-label">{t("form.retries")}</span>
                <input
                  className={`input ${fieldErrors.retries ? "has-error" : ""}`}
                  type="number"
                  min="0"
                  step="1"
                  value={retries}
                  onChange={(event) => {
                    setRetries(event.target.value);
                    clearError("retries");
                  }}
                  disabled={submitting}
                />
                {fieldErrors.retries ? (
                  <span className="field-error">{fieldErrors.retries}</span>
                ) : (
                  <span className="hint">{t("form.retriesHint")}</span>
                )}
              </label>

              <label className="field">
                <span className="field-label">{t("form.retryInterval")}</span>
                <input
                  className={`input ${fieldErrors.retryInterval ? "has-error" : ""}`}
                  type="number"
                  min="0"
                  step="100"
                  value={retryInterval}
                  onChange={(event) => {
                    setRetryInterval(event.target.value);
                    clearError("retryInterval");
                  }}
                  disabled={submitting}
                />
                {fieldErrors.retryInterval ? (
                  <span className="field-error">{fieldErrors.retryInterval}</span>
                ) : (
                  <span className="hint">{t("form.retryIntervalHint")}</span>
                )}
              </label>

              <label className="field">
                <span className="field-label">{t("form.retryStrategy")}</span>
                <select
                  className="select"
                  value={retryMode}
                  onChange={(event) => setRetryMode(event.target.value as RetryMode)}
                  disabled={submitting}
                >
                  {RETRY_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode === "fixed" ? t("form.retryFixedOption") : t("form.retryExpOption")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">
                  {t("form.timeout")} <span className="label-optional">{t("common.optional")}</span>
                </span>
                <input
                  className={`input ${fieldErrors.timeout ? "has-error" : ""}`}
                  type="number"
                  min="0"
                  max="300000"
                  step="1000"
                  placeholder={t("form.timeoutPlaceholder")}
                  value={timeoutMs}
                  onChange={(event) => {
                    setTimeoutMs(event.target.value);
                    clearError("timeout");
                  }}
                  disabled={submitting}
                />
                {fieldErrors.timeout && <span className="field-error">{fieldErrors.timeout}</span>}
              </label>

              <label className="field">
                <span className="field-label">
                  <Repeat2 size={13} /> {t("form.schedule")}{" "}
                  <span className="label-optional">{t("common.optional")}</span>
                </span>
                <input
                  className={`input mono ${fieldErrors.schedule ? "has-error" : ""}`}
                  placeholder={t("form.schedulePlaceholder")}
                  value={schedule}
                  onChange={(event) => {
                    setSchedule(event.target.value);
                    clearError("schedule");
                  }}
                  disabled={submitting}
                  spellCheck={false}
                />
                {fieldErrors.schedule ? (
                  <span className="field-error">{fieldErrors.schedule}</span>
                ) : (
                  <span className="hint">{t("form.scheduleHint")}</span>
                )}
              </label>

              <label className="field field-span-2">
                <span className="field-label">
                  {t("form.onFailureUrl")}{" "}
                  <span className="label-optional">{t("common.optional")}</span>
                </span>
                <input
                  className={`input ${fieldErrors.onFailure ? "has-error" : ""}`}
                  type="url"
                  placeholder="https://hooks.example.com/schedy-failed"
                  value={onFailureUrl}
                  onChange={(event) => {
                    setOnFailureUrl(event.target.value);
                    clearError("onFailure");
                  }}
                  disabled={submitting}
                  spellCheck={false}
                />
                {fieldErrors.onFailure && (
                  <span className="field-error">{fieldErrors.onFailure}</span>
                )}
              </label>

              {!isEdit && (
                <label className="field field-span-2">
                  <span className="field-label">{t("form.idempotencyKey")}</span>
                  <div className="input-with-action">
                    <input
                      className="input mono"
                      placeholder={t("form.idempotencyPlaceholder")}
                      value={idempotencyKey}
                      onChange={(event) => setIdempotencyKey(event.target.value)}
                      disabled={submitting}
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="input-action text-action"
                      onClick={() => setIdempotencyKey(crypto.randomUUID())}
                      disabled={submitting}
                    >
                      {t("form.regenerate")}
                    </button>
                  </div>
                  <span className="hint">{t("form.idempotencyHint")}</span>
                </label>
              )}
            </div>
          )}
        </section>

        {formError && (
          <div className="inline-alert inline-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        {isEdit && task && (
          <p className="form-footnote" title={formatAbsolute(task.execute_at)}>
            {t("form.taskIdLabel")}
            <code>{task.id}</code>
          </p>
        )}
      </form>
    </Modal>
  );
}
