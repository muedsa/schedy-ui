import http from "node:http";
import https from "node:https";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const FORWARDED_REQUEST_HEADERS = ["accept", "content-type", "content-length", "idempotency-key"];

const PROXY_MESSAGES = {
  zh: {
    missingTarget: "缺少 X-Schedy-Target 请求头，请先在界面中填写 Schedy 服务地址。",
    invalidTarget: "填写的 Schedy 服务地址不是有效的绝对 URL。",
    protocol: "Schedy 服务地址仅支持 http 或 https。",
    credentials: "暂不支持在服务地址中携带用户名或密码。",
    buildUrl: "无法为当前的 Schedy 服务地址构建请求 URL。",
    timeout: "Schedy 服务在 120 秒内没有响应。",
    unreachable: (origin, detail) => `无法连接 Schedy 服务（${origin}）：${detail}`,
  },
  en: {
    missingTarget:
      "Missing the X-Schedy-Target header. Enter the Schedy server URL in the UI first.",
    invalidTarget: "The Schedy server URL is not a valid absolute URL.",
    protocol: "The Schedy server URL must use http or https.",
    credentials: "Credentials in the server URL are not supported.",
    buildUrl: "Could not build a request URL for the current Schedy server URL.",
    timeout: "The Schedy server did not respond within 120 seconds.",
    unreachable: (origin, detail) => `Could not reach the Schedy server (${origin}): ${detail}`,
  },
};

function proxyMessages(req) {
  const selected = firstHeader(req.headers["x-schedy-locale"]).toLowerCase();
  if (selected.startsWith("en")) return PROXY_MESSAGES.en;
  if (selected.startsWith("zh")) return PROXY_MESSAGES.zh;
  const acceptLanguage = firstHeader(req.headers["accept-language"]).toLowerCase();
  return acceptLanguage.startsWith("en") ? PROXY_MESSAGES.en : PROXY_MESSAGES.zh;
}

/**
 * Small same-origin reverse proxy for the Schedy API.
 *
 * The browser sends the user-configured target in `X-Schedy-Target` and the
 * API key in `X-Schedy-API-Key`; neither value is stored on the server.
 * Point the UI at this endpoint when the Schedy server has CORS disabled.
 */
export function handleSchedyProxy(req, res) {
  const messages = proxyMessages(req);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      "access-control-allow-headers":
        "Content-Type, Accept, Idempotency-Key, X-Schedy-Target, X-Schedy-API-Key, X-Schedy-Locale, X-API-Key",
      "access-control-max-age": "600",
    });
    res.end();
    return;
  }

  const rawTarget = firstHeader(req.headers["x-schedy-target"]);
  if (!rawTarget) {
    sendError(res, 400, messages.missingTarget);
    return;
  }

  let base;
  try {
    base = new URL(rawTarget);
  } catch {
    sendError(res, 400, messages.invalidTarget);
    return;
  }

  if (base.protocol !== "http:" && base.protocol !== "https:") {
    sendError(res, 400, messages.protocol);
    return;
  }
  if (base.username || base.password) {
    sendError(res, 400, messages.credentials);
    return;
  }

  base.search = "";
  base.hash = "";
  const basePath = base.pathname.replace(/\/+$/, "");

  // req.url is relative to the proxy mount point. Strip the prefix defensively
  // so the same handler works from Vite middleware and the production server.
  let apiPath = req.url || "/";
  apiPath = apiPath.replace(/^\/__schedy(?=\/|\?|$)/, "");
  if (!apiPath.startsWith("/")) apiPath = `/${apiPath}`;
  if (apiPath.startsWith("//")) apiPath = `/${apiPath.replace(/^\/+/, "")}`;

  let targetUrl;
  try {
    targetUrl = new URL(`${base.origin}${basePath}${apiPath}`);
  } catch {
    sendError(res, 400, messages.buildUrl);
    return;
  }

  const headers = { "user-agent": "schedy-ui-proxy/1.0" };
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers[name];
    if (value !== undefined) headers[name] = value;
  }

  const apiKey = firstHeader(req.headers["x-schedy-api-key"]);
  if (apiKey) headers["x-api-key"] = apiKey;

  const transport = targetUrl.protocol === "https:" ? https : http;
  const proxyReq = transport.request(
    targetUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      const responseHeaders = {};
      for (const [name, value] of Object.entries(proxyRes.headers)) {
        if (value === undefined) continue;
        if (HOP_BY_HOP.has(name)) continue;
        responseHeaders[name] = value;
      }
      responseHeaders["cache-control"] = "no-store";
      responseHeaders["x-schedy-proxy"] = "1";

      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.statusMessage, responseHeaders);
      proxyRes.pipe(res);
    },
  );

  proxyReq.setTimeout(120_000, () => {
    proxyReq.destroy(new Error(messages.timeout));
  });

  proxyReq.on("error", (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    sendError(res, 502, messages.unreachable(base.origin, error.message));
  });

  req.on("aborted", () => proxyReq.destroy());
  req.pipe(proxyReq);
}

function firstHeader(value) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return typeof value === "string" ? value.trim() : "";
}

function sendError(res, status, message) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-schedy-proxy": "1",
  });
  res.end(`${message}\n`);
}
