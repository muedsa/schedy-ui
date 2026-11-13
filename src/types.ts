export const TASK_STATUSES = ["pending", "running", "succeeded", "failed", "cancelled"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const RETRY_MODES = ["fixed", "exponential"] as const;
export type RetryMode = (typeof RETRY_MODES)[number];

export interface Attempt {
  n: number;
  fired_at: string;
  status_code: number;
  error?: string;
  duration_ms: number;
  response_body?: string;
  response_body_truncated?: boolean;
}

export interface Task {
  id: string;
  idempotency_key?: string;
  url: string;
  execute_at: string;
  payload?: unknown;
  retries: number;
  retry_interval: number;
  timeout_ms?: number;
  on_failure_url?: string;
  schedule?: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  retry_mode: RetryMode;
  status: TaskStatus;
  finished_at?: string | null;
  attempts?: Attempt[];
}

export interface TaskPage {
  tasks: Task[];
  next_cursor?: string;
  has_more: boolean;
}

export interface TaskRequest {
  url: string;
  execute_at?: string;
  execute_in?: string;
  payload?: unknown;
  retries?: number;
  retry_interval?: number;
  timeout_ms?: number;
  on_failure_url?: string;
  schedule?: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  retry_mode?: RetryMode;
}

export interface TaskListParams {
  status?: TaskStatus;
  url?: string;
  due_before?: string;
  due_after?: string;
  limit?: number;
  cursor?: string;
}

export interface BulkDeleteParams {
  url?: string;
  status?: TaskStatus;
  before?: string;
  after?: string;
}

export interface BulkDeleteResponse {
  deleted: number;
}

export interface HealthResponse {
  status: string;
  version: string;
}

export type ConnectionMode = "proxy" | "direct";

export interface ConnectionConfig {
  /** Schedy server origin, e.g. https://schedy.example.com */
  baseUrl: string;
  /** Sent as X-API-Key. Never bundled with the UI. */
  apiKey: string;
  /** proxy: same-origin /__schedy proxy; direct: browser talks to Schedy. */
  mode: ConnectionMode;
  /** Auto-refresh interval in milliseconds; 0 disables it. */
  autoRefresh: number;
}

export interface ParsedMetrics {
  counts: Partial<Record<TaskStatus, number>>;
  overdue?: number;
  deliveries: {
    success?: number;
    failure?: number;
    total?: number;
  };
  inflight?: number;
  raw: string;
}
