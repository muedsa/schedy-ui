import { ChevronRight, Clock3, Repeat2, RotateCcw, Timer } from "lucide-react";
import { useI18n } from "../lib/i18n";
import type { Task } from "../types";
import { formatAbsolute, formatCompactDate, formatRelative, formatDuration } from "../lib/format";
import { CodeBadge, MethodBadge, StatusBadge } from "./Badges";

interface TaskTableProps {
  tasks: Task[];
  loading: boolean;
  onOpen: (task: Task) => void;
}

export function TaskTable({ tasks, loading, onOpen }: TaskTableProps) {
  const { t } = useI18n();
  return (
    <div className="table-scroll">
      <table className="task-table">
        <thead>
          <tr>
            <th className="col-status">{t("table.status")}</th>
            <th className="col-target">{t("table.target")}</th>
            <th className="col-time">{t("table.scheduled")}</th>
            <th className="col-attempts">{t("table.attempts")}</th>
            <th className="col-open">
              <span className="sr-only">{t("table.view")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
                <tr key={`skeleton-${index}`} className="skeleton-row">
                  <td>
                    <span className="skeleton skeleton-badge" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-line wide" />
                    <span className="skeleton skeleton-line short" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-line medium" />
                    <span className="skeleton skeleton-line short" />
                  </td>
                  <td>
                    <span className="skeleton skeleton-line short" />
                  </td>
                  <td />
                </tr>
              ))
            : tasks.map((task) => {
                const attempts = task.attempts ?? [];
                const lastAttempt = attempts.at(-1);
                return (
                  <tr
                    key={task.id}
                    className="task-row"
                    tabIndex={0}
                    onClick={() => onOpen(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(task);
                      }
                    }}
                    aria-label={t("table.openTask", task.url)}
                  >
                    <td>
                      <StatusBadge status={task.status} />
                    </td>
                    <td>
                      <div className="target-line">
                        <MethodBadge method={task.method} />
                        <span className="task-url" title={task.url}>
                          {task.url}
                        </span>
                      </div>
                      <div className="task-meta-row">
                        {task.schedule && (
                          <span className="meta-chip" title={t("table.repeatInterval")}>
                            <Repeat2 size={12} />
                            {task.schedule}
                          </span>
                        )}
                        {task.retries > 0 ? (
                          <span className="meta-chip" title={t("table.failedRetry")}>
                            <RotateCcw size={12} />
                            {t(
                              "table.retryCount",
                              task.retries,
                              task.retry_mode === "exponential"
                                ? t("retry.exponentialShort")
                                : t("retry.fixedShort"),
                            )}
                          </span>
                        ) : (
                          <span className="meta-chip muted">{t("table.noRetry")}</span>
                        )}
                        {task.timeout_ms ? (
                          <span className="meta-chip" title={t("table.timeout")}>
                            <Timer size={12} />
                            {formatDuration(task.timeout_ms)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="time-main" title={formatAbsolute(task.execute_at)}>
                        <Clock3 size={13} />
                        {formatCompactDate(task.execute_at)}
                      </div>
                      <div className={`time-sub ${task.status === "pending" ? "is-future" : ""}`}>
                        {formatRelative(task.execute_at)}
                        {task.finished_at
                          ? ` · ${t("table.finishedAt", formatCompactDate(task.finished_at))}`
                          : ""}
                      </div>
                    </td>
                    <td>
                      {lastAttempt ? (
                        <div className="attempt-cell">
                          <CodeBadge code={lastAttempt.status_code} />
                          <span className="attempt-count">
                            {t("table.attemptsCount", attempts.length)}
                          </span>
                        </div>
                      ) : (
                        <span className="muted-dash">—</span>
                      )}
                    </td>
                    <td>
                      <span className="row-open" aria-hidden>
                        <ChevronRight size={16} />
                      </span>
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
