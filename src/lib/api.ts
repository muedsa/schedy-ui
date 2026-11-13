import type {
  BulkDeleteParams,
  BulkDeleteResponse,
  ConnectionConfig,
  HealthResponse,
  ParsedMetrics,
  Task,
  TaskListParams,
  TaskPage,
  TaskRequest,
  TaskStatus,
} from "../types";
import { normalizeBaseUrl } from "./config";
import { getActiveLocale, tGlobal, type MessageKey } from "./i18n";

const PROXY_PATH = "/__schedy";
const REQUEST_TIMEOUT_MS = 60_000;

export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const STATUS_MESSAGE_KEYS: Record<number, MessageKey> = {
  400: "api.status.400",
  401: "api.status.401",
  403: "api.status.403",
  404: "api.status.404",
  405: "api.status.405",
  409: "api.status.409",
  413: "api.status.413",
  500: "api.status.500",
  502: "api.status.502",
};

function statusMessage(status: number): string {
  const key = STATUS_MESSAGE_KEYS[status];
  return key ? tGlobal(key) : tGlobal("api.httpFailed", status);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  raw?: boolean;
}

export function buildRequestUrl(config: ConnectionConfig, path: string): string {
  if (config.mode === "proxy") {
    return `${PROXY_PATH}${path}`;
  }
  const base = normalizeBaseUrl(config.baseUrl);
  return base ? `${base}${path}` : path;
}

export function buildRequestHeaders(
  config: ConnectionConfig,
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extra,
  };
  if (config.mode === "proxy") {
    headers["X-Schedy-Target"] = normalizeBaseUrl(config.baseUrl);
    headers["X-Schedy-Locale"] = getActiveLocale();
    if (config.apiKey) headers["X-Schedy-API-Key"] = config.apiKey;
  } else if (config.apiKey) {
    headers["X-API-Key"] = config.apiKey;
  }
  return headers;
}

async function request<T>(
  config: ConnectionConfig,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = buildRequestHeaders(config, options.headers);
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    signal: options.signal ?? AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    cache: "no-store",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildRequestUrl(config, path), init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(tGlobal("api.timeout"));
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (config.mode === "proxy") {
      throw new ApiError(tGlobal("api.proxyUnreachable"));
    }
    throw new ApiError(tGlobal("api.directUnreachable"));
  }

  const contentType = response.headers.get("content-type") ?? "";
  const rawBody = await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(rawBody, contentType) || statusMessage(response.status);
    throw new ApiError(message, response.status);
  }

  if (options.raw) return rawBody as T;
  if (!rawBody) return undefined as T;

  if (!contentType.includes("application/json")) {
    const preview = rawBody
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140);
    throw new ApiError(tGlobal("api.nonJson", response.status, preview), response.status);
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody) as T;
    } catch {
      throw new ApiError(tGlobal("api.invalidJson"), response.status);
    }
  }
  return rawBody as T;
}

function extractErrorMessage(body: string, contentType: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed === "string") return parsed;
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        return String((parsed as { message: unknown }).message);
      }
    } catch {
      // Fall back to the plain body below.
    }
  }
  return trimmed;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function getHealth(config: ConnectionConfig, signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>(config, "/healthz", { signal, timeoutMs: 15_000 });
}

export async function getReadiness(
  config: ConnectionConfig,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    // /readyz has no documented response body, so do not require JSON.
    await request<string>(config, "/readyz", { signal, timeoutMs: 15_000, raw: true });
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) return false;
    throw error;
  }
}

export function getMetrics(config: ConnectionConfig, signal?: AbortSignal): Promise<string> {
  return request<string>(config, "/metrics", { signal, timeoutMs: 20_000, raw: true });
}

