import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Gauge,
  HeartPulse,
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  Timer,
  XCircle,
} from "lucide-react";
import { useToast } from "../components/Toast";
import {
  ApiError,
  downloadBackup,
  getHealth,
  getMetrics,
  getReadiness,
  parseMetrics,
} from "../lib/api";
import { maskKey, formatNumber, formatDuration, copyText } from "../lib/format";
import { localeTag, useI18n } from "../lib/i18n";
import type { ConnectionConfig, HealthResponse, ParsedMetrics } from "../types";
import { TASK_STATUSES } from "../types";

interface SystemPageProps {
  config: ConnectionConfig;
  onOpenSettings: () => void;
}

interface SystemData {
  health: HealthResponse | null;
  healthLatency: number | null;
  healthError: string | null;
  ready: boolean | null;
  readyError: string | null;
  metrics: ParsedMetrics | null;
  metricsError: string | null;
}

const EMPTY_DATA: SystemData = {
  health: null,
  healthLatency: null,
  healthError: null,
  ready: null,
  readyError: null,
  metrics: null,
  metricsError: null,
};

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function SystemPage({ config, onOpenSettings }: SystemPageProps) {
  const toast = useToast();
  const { t, locale, statusLabel } = useI18n();
  const [data, setData] = useState<SystemData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++seq.current;
    setLoading(true);
    const healthStartedAt = performance.now();
    const healthRequest = getHealth(config).then((health) => ({
      health,
      latency: Math.round(performance.now() - healthStartedAt),
    }));
    const [healthResult, readyResult, metricsResult] = await Promise.allSettled([
      healthRequest,
      getReadiness(config),
      getMetrics(config),
    ]);
    if (requestId !== seq.current) return;

    setData((current) => ({
      health: healthResult.status === "fulfilled" ? healthResult.value.health : current.health,
      healthLatency:
        healthResult.status === "fulfilled" ? healthResult.value.latency : current.healthLatency,
      healthError:
        healthResult.status === "rejected"
          ? messageOf(healthResult.reason, t("error.health"))
          : null,
      ready: readyResult.status === "fulfilled" ? readyResult.value : null,
      readyError:
        readyResult.status === "rejected" ? messageOf(readyResult.reason, t("error.ready")) : null,
      metrics:
        metricsResult.status === "fulfilled" ? parseMetrics(metricsResult.value) : current.metrics,
      metricsError:
        metricsResult.status === "rejected"
          ? messageOf(metricsResult.reason, t("error.metrics"))
          : null,
    }));
    setUpdatedAt(new Date());
    setLoading(false);
  }, [config, t]);

  useEffect(() => {
    void load();
    return () => {
      seq.current += 1;
    };
  }, [load]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { blob, filename } = await downloadBackup(config);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(t("system.backupStarted"), filename);
    } catch (error) {
      toast.error(t("error.backup"), messageOf(error, t("common.retryLater")));
    } finally {
      setBackupLoading(false);
    }
  };

  const copyRawMetrics = async () => {
    if (!data.metrics) return;
    try {
      await copyText(data.metrics.raw);
      toast.success(t("system.metricsCopied"));
    } catch {
      toast.error(t("common.copyFailed"), t("common.clipboardDenied"));
    }
  };

  const success = data.metrics?.deliveries.success ?? 0;
  const failure = data.metrics?.deliveries.failure ?? 0;
  const totalDeliveries = success + failure;
  const successRate = totalDeliveries > 0 ? (success / totalDeliveries) * 100 : null;

  return (
    <div className="page system-page">
      <div className="page-heading">
        <div>
          <h1>{t("system.title")}</h1>
          <p>{t("system.subtitle")}</p>
        </div>
        <div className="page-heading-actions">
          {updatedAt && (
            <span className="updated-at system-updated">
              {t(
                "tasks.updatedAt",
                updatedAt.toLocaleTimeString(localeTag(locale), { hour12: false }),
              )}
            </span>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      <div className="system-grid">
        <section className={`system-card ${data.healthError ? "has-error" : ""}`}>
          <div className="system-card-head">
            <span className="system-card-icon green">
              <HeartPulse size={18} />
            </span>
            <div>
              <h2>{t("system.health")}</h2>
              <p>/healthz</p>
            </div>
          </div>
          {loading && !data.health ? (
            <div className="system-card-loading">
              <Loader2 size={18} className="spin" /> {t("common.checking")}
            </div>
          ) : data.healthError ? (
            <div className="system-card-error">
              <XCircle size={17} />
              <span>{data.healthError}</span>
            </div>
          ) : (
            <>
              <div className="system-card-value">
                <span className="status-led online" />
                {data.health?.status ?? t("common.unknown")}
              </div>
              <div className="system-kv">
                <span>{t("system.version")}</span>
                <code>{data.health?.version || t("common.unknown")}</code>
              </div>
              <div className="system-kv">
                <span>{t("system.latency")}</span>
                <span>{formatDuration(data.healthLatency)}</span>
              </div>
            </>
          )}
        </section>

        <section
          className={`system-card ${data.ready === false || data.readyError ? "has-error" : ""}`}
        >
          <div className="system-card-head">
            <span className="system-card-icon blue">
              <Database size={18} />
            </span>
            <div>
              <h2>{t("system.storage")}</h2>
              <p>/readyz</p>
            </div>
          </div>
          {loading && data.ready === null ? (
            <div className="system-card-loading">
              <Loader2 size={18} className="spin" /> {t("common.checking")}
            </div>
          ) : data.readyError ? (
            <div className="system-card-error">
              <XCircle size={17} />
              <span>{data.readyError}</span>
            </div>
          ) : data.ready ? (
            <>
              <div className="system-card-value">
                <span className="status-led online" />
                {t("common.ready")}
              </div>
              <p className="system-card-note">{t("system.readyNote")}</p>
            </>
          ) : (
            <>
              <div className="system-card-value">
                <span className="status-led offline" />
                {t("common.notReady")}
              </div>
              <p className="system-card-note">{t("system.notReadyNote")}</p>
            </>
          )}
        </section>

        <section className={`system-card ${data.metricsError ? "has-error" : ""}`}>
          <div className="system-card-head">
            <span className="system-card-icon amber">
              <Gauge size={18} />
            </span>
            <div>
              <h2>{t("system.queue")}</h2>
              <p>{t("system.queueSubtitle")}</p>
            </div>
          </div>
          {data.metricsError ? (
            <div className="system-card-error">
              <AlertCircle size={17} />
              <span>{data.metricsError}</span>
            </div>
          ) : (
            <div className="queue-metrics">
              <div className="queue-metric">
                <span className="queue-value">{data.metrics?.inflight ?? "—"}</span>
                <span className="queue-label">
                  <Activity size={12} /> {t("system.inflight")}
                </span>
              </div>
              <div className="queue-metric">
                <span className={`queue-value ${(data.metrics?.overdue ?? 0) > 0 ? "warn" : ""}`}>
                  {data.metrics?.overdue ?? "—"}
                </span>
                <span className="queue-label">
                  <Timer size={12} /> {t("system.overdue")}
                </span>
              </div>
              <div className="queue-metric">
                <span className="queue-value">{formatNumber(totalDeliveries)}</span>
                <span className="queue-label">
                  <CheckCircle2 size={12} /> {t("system.totalDeliveries")}
                </span>
              </div>
            </div>
          )}
        </section>

        <section className="system-card">
          <div className="system-card-head">
            <span className="system-card-icon violet">
              <Server size={18} />
            </span>
            <div>
              <h2>{t("system.connection")}</h2>
              <p>{t("system.connectionSubtitle")}</p>
            </div>
            <button type="button" className="link-btn system-card-action" onClick={onOpenSettings}>
              {t("system.change")}
            </button>
          </div>
          <div className="system-kv">
            <span>{t("system.serverUrl")}</span>
            <code title={config.baseUrl}>{config.baseUrl}</code>
          </div>
          <div className="system-kv">
            <span>{t("system.connectionMode")}</span>
            <span>{config.mode === "proxy" ? t("common.proxyMode") : t("common.directMode")}</span>
          </div>
          <div className="system-kv">
            <span>{t("system.apiKey")}</span>
            <code>{maskKey(config.apiKey)}</code>
          </div>
          <div className="system-kv">
            <span>{t("system.autoRefresh")}</span>
            <span>
              {config.autoRefresh > 0
                ? t("system.autoRefreshValue", config.autoRefresh / 1000)
                : t("system.off")}
            </span>
          </div>
        </section>
      </div>

      <div className="system-columns">
        <section className="panel metrics-panel">
          <div className="panel-head">
            <div>
              <h2>{t("system.metricsTitle")}</h2>
              <p>{t("system.metricsSubtitle")}</p>
            </div>
            <button
              type="button"
              className="link-btn"
              onClick={() => void copyRawMetrics()}
              disabled={!data.metrics}
            >
              <Copy size={13} />
              {t("system.copyRaw")}
            </button>
          </div>

          {data.metrics ? (
            <>
              <div className="metrics-status-grid">
                {TASK_STATUSES.map((status) => (
                  <div className={`metrics-status metrics-${status}`} key={status}>
                    <span className="metrics-status-value">
                      {formatNumber(data.metrics?.counts[status] ?? 0)}
                    </span>
                    <span className="metrics-status-label">{statusLabel(status)}</span>
                  </div>
                ))}
              </div>

              <div className="delivery-summary">
                <div className="delivery-summary-head">
                  <span>{t("system.deliveryResults")}</span>
                  <span>
                    <strong>{formatNumber(success)}</strong> {t("system.succeeded")} ·{" "}
                    <strong>{formatNumber(failure)}</strong> {t("system.failed")}
                  </span>
                </div>
                <div
                  className="delivery-bar"
                  role="img"
                  aria-label={t("system.deliveryBarAria", (successRate ?? 0).toFixed(1))}
                >
                  <span
                    className="delivery-bar-success"
                    style={{ width: `${successRate ?? 0}%` }}
                  />
                </div>
                <div className="delivery-summary-foot">
                  <span>
                    {successRate === null
                      ? t("system.noDeliveryData")
                      : t("system.successRate", successRate.toFixed(1))}
                  </span>
                  <span>{t("system.retryCountedSeparately")}</span>
                </div>
              </div>

              <details className="raw-metrics">
                <summary>{t("system.rawSummary")}</summary>
                <pre>{data.metrics.raw}</pre>
              </details>
            </>
          ) : (
            <div className="panel-empty">
              {data.metricsError ? (
                <>
                  <AlertCircle size={22} />
                  <p>{data.metricsError}</p>
                </>
              ) : (
                <>
                  <Loader2 size={22} className="spin" />
                  <p>{t("system.metricsLoading")}</p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="panel maintenance-panel">
          <div className="panel-head">
            <div>
              <h2>{t("system.backup")}</h2>
              <p>{t("system.backupSubtitle")}</p>
            </div>
          </div>
          <div className="backup-illustration">
            <Database size={30} />
          </div>
          <p className="maintenance-copy">
            {t("system.backupNoteBefore")}
            <code>schedy restore &lt;backup-file&gt;</code>
            {t("system.backupNoteAfter")}
          </p>
          <button
            type="button"
            className="btn btn-secondary maintenance-button"
            onClick={() => void handleBackup()}
            disabled={backupLoading}
          >
            {backupLoading ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
            {backupLoading ? t("system.backupPreparing") : t("system.downloadBackup")}
          </button>

          <div className="maintenance-divider" />

          <div className="security-note">
            <ShieldCheck size={16} />
            <div>
              <strong>{t("system.securityTitle")}</strong>
              <p>{t("system.securityBody")}</p>
            </div>
          </div>
          <a
            className="docs-link"
            href="https://schedy.mintlify.app"
            target="_blank"
            rel="noreferrer"
          >
            {t("system.docs")}
            <ExternalLink size={13} />
          </a>
        </section>
      </div>
    </div>
  );
}
