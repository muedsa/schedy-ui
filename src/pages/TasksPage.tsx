import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { BulkDeleteModal } from "../components/BulkDeleteModal";
import { StatsCards } from "../components/StatsCards";
import { TaskDrawer } from "../components/TaskDrawer";
import { TaskFormModal } from "../components/TaskFormModal";
import { TaskTable } from "../components/TaskTable";
import { useToast } from "../components/Toast";
import { ApiError, getMetrics, listTasks, parseMetrics } from "../lib/api";
import { localeTag, useI18n } from "../lib/i18n";
import { STATIC_EXPORT } from "../lib/runtime";
import type {
  ConnectionConfig,
  ParsedMetrics,
  Task,
  TaskListParams,
  TaskPage,
  TaskStatus,
} from "../types";

interface TasksPageProps {
  config: ConnectionConfig;
  onOpenSettings: () => void;
}

interface LoadedPage {
  page: TaskPage;
  cursor: string | undefined;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function TasksPage({ config, onOpenSettings }: TasksPageProps) {
  const toast = useToast();
  const { t, locale, statusLabel } = useI18n();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [urlDraft, setUrlDraft] = useState("");
  const [urlFilter, setUrlFilter] = useState("");
  const [dueAfter, setDueAfter] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  const [limit, setLimit] = useState(50);

  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [metrics, setMetrics] = useState<ParsedMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const requestSeq = useRef(0);
  const busyRef = useRef(false);

  const params = useMemo<TaskListParams>(() => {
    const next: TaskListParams = { limit };
    if (statusFilter !== "all") next.status = statusFilter;
    if (urlFilter.trim()) next.url = urlFilter.trim();
    if (dueAfter) {
      const date = new Date(dueAfter);
      if (!Number.isNaN(date.getTime())) next.due_after = date.toISOString();
    }
    if (dueBefore) {
      const date = new Date(dueBefore);
      if (!Number.isNaN(date.getTime())) next.due_before = date.toISOString();
    }
    return next;
  }, [statusFilter, urlFilter, dueAfter, dueBefore, limit]);

  const fetchMetrics = useCallback(
    async (requestId: number) => {
      try {
        const raw = await getMetrics(config);
        if (requestId !== requestSeq.current) return;
        setMetrics(parseMetrics(raw));
        setMetricsError(null);
      } catch (error) {
        if (requestId !== requestSeq.current) return;
        setMetricsError(messageOf(error, t("error.metrics")));
      }
    },
    [config, t],
  );

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestSeq.current;
    busyRef.current = true;
    setLoading(true);
    setLoadingMore(false);
    setListError(null);
    setPages([]);
    void fetchMetrics(requestId);
    try {
      const page = await listTasks(config, params);
      if (requestId !== requestSeq.current) return;
      setPages([{ page, cursor: undefined }]);
      setRefreshedAt(new Date());
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      setListError(messageOf(error, t("error.list")));
    } finally {
      if (requestId === requestSeq.current) {
        setLoading(false);
        busyRef.current = false;
      }
    }
  }, [config, params, fetchMetrics, t]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const refreshLoaded = useCallback(async () => {
    if (busyRef.current) return;
    const requestId = ++requestSeq.current;
    busyRef.current = true;
    setLoading(true);
    void fetchMetrics(requestId);

    try {
      if (pages.length === 0) {
        const page = await listTasks(config, params);
        if (requestId !== requestSeq.current) return;
        setPages([{ page, cursor: undefined }]);
      } else {
        const refreshed: LoadedPage[] = [];
        for (const loaded of pages) {
          const page = await listTasks(config, { ...params, cursor: loaded.cursor });
          if (requestId !== requestSeq.current) return;
          refreshed.push({ page, cursor: loaded.cursor });
          if (!page.has_more) break;
        }
        if (requestId !== requestSeq.current) return;
        setPages(refreshed);
      }
      setListError(null);
      setRefreshedAt(new Date());
    } catch (error) {
      if (requestId !== requestSeq.current) return;
      setListError(messageOf(error, t("error.listRefresh")));
    } finally {
      if (requestId === requestSeq.current) {
        setLoading(false);
        busyRef.current = false;
      }
    }
  }, [config, params, pages, fetchMetrics, t]);

  const refreshRef = useRef<() => void>(() => undefined);
  refreshRef.current = () => {
    void refreshLoaded();
  };

