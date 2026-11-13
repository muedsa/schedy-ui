import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleSchedyProxy } from "./server/proxy.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const distRoot = join(projectRoot, "dist");
const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = process.env.HOST || "127.0.0.1";
const proxyPrefix = "/__schedy";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".badger": "application/octet-stream",
};

try {
  const info = await stat(join(distRoot, "index.html"));
  if (!info.isFile()) throw new Error("not a file");
} catch {
  console.error("No production build found in ./dist. Run `pnpm build` first.");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  const rawUrl = req.url || "/";
  const pathname = rawUrl.split("?")[0];

  if (pathname === proxyPrefix || pathname.startsWith(`${proxyPrefix}/`)) {
    req.url = rawUrl.slice(proxyPrefix.length) || "/";
    handleSchedyProxy(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed\n");
    return;
  }

  let pathnameDecoded;
  try {
    pathnameDecoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad Request\n");
    return;
  }

  if (pathnameDecoded === "/" || pathnameDecoded === "") {
    await sendFile(res, req.method, join(distRoot, "index.html"), false);
    return;
  }

  const filePath = normalize(join(distRoot, pathnameDecoded));
  if (filePath !== distRoot && !filePath.startsWith(distRoot + sep)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden\n");
    return;
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    // Single-page app fallback.
    await sendFile(res, req.method, join(distRoot, "index.html"), false);
    return;
  }

  const immutable = pathnameDecoded.startsWith("/assets/");
  await sendFile(res, req.method, filePath, immutable);
});

async function sendFile(res, method, filePath, immutable) {
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "content-length": body.length,
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
      "x-content-type-options": "nosniff",
    });
    if (method === "HEAD") res.end();
    else res.end(body);
  } catch {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error\n");
  }
}

server.listen(port, host, () => {
  console.log(`Schedy UI listening on http://${host}:${port}`);
  console.log(`API proxy available at ${proxyPrefix}`);
});
