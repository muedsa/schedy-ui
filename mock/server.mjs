/**
 * Tiny in-memory Schedy lookalike for local UI development.
 * Run with: pnpm mock
 * Optional: MOCK_API_KEY=secret PORT=8080 pnpm mock
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const apiKey = process.env.MOCK_API_KEY || "";
const tasks = new Map();

let deliverySuccess = 42;
let deliveryFailure = 5;

const SECOND = 1000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function iso(offsetMs) {
  return new Date(Date.now() + offsetMs).toISOString();
}

function attempt(n, firedAt, statusCode, durationMs, error, responseBody) {
  const item = { n, fired_at: firedAt, status_code: statusCode, duration_ms: durationMs };
  if (error) item.error = error;
  if (responseBody) item.response_body = responseBody;
  return item;
}

function addTask(input) {
  const task = {
    id: randomUUID(),
    url: input.url,
    method: input.method || "POST",
    execute_at: input.execute_at,
    payload: input.payload,
    retries: input.retries ?? 0,
    retry_interval: input.retry_interval ?? 2000,
    retry_mode: input.retry_mode || "fixed",
    status: input.status || "pending",
    headers: input.headers,
    ...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
    ...(input.schedule ? { schedule: input.schedule } : {}),
    ...(input.timeout_ms ? { timeout_ms: input.timeout_ms } : {}),
    ...(input.on_failure_url ? { on_failure_url: input.on_failure_url } : {}),
    ...(input.attempts ? { attempts: input.attempts } : {}),
    ...(input.finished_at ? { finished_at: input.finished_at } : {}),
  };
  tasks.set(task.id, task);
  return task;
}

function seed() {
  addTask({
    url: "https://api.example.com/webhooks/daily-sync",
    execute_at: iso(4 * MINUTE),
    headers: { "Content-Type": "application/json", "X-Source": "schedy-console" },
    payload: { event: "daily.sync", page: 12 },
    schedule: "24h",
    retries: 2,
  });
  addTask({
    url: "https://api.example.com/webhooks/reminder?user=42",
    execute_at: iso(12 * MINUTE),
    headers: { Authorization: "Bearer demo-token", "Content-Type": "application/json" },
    payload: { message: "Time to stand up", user_id: 42 },
    retries: 3,
    retry_interval: 5000,
    retry_mode: "exponential",
    timeout_ms: 15000,
  });
  addTask({
    url: "https://hooks.example.com/health-ping",
    execute_at: iso(25 * SECOND),
    method: "GET",
  });
  addTask({
    url: "https://api.example.com/reports/nightly",
    execute_at: iso(-2 * HOUR),
    status: "succeeded",
    finished_at: iso(-2 * HOUR + 1400),
    headers: { "Content-Type": "application/json" },
    payload: { report: "nightly", date: "2026-11-13" },
    retries: 2,
    attempts: [attempt(1, iso(-2 * HOUR), 200, 138)],
  });
  addTask({
    url: "https://api.example.com/webhooks/reminder?user=7",
    execute_at: iso(-50 * MINUTE),
    status: "failed",
    finished_at: iso(-49 * MINUTE),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    payload: { message: "Retry me" },
    retries: 2,
    retry_interval: 3000,
    retry_mode: "exponential",
    attempts: [
      attempt(1, iso(-50 * MINUTE), 500, 42, "unexpected status 500", '{"error":"internal"}'),
      attempt(2, iso(-49 * MINUTE), 502, 67, "bad gateway", "<html>502 Bad Gateway</html>"),
    ],
  });
  addTask({
    url: "https://api.example.com/webhooks/cancelled",
    execute_at: iso(-3 * DAY),
    status: "cancelled",
    finished_at: iso(-3 * DAY),
    retries: 0,
  });
  addTask({
    url: "https://api.example.com/webhooks/running-now",
    execute_at: iso(-5 * SECOND),
    status: "running",
    retries: 1,
  });
  addTask({
    url: "https://events.example.com/ingest",
    execute_at: iso(-6 * HOUR),
    status: "succeeded",
    finished_at: iso(-6 * HOUR + 210),
    headers: { "Content-Type": "application/json" },
    payload: { events: 120 },
    attempts: [attempt(1, iso(-6 * HOUR), 201, 210)],
  });
  for (let index = 1; index <= 14; index += 1) {
    addTask({
      url: `https://api.example.com/webhooks/bulk-${index}`,
      execute_at: iso(-(index + 1) * HOUR),
      status: index % 4 === 0 ? "failed" : "succeeded",
      finished_at: iso(-(index + 1) * HOUR + 90),
      method: index % 3 === 0 ? "PUT" : "POST",
      payload: { index },
      attempts: [
        attempt(
          1,
          iso(-(index + 1) * HOUR),
          index % 4 === 0 ? 503 : 200,
          80 + index,
          index % 4 === 0 ? "service unavailable" : undefined,
        ),
      ],
    });
  }
}
seed();

function parseGoDuration(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const regex = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;
  let total = 0;
  let matched = false;
  for (const match of value.matchAll(regex)) {
    matched = true;
    const amount = Number.parseFloat(match[1]);
    const unit = match[2];
    const seconds = { ns: 1e-9, us: 1e-6, µs: 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600 }[unit];
    total += amount * seconds;
  }
  if (!matched || !/^(\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+$/.test(value)) return null;
  return total * 1000;
}

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(payload);
}

function text(res, status, body) {
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(`${body}\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_048_576) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function taskShape(body, existing) {
  const method = String(body.method || "POST").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(method)) {
    return { error: "invalid method" };
  }
  if (typeof body.url !== "string" || !body.url.trim()) return { error: "url is required" };
  try {
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) return { error: "url must be http(s)" };
  } catch {
    return { error: "url must be an absolute URL" };
  }

  let executeAt;
  if (typeof body.execute_at === "string" && body.execute_at) {
    const date = new Date(body.execute_at);
    if (Number.isNaN(date.getTime())) return { error: "invalid execute_at" };
    if (date.getTime() <= Date.now()) return { error: "execute_at must be in the future" };
    executeAt = date.toISOString();
  } else if (typeof body.execute_in === "string" && body.execute_in) {
    const duration = parseGoDuration(body.execute_in);
    if (!duration || duration <= 0) return { error: "invalid execute_in" };
    executeAt = iso(duration);
  } else {
    return { error: "execute_at or execute_in is required" };
  }

  if (body.retries !== undefined && (!Number.isInteger(body.retries) || body.retries < 0)) {
    return { error: "retries must be a non-negative integer" };
  }
  if (
    body.retry_interval !== undefined &&
    (!Number.isInteger(body.retry_interval) || body.retry_interval < 0)
  ) {
    return { error: "retry_interval must be a non-negative integer" };
  }
  if (body.retry_mode && !["fixed", "exponential"].includes(body.retry_mode)) {
    return { error: "invalid retry_mode" };
  }
  if (body.schedule !== undefined && body.schedule !== "") {
    const duration = parseGoDuration(body.schedule);
    if (!duration || duration <= 0) return { error: "invalid schedule" };
  }
  if (body.timeout_ms !== undefined) {
    if (!Number.isInteger(body.timeout_ms) || body.timeout_ms < 0 || body.timeout_ms > 300000) {
      return { error: "invalid timeout_ms" };
    }
  }
  if (body.headers !== undefined) {
    if (
      !body.headers ||
      typeof body.headers !== "object" ||
      Array.isArray(body.headers) ||
      Object.values(body.headers).some((value) => typeof value !== "string")
    ) {
      return { error: "headers must be an object of strings" };
    }
  }
  if (body.on_failure_url) {
    try {
      const parsed = new URL(body.on_failure_url);
      if (!["http:", "https:"].includes(parsed.protocol))
        return { error: "invalid on_failure_url" };
    } catch {
      return { error: "invalid on_failure_url" };
    }
  }

  return {
    value: {
      url: body.url.trim(),
      method,
      execute_at: executeAt,
      payload: body.payload,
      retries: body.retries ?? 0,
      retry_interval: body.retry_interval ?? 2000,
      retry_mode: body.retry_mode || "fixed",
      headers: body.headers,
      schedule: body.schedule || undefined,
      timeout_ms: body.timeout_ms || undefined,
      on_failure_url: body.on_failure_url || undefined,
      ...(existing ? {} : {}),
    },
  };
}

function matches(task, filters) {
  if (filters.status && task.status !== filters.status) return false;
  if (filters.url && task.url !== filters.url) return false;
  if (filters.due_before && !(new Date(task.execute_at) < new Date(filters.due_before)))
    return false;
  if (filters.due_after && !(new Date(task.execute_at) > new Date(filters.due_after))) return false;
  if (filters.before && !(new Date(task.execute_at) < new Date(filters.before))) return false;
  if (filters.after && !(new Date(task.execute_at) > new Date(filters.after))) return false;
  return true;
}

function metricsText() {
  const counts = { pending: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 };
  let overdue = 0;
  for (const task of tasks.values()) {
    counts[task.status] = (counts[task.status] || 0) + 1;
    if (task.status === "pending" && new Date(task.execute_at).getTime() < Date.now()) overdue += 1;
  }
  const attempts = [...tasks.values()].flatMap((task) => task.attempts ?? []);
  const successAttempts = attempts.filter(
    (item) => item.status_code >= 200 && item.status_code < 300,
  ).length;
  const failureAttempts = attempts.length - successAttempts;
  return [
    "# HELP schedy_tasks Tasks currently in each lifecycle status.",
    "# TYPE schedy_tasks gauge",
    ...Object.entries(counts).map(([status, count]) => `schedy_tasks{status="${status}"} ${count}`),
    "# HELP schedy_tasks_overdue Pending tasks whose execute_at has already passed.",
    "# TYPE schedy_tasks_overdue gauge",
    `schedy_tasks_overdue ${overdue}`,
    "# HELP schedy_deliveries_total Delivery requests fired at task targets, by outcome.",
    "# TYPE schedy_deliveries_total counter",
    `schedy_deliveries_total{result="success"} ${deliverySuccess + successAttempts}`,
    `schedy_deliveries_total{result="failure"} ${deliveryFailure + failureAttempts}`,
    "# HELP schedy_deliveries_inflight Deliveries currently executing.",
    "# TYPE schedy_deliveries_inflight gauge",
    "schedy_deliveries_inflight 0",
    "",
  ].join("\n");
}

function enqueueRecurring(task) {
  if (!task.schedule) return;
  const interval = parseGoDuration(task.schedule);
  if (!interval) return;
  const next = addTask({
    url: task.url,
    method: task.method,
    execute_at: iso(interval),
    headers: task.headers,
    payload: task.payload,
    retries: task.retries,
    retry_interval: task.retry_interval,
    retry_mode: task.retry_mode,
    schedule: task.schedule,
    timeout_ms: task.timeout_ms,
    on_failure_url: task.on_failure_url,
  });
  console.log(`recurring: scheduled ${next.id} at ${next.execute_at}`);
}

setInterval(() => {
  for (const task of tasks.values()) {
    if (task.status !== "pending") continue;
    if (new Date(task.execute_at).getTime() > Date.now()) continue;
    task.status = "running";
    setTimeout(() => {
      const firedAt = new Date().toISOString();
      const ok = Math.random() > 0.12;
      task.attempts = [
        ...(task.attempts ?? []),
        attempt(
          (task.attempts?.length ?? 0) + 1,
          firedAt,
          ok ? 200 : 500,
          40 + Math.round(Math.random() * 160),
          ok ? undefined : "unexpected status 500",
        ),
      ];
      task.status = ok ? "succeeded" : "failed";
      task.finished_at = new Date().toISOString();
      if (ok) enqueueRecurring(task);
      console.log(`fired: ${task.id} -> ${task.status}`);
    }, 600);
  }
}, 1000).unref();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = url.pathname;

  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS");
  res.setHeader("access-control-allow-headers", "Content-Type, X-API-Key, Idempotency-Key");
  res.setHeader("access-control-max-age", "600");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path !== "/healthz" && path !== "/readyz" && apiKey) {
    const provided = req.headers["x-api-key"];
    if (!provided) {
      text(res, 401, "missing API key");
      return;
    }
    if (provided !== apiKey) {
      text(res, 403, "invalid API key");
      return;
    }
  }

  try {
    if (req.method === "GET" && path === "/healthz") {
      json(res, 200, { status: "ok", version: "mock-1.0" });
      return;
    }
    if (req.method === "GET" && path === "/readyz") {
      text(res, 200, "ready");
      return;
    }
    if (req.method === "GET" && path === "/metrics") {
      res.writeHead(200, {
        "content-type": "text/plain; version=0.0.4",
        "cache-control": "no-store",
      });
      res.end(metricsText());
      return;
    }
    if (req.method === "GET" && path === "/admin/backup") {
      const body = Buffer.from("SCHEDY-MOCK-BACKUP\n".repeat(64));
      res.writeHead(200, {
        "content-type": "application/octet-stream",
        "content-length": body.length,
        "content-disposition": 'attachment; filename="schedy-backup.badger"',
      });
      res.end(body);
      return;
    }

    if (path === "/tasks" && req.method === "GET") {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 100)));
      const filters = {
        status: url.searchParams.get("status") || undefined,
        url: url.searchParams.get("url") || undefined,
        due_before: url.searchParams.get("due_before") || undefined,
        due_after: url.searchParams.get("due_after") || undefined,
      };
      if (
        filters.status &&
        !["pending", "running", "succeeded", "failed", "cancelled"].includes(filters.status)
      ) {
        text(res, 400, "invalid status");
        return;
      }
      const cursorRaw = url.searchParams.get("cursor");
      let offset = 0;
      if (cursorRaw) {
        try {
          const cursor = JSON.parse(Buffer.from(cursorRaw, "base64url").toString("utf8"));
          if ((cursor.status ?? null) !== (filters.status ?? null)) {
            text(res, 400, "cursor does not match status filter");
            return;
          }
          offset = Number(cursor.offset) || 0;
        } catch {
          text(res, 400, "invalid cursor");
          return;
        }
      }
      const matching = [...tasks.values()]
        .filter((task) => matches(task, filters))
        .sort(
          (a, b) => new Date(a.execute_at) - new Date(b.execute_at) || a.id.localeCompare(b.id),
        );
      const page = matching.slice(offset, offset + limit);
      const hasMore = offset + page.length < matching.length;
      json(res, 200, {
        tasks: page.map((task) => ({ ...task, attempts: task.attempts })),
        ...(hasMore
          ? {
              next_cursor: Buffer.from(
                JSON.stringify({ offset: offset + page.length, status: filters.status ?? null }),
              ).toString("base64url"),
            }
          : {}),
        has_more: hasMore,
      });
      return;
    }

    if (path === "/tasks" && req.method === "POST") {
      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        text(res, 400, "invalid JSON body");
        return;
      }
      const key = req.headers["idempotency-key"];
      if (key) {
        const existing = [...tasks.values()].find((task) => task.idempotency_key === key);
        if (existing) {
          json(res, 200, existing);
          return;
        }
      }
      const shaped = taskShape(body);
      if (shaped.error) {
        text(res, 400, shaped.error);
        return;
      }
      const duplicate = [...tasks.values()].find(
        (task) =>
          task.status === "pending" &&
          task.url === shaped.value.url &&
          Math.abs(
            new Date(task.execute_at).getTime() - new Date(shaped.value.execute_at).getTime(),
          ) <= 1000,
      );
      if (!key && duplicate) {
        json(res, 200, duplicate);
        return;
      }
      const task = addTask({ ...shaped.value, idempotency_key: key || undefined });
      json(res, 201, task);
      return;
    }

    if (path === "/tasks" && req.method === "DELETE") {
      const filters = {
        status: url.searchParams.get("status") || undefined,
        url: url.searchParams.get("url") || undefined,
        before: url.searchParams.get("before") || undefined,
        after: url.searchParams.get("after") || undefined,
      };
      if (!filters.status && !filters.url && !filters.before && !filters.after) {
        text(res, 400, "at least one filter is required");
        return;
      }
      let deleted = 0;
      for (const [id, task] of [...tasks.entries()]) {
        if (!matches(task, filters)) continue;
        tasks.delete(id);
        deleted += 1;
      }
      json(res, 200, { deleted });
      return;
    }

    const match = /^\/tasks\/([^/]+)(\/run)?$/.exec(path);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const replay = Boolean(match[2]);
      const task = tasks.get(id);
      if (!task) {
        text(res, 404, "task not found");
        return;
      }
      if (replay && req.method === "POST") {
        if (!["succeeded", "failed", "cancelled"].includes(task.status)) {
          text(res, 409, "only terminal tasks can be replayed");
          return;
        }
        task.status = "pending";
        task.execute_at = new Date().toISOString();
        task.finished_at = null;
        json(res, 200, task);
        return;
      }
      if (req.method === "GET") {
        json(res, 200, task);
        return;
      }
      if (req.method === "PUT") {
        if (task.status !== "pending") {
          text(res, 409, "only pending tasks can be updated");
          return;
        }
        const raw = await readBody(req);
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          text(res, 400, "invalid JSON body");
          return;
        }
        const shaped = taskShape(body, true);
        if (shaped.error) {
          text(res, 400, shaped.error);
          return;
        }
        Object.assign(task, shaped.value);
        json(res, 200, task);
        return;
      }
      if (req.method === "DELETE") {
        if (["pending", "running"].includes(task.status)) {
          task.status = "cancelled";
          task.finished_at = new Date().toISOString();
        }
        res.writeHead(204);
        res.end();
        return;
      }
    }

    text(res, 404, "not found");
  } catch (error) {
    console.error(error);
    text(res, 500, "internal error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Schedy mock listening on http://127.0.0.1:${port}`);
  console.log(apiKey ? "API key required: MOCK_API_KEY is set" : "API key disabled");
});
