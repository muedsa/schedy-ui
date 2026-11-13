import { Ban, CheckCircle2, Clock3, Layers3, LoaderCircle, XCircle } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { formatNumber } from "../lib/format";
import type { ParsedMetrics, TaskStatus } from "../types";
import { TASK_STATUSES } from "../types";

const STATUS_ICONS = {
  pending: Clock3,
  running: LoaderCircle,
  succeeded: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
} as const;

interface StatsCardsProps {
  metrics: ParsedMetrics | null;
  loading: boolean;
  metricsError: string | null;
  active: TaskStatus | "all";
  onSelect: (status: TaskStatus | "all") => void;
}

export function StatsCards({ metrics, loading, metricsError, active, onSelect }: StatsCardsProps) {
  const { t, statusLabel, statusDescription } = useI18n();
  const allCount = metrics
    ? TASK_STATUSES.reduce((sum, status) => sum + (metrics.counts[status] ?? 0), 0)
    : null;

  return (
    <div className="stats-grid">
      <button
        type="button"
        className={`stat-card stat-all ${active === "all" ? "active" : ""}`}
        onClick={() => onSelect("all")}
        aria-pressed={active === "all"}
      >
        <span className="stat-icon">
          <Layers3 size={18} />
        </span>
        <span className="stat-body">
          <span className="stat-label">{t("stats.all")}</span>
          <span className={`stat-value ${loading && allCount === null ? "is-loading" : ""}`}>
            {allCount === null ? (metricsError ? "—" : "…") : formatNumber(allCount)}
          </span>
          <span className="stat-meta">
            {metrics?.deliveries.total !== undefined
              ? t("stats.deliveries", metrics.deliveries.total)
              : t("stats.selectAll")}
          </span>
        </span>
      </button>

      {TASK_STATUSES.map((status) => {
        const Icon = STATUS_ICONS[status];
        const count = metrics?.counts[status];
        return (
          <button
            key={status}
            type="button"
            className={`stat-card stat-${status} ${active === status ? "active" : ""}`}
            onClick={() => onSelect(status)}
            aria-pressed={active === status}
            title={statusDescription(status)}
          >
            <span className="stat-icon">
              <Icon
                size={18}
                className={status === "running" && (count ?? 0) > 0 ? "spin-slow" : ""}
              />
            </span>
            <span className="stat-body">
              <span className="stat-label">{statusLabel(status)}</span>
              <span className="stat-value">
                {count === undefined ? (metricsError ? "—" : "…") : formatNumber(count)}
              </span>
              <span className="stat-meta">
                {status === "pending" && metrics?.overdue !== undefined
                  ? metrics.overdue > 0
                    ? t("stats.overdue", metrics.overdue)
                    : t("stats.noOverdue")
                  : statusDescription(status)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