export function parseMetrics(raw: string): ParsedMetrics {
  const metrics: ParsedMetrics = { counts: {}, deliveries: {}, raw };
  const numberPattern = "([-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)";

  for (const line of raw.split(/\r?\n/)) {
    const taskCount = new RegExp(`^schedy_tasks\\{status="([a-z]+)"\\}\\s+${numberPattern}$`).exec(
      line,
    );
    if (taskCount) {
      metrics.counts[taskCount[1] as TaskStatus] = Number(taskCount[2]);
      continue;
    }
    const delivery = new RegExp(
      `^schedy_deliveries_total\\{result="(success|failure)"\\}\\s+${numberPattern}$`,
    ).exec(line);
    if (delivery) {
      metrics.deliveries[delivery[1] as "success" | "failure"] = Number(delivery[2]);
      continue;
    }
    const overdue = new RegExp(`^schedy_tasks_overdue\\s+${numberPattern}$`).exec(line);
    if (overdue) {
      metrics.overdue = Number(overdue[1]);
      continue;
    }
    const inflight = new RegExp(`^schedy_deliveries_inflight\\s+${numberPattern}$`).exec(line);
    if (inflight) {
      metrics.inflight = Number(inflight[1]);
    }
  }

  if (metrics.deliveries.success !== undefined || metrics.deliveries.failure !== undefined) {
    metrics.deliveries.total =
      (metrics.deliveries.success ?? 0) + (metrics.deliveries.failure ?? 0);
  }
  return metrics;
}

export function listTasks(
  config: ConnectionConfig,
  params: TaskListParams,
  signal?: AbortSignal,
): Promise<TaskPage> {
  return request<TaskPage>(config, `/tasks${query({ ...params })}`, { signal });
}

export function getTask(config: ConnectionConfig, id: string, signal?: AbortSignal): Promise<Task> {
  return request<Task>(config, `/tasks/${encodeURIComponent(id)}`, { signal });
}

export function createTask(
  config: ConnectionConfig,
  body: TaskRequest,
  idempotencyKey?: string,
  signal?: AbortSignal,
): Promise<Task> {
  const headers: Record<string, string> = {
    // Always send a key. The UI keeps it stable across retries of the same
    // submission; callers without one still get safe, unique creation.
    "Idempotency-Key": idempotencyKey?.trim() || crypto.randomUUID(),
  };
  return request<Task>(config, "/tasks", { method: "POST", body, headers, signal });
}

export function updateTask(
  config: ConnectionConfig,
  id: string,
  body: TaskRequest,
  signal?: AbortSignal,
): Promise<Task> {
  return request<Task>(config, `/tasks/${encodeURIComponent(id)}`, {
    method: "PUT",
    body,
    signal,
  });
}

export async function cancelTask(
  config: ConnectionConfig,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await request<void>(config, `/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal,
  });
}

export function replayTask(
  config: ConnectionConfig,
  id: string,
  signal?: AbortSignal,
): Promise<Task> {
  return request<Task>(config, `/tasks/${encodeURIComponent(id)}/run`, {
    method: "POST",
    signal,
  });
}

export function bulkDeleteTasks(
  config: ConnectionConfig,
  params: BulkDeleteParams,
  signal?: AbortSignal,
): Promise<BulkDeleteResponse> {
  return request<BulkDeleteResponse>(config, `/tasks${query({ ...params })}`, {
    method: "DELETE",
    signal,
  });
}

export interface DownloadResult {
  blob: Blob;
  filename: string;
}

export async function downloadBackup(
  config: ConnectionConfig,
  signal?: AbortSignal,
): Promise<DownloadResult> {
  const response = await fetch(buildRequestUrl(config, "/admin/backup"), {
    method: "GET",
    headers: buildRequestHeaders(config, { Accept: "application/octet-stream" }),
    signal: signal ?? AbortSignal.timeout(300_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      extractErrorMessage(text, response.headers.get("content-type") ?? "") ||
        statusMessage(response.status),
      response.status,
    );
  }

  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  let filename = "schedy-backup.badger";
  if (match?.[1]) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }
  return { blob: await response.blob(), filename };
}

export interface ConnectionTestResult {
  health: HealthResponse;
  authenticated: boolean;
  authError?: string;
}

/** Health is public; a follow-up request verifies the API key. */
export async function testConnection(
  config: ConnectionConfig,
  signal?: AbortSignal,
): Promise<ConnectionTestResult> {
  const health = await getHealth(config, signal);
  try {
    await listTasks(config, { limit: 1 }, signal);
    return { health, authenticated: true };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return {
        health,
        authenticated: false,
        authError: config.apiKey ? tGlobal("api.authInvalid") : tGlobal("api.authRequired"),
      };
    }
    throw error;
  }
}