  useEffect(() => {
    if (config.autoRefresh <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshRef.current();
    }, config.autoRefresh);
    return () => window.clearInterval(timer);
  }, [config.autoRefresh]);

  const loadMore = async () => {
    const last = pages.at(-1);
    const cursor = last?.page.next_cursor;
    if (!cursor || !last?.page.has_more || loadingMore) return;
    const requestId = requestSeq.current;
    setLoadingMore(true);
    busyRef.current = true;
    try {
      const page = await listTasks(config, { ...params, cursor });
      if (requestId !== requestSeq.current) return;
      setPages((current) => {
        const seen = new Set(current.flatMap((item) => item.page.tasks.map((task) => task.id)));
        const deduped = {
          ...page,
          tasks: page.tasks.filter((task) => !seen.has(task.id)),
        };
        return [...current, { page: deduped, cursor }];
      });
      setRefreshedAt(new Date());
    } catch (error) {
      toast.error(t("tasks.loadMoreFailed"), messageOf(error, t("common.retryLater")));
    } finally {
      setLoadingMore(false);
      if (requestId === requestSeq.current) busyRef.current = false;
    }
  };

  const handleSelectStatus = (status: TaskStatus | "all") => {
    setStatusFilter((current) => (current === status && status !== "all" ? "all" : status));
  };

  const submitUrlFilter = () => {
    setUrlFilter(urlDraft.trim());
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setUrlDraft("");
    setUrlFilter("");
    setDueAfter("");
    setDueBefore("");
  };

  const hasFilters =
    statusFilter !== "all" || Boolean(urlFilter) || Boolean(dueAfter) || Boolean(dueBefore);
  const tasks = pages.flatMap((item) => item.page.tasks);
  const hasMore = pages.at(-1)?.page.has_more ?? false;
  const intervalSeconds = Math.round(config.autoRefresh / 1000);

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  const openCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
    setDrawerOpen(false);
  };

  const handleSaved = (saved: Task, mode: "create" | "edit") => {
    setFormOpen(false);
    setEditingTask(null);
    setSelectedTask(saved);
    setDrawerOpen(true);
    toast.success(mode === "create" ? t("tasks.createdToast") : t("tasks.updatedToast"), saved.url);
    void refreshLoaded();
  };

  const handleRetry = () => {
    if (pages.length === 0) void loadFirstPage();
    else void refreshLoaded();
  };

  return (
    <div className="page tasks-page">
      <div className="page-heading">
        <div>
          <h1>{t("tasks.title")}</h1>
          <p>{t("tasks.subtitle")}</p>
        </div>
        <div className="page-heading-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRetry}
            disabled={loading}
            title={t("tasks.refreshTitle")}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            {t("common.refresh")}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={17} />
            {t("tasks.create")}
          </button>
        </div>
      </div>

      <StatsCards
        metrics={metrics}
        loading={loading}
        metricsError={metricsError}
        active={statusFilter}
        onSelect={handleSelectStatus}
      />

      {metricsError && !listError && (
        <div className="stats-note">
          <AlertCircle size={14} />
          <span>{t("tasks.metricsUnavailable", metricsError)}</span>
          <button type="button" className="link-btn" onClick={handleRetry}>
            {t("common.retry")}
          </button>
        </div>
      )}

      <section className="filter-bar">
        <form
          className="url-search"
          onSubmit={(event) => {
            event.preventDefault();
            submitUrlFilter();
          }}
        >
          <Search size={16} aria-hidden />
          <input
            className="input"
            placeholder={t("tasks.urlPlaceholder")}
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            spellCheck={false}
            aria-label={t("tasks.urlPlaceholder")}
          />
          <button type="submit" className="btn btn-ghost btn-sm">
            {t("tasks.filter")}
          </button>
          {urlFilter && (
            <span className="active-filter-tag" title={t("tasks.exactMatch", urlFilter)}>
              {urlFilter}
              <button
                type="button"
                onClick={() => {
                  setUrlFilter("");
                  setUrlDraft("");
                }}
                aria-label={t("tasks.clearUrlFilter")}
              >
                <X size={12} />
              </button>
            </span>
          )}
        </form>

        <label className="filter-date">
          <CalendarDays size={15} />
          <span>{t("tasks.dueAfter")}</span>
          <input
            className="input"
            type="datetime-local"
            step="1"
            value={dueAfter}
            onChange={(event) => setDueAfter(event.target.value)}
          />
        </label>

        <label className="filter-date">
          <span>{t("tasks.dueBefore")}</span>
          <input
            className="input"
            type="datetime-local"
            step="1"
            value={dueBefore}
            onChange={(event) => setDueBefore(event.target.value)}
          />
        </label>

        <label className="filter-limit">
          <span>{t("tasks.perPage")}</span>
          <select
            className="select"
            value={String(limit)}
            onChange={(event) => setLimit(Number(event.target.value))}
            aria-label={t("tasks.pageSize")}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>

        {hasFilters && (
          <button type="button" className="link-btn clear-filters" onClick={clearFilters}>
            <X size={14} />
            {t("tasks.clearFilters")}
          </button>
        )}
      </section>

      <div className="list-toolbar">
        <div className="list-meta">
          <span>
            {t("tasks.loaded", tasks.length)}
            {statusFilter !== "all" && (
              <span className="meta-separator">· {statusLabel(statusFilter)}</span>
            )}
          </span>
          {refreshedAt && (
            <span className="updated-at">
              {t(
                "tasks.updatedAt",
                refreshedAt.toLocaleTimeString(localeTag(locale), { hour12: false }),
              )}
            </span>
          )}
          {config.autoRefresh > 0 && (
            <span className="auto-tag" title={t("tasks.autoRefreshTitle", intervalSeconds)}>
              <RefreshCw size={11} />
              {intervalSeconds}s
            </span>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm danger-text"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 size={14} />
          {t("tasks.bulkDelete")}
        </button>
      </div>

      {listError && pages.length > 0 && (
        <div className="inline-alert inline-alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{listError}</span>
          <button type="button" className="link-btn" onClick={handleRetry}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!listError || pages.length > 0 ? (
        <section className="table-card">
          <TaskTable tasks={tasks} loading={loading && pages.length === 0} onOpen={openTask} />
          {!loading && tasks.length === 0 && (
            <div className="empty-state">
              {hasFilters ? <Search size={34} /> : <Inbox size={34} />}
              <h3>{hasFilters ? t("tasks.emptyFilteredTitle") : t("tasks.emptyTitle")}</h3>
              <p>{hasFilters ? t("tasks.emptyFilteredBody") : t("tasks.emptyBody")}</p>
              {hasFilters ? (
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  {t("tasks.clearFilters")}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <Plus size={16} />
                  {t("tasks.create")}
                </button>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="connection-error">
          <div className="connection-error-icon">
            <AlertCircle size={22} />
          </div>
          <h2>{t("tasks.loadErrorTitle")}</h2>
          <p>{listError}</p>
          <ul>
            <li>{t("tasks.loadErrorHint1")}</li>
            <li>{t("tasks.loadErrorHint2")}</li>
            {!STATIC_EXPORT && <li>{t("tasks.loadErrorHint3")}</li>}
          </ul>
          <div className="connection-error-actions">
            <button type="button" className="btn btn-secondary" onClick={onOpenSettings}>
              {t("tasks.checkSettings")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRetry}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
              {t("common.retry")}
            </button>
          </div>
        </section>
      )}

      {hasMore && (
        <div className="load-more-row">
          <button
            type="button"
            className="btn btn-secondary load-more"
            onClick={() => void loadMore()}
            disabled={loadingMore || loading}
          >
            {loadingMore ? <Loader2 size={15} className="spin" /> : <ChevronDown size={15} />}
            {loadingMore ? t("tasks.loadingMore") : t("tasks.loadMore")}
          </button>
          <span className="list-footnote">{t("tasks.listFootnote")}</span>
        </div>
      )}

      <TaskFormModal
        open={formOpen}
        config={config}
        task={editingTask}
        onClose={() => {
          setFormOpen(false);
          setEditingTask(null);
        }}
        onSaved={handleSaved}
      />

      <TaskDrawer
        open={drawerOpen}
        config={config}
        task={selectedTask}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => void refreshLoaded()}
        onEdit={openEdit}
      />

      <BulkDeleteModal
        open={deleteOpen}
        config={config}
        currentStatus={statusFilter}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => void refreshLoaded()}
      />
    </div>
  );
}
