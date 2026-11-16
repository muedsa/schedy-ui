# Schedy Console

English | [简体中文](./README.zh-CN.md)

A small web console for [Schedy](https://schedy.mintlify.app), the self-hosted HTTP task scheduler. Create, inspect, and clean up scheduled requests, watch health and Prometheus metrics, and download BadgerDB backups — all from the browser.

The server URL and API key are entered in the browser only. The source tree and the build output contain no credentials.

![React](https://img.shields.io/badge/React-19-149eca) ![Vite](https://img.shields.io/badge/Vite-8-646cff) ![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6) ![pnpm](https://img.shields.io/badge/pnpm-12-f69220) ![license](https://img.shields.io/badge/license-MIT-green)

## Features

- **Task list** — status, target URL, scheduled time, and attempt outcome; cursor pagination with configurable auto-refresh.
- **Filters** — status (via the stat cards), exact target URL, scheduled-time window (`due_after` / `due_before`), page size, and "Load more".
- **Create / edit tasks** — HTTP method, a one-off execution time or a recurring schedule, JSON or text payload, custom headers, retries with fixed or exponential backoff, per-attempt timeout, failure callback URL, recurrence interval, and idempotency key.
- **Task details** — full request snapshot, copyable cURL command, and an attempt timeline with response bodies.
- **Task actions** — soft-cancel a pending task, replay a finished one, or bulk-delete by filter.
- **System page** — `/healthz`, `/readyz`, `/metrics` visualisation, raw Prometheus text, delivery success rate, and an online BadgerDB backup download.
- **Interface** — light / dark theme, responsive layout, and a Chinese / English switch that also localises dates, relative times, and numbers.

## Requirements

- Node.js 20 or newer (verified on Node 24)
- pnpm (verified on pnpm 12)

```bash
pnpm install
```

## Quick start

```bash
pnpm dev
```

Open <http://127.0.0.1:5173> and fill in:

| Field             | Description                                            | Example                 |
| ----------------- | ------------------------------------------------------ | ----------------------- |
| Connection mode   | Local proxy is recommended                             | Local proxy             |
| Schedy server URL | Schedy origin; a path prefix is allowed                | `http://127.0.0.1:8080` |
| API key           | Only needed when Schedy runs with `SCHEDY_API_KEY` set | `your-api-key`          |

Click **Test connection** to verify the server and the credentials, then **Get started**.

### Interface language

The connect screen and the top bar both have a language toggle. The first visit follows the browser language (`en*` → English, everything else → Chinese); later choices are stored in `schedy-ui.locale.v1`. Dates, relative times, and numbers follow the selected language. The theme starts from the OS preference and is remembered in `schedy-ui.theme.v1`.

### Connection modes

**Local proxy (recommended)**

The browser calls the same-origin `/__schedy/*` endpoint, and the Vite dev server or the production server forwards the request to Schedy. The target origin travels in `X-Schedy-Target`, the API key in `X-Schedy-API-Key`, and the UI language in `X-Schedy-Locale` (only used to localise the proxy's own error messages). The proxy stores nothing.

Use this when Schedy has no CORS support. The page must be served by `pnpm dev`, `pnpm preview`, or `pnpm start`.

**Direct**

The browser calls Schedy directly and sends `X-API-Key`. Schedy must allow the page origin:

```bash
SCHEDY_CORS_ORIGIN=http://127.0.0.1:5173 schedy server
```

In production, use the real origin, for example `https://schedy-console.example.com`. If you cannot configure CORS on the server, use the local proxy instead.

The local proxy only exists while the page is served by `pnpm dev`, `pnpm preview`, or `pnpm start`. Static exports (`pnpm build:static`) have no proxy at all and always use direct mode; see [Static export](#static-export).

## Scheduling a task

There are two ways to set the execution time:

- **Specific time** — a one-off task; the request contains only `execute_at`.
- **Delay** — a recurring task: the chosen start time becomes `execute_at` and the delay interval becomes `schedule`. Schedy fires at the start time and, after each run, enqueues the next one at `fire_time + schedule`. The interval is a Go duration (`30m`, `2h`, `1h30m`); days entered in the UI are converted to hours (`3d` → `72h`).

Notes:

- Only `pending` tasks can be edited; saving replaces all client-owned fields.
- Cancelling the current pending task also stops the recurrence chain.
- Every new task is created with an `Idempotency-Key`; see [API behaviour notes](#api-behaviour-notes).

## Scripts

| Command             | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `pnpm dev`          | Start the dev server (includes the `/__schedy` proxy)    |
| `pnpm typecheck`    | Type-check with TypeScript                               |
| `pnpm format`       | Format source, config, and docs with Prettier            |
| `pnpm format:check` | Check Prettier formatting                                |
| `pnpm build`        | Type-check and build to `dist/`                          |
| `pnpm build:static` | Build a proxy-free bundle for static hosting             |
| `pnpm preview`      | Preview the production build (proxy included)            |
| `pnpm start`        | Start the production server (static files + proxy)       |
| `pnpm mock`         | Start the in-memory Schedy mock for safe experimentation |

## Local mock server

If no Schedy instance is available, start the bundled mock:

```bash
pnpm mock
```

It listens on `http://127.0.0.1:8080` and seeds pending, running, succeeded, failed, and cancelled tasks, plus a recurring one. Optional environment variables:

```bash
PORT=8081 MOCK_API_KEY=dev-secret pnpm mock
```

The mock keeps everything in memory (a restart resets it) and implements only the parts of the Schedy API the UI needs, not the full scheduler semantics.

## Production deployment

```bash
pnpm install
pnpm build
PORT=4173 HOST=0.0.0.0 pnpm start
```

`server.mjs`:

- serves the static assets from `dist/` and falls back to `index.html` for unknown paths (single-page app);
- mounts the `/__schedy` proxy on the same port;
- never reads or writes credentials.

Environment variables:

| Variable | Default     | Description                                               |
| -------- | ----------- | --------------------------------------------------------- |
| `PORT`   | `4173`      | Listening port                                            |
| `HOST`   | `127.0.0.1` | Listening address; set to `0.0.0.0` to expose the service |

`pnpm start` exits if `dist/index.html` is missing, so run `pnpm build` first.

Behind a reverse proxy such as Nginx or Caddy, allow long timeouts for backup downloads and slow requests (for example 5 minutes) and enable HTTPS as needed. The API key passes through the server, so keep the deployment environment trusted.

## Static export

The regular `pnpm build` output is already static files, but it keeps both connection modes and defaults to the local proxy — which only exists while `pnpm dev`, `pnpm preview`, or `pnpm start` serves the page. To host the console on a plain static file server with no Node process and no proxy, build the static export instead:

```bash
pnpm build:static
```

`dist/` then contains only HTML, CSS, and JS. Serve it from Nginx, GitHub Pages, S3, or any similar host.

- The proxy option is removed from the UI: every connection uses direct mode, so Schedy must allow the hosting origin via `SCHEDY_CORS_ORIGIN`.
- Routing uses URL hashes (`#/tasks`, `#/system`), so no SPA rewrite rules are required.
- `pnpm start` and `server.mjs` are not needed; keep them for the regular server-served build.
- To host under a subpath, build with a relative base: `pnpm build:static -- --base=./`.

## Security notes

- The server URL and API key live in the current browser's `localStorage` (`schedy-ui.connection.v1`); nothing is written to the source tree or the build output.
- Other pages and extensions in the same browser profile can read `localStorage`. Use a dedicated API key and avoid storing production credentials on shared machines.
- In direct mode the API key travels in browser request headers; in proxy mode it is forwarded by the local proxy and still never stored.
- Bulk delete is **permanent and cannot be undone**; cancelling a task is a soft cancel that keeps its history.
- The proxy issues requests to whatever target the user enters. Do not expose it to untrusted users, or it can be abused as an SSRF hop; restrict the reachable network range or add authentication in production.

## API behaviour notes

- Auth header: `X-API-Key`.
- New tasks always carry an `Idempotency-Key`: the UI generates a fresh key for every new task, so each submission creates a task. Retrying with the same key makes Schedy return the task created the first time instead of scheduling a duplicate; "Regenerate" switches to a new task identity.
- Updates use `PUT` and replace all client-owned fields; only `pending` tasks can be updated.
- `DELETE /tasks/{id}` is a soft cancel; `DELETE /tasks` requires at least one filter.
- `POST /tasks/{id}/run` only applies to finished tasks (succeeded, failed, cancelled).
- Listings are cursor-paginated; auto-refresh re-reads the loaded pages by their cursors.

API docs: <https://schedy.mintlify.app>

## Project structure

```
src/
  components/       shared components, task form, drawer, modals
  hooks/            hash routing, theme, body scroll lock
  lib/api.ts        Schedy API client
  lib/config.ts     connection config and validation
  lib/i18n.tsx      Chinese/English messages, locale state, helpers
  lib/format.ts     date, number, and duration formatting
  lib/runtime.ts    build-mode flags (static export)
  pages/            tasks, system, and connect screens
  styles.css        design tokens and responsive styles
server/
  proxy.mjs         same-origin reverse proxy
server.mjs          production static server + proxy
mock/server.mjs     in-memory Schedy mock
vite.config.ts      dev/preview servers and the proxy plugin
README.md           this file (English)
README.zh-CN.md     Chinese README
```

## Notes

This project is an independent community console, not an official Schedy project. The UI ships with Chinese and English text and shows all times in the browser's time zone.
