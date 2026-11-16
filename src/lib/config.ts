import type { ConnectionConfig, ConnectionMode } from "../types";
import { STATIC_EXPORT } from "./runtime";

const STORAGE_KEY = "schedy-ui.connection.v1";
const THEME_KEY = "schedy-ui.theme.v1";

export const DEFAULT_AUTO_REFRESH = 15_000;

/** Static exports have no proxy endpoint, so they can only connect directly. */
export const DEFAULT_CONNECTION_MODE: ConnectionMode = STATIC_EXPORT ? "direct" : "proxy";

export function loadConnection(): ConnectionConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConnectionConfig>;
    if (typeof parsed.baseUrl !== "string" || !parsed.baseUrl.trim()) return null;
    // A connection saved by a proxied build must not break a static export.
    const mode: ConnectionMode = STATIC_EXPORT || parsed.mode === "direct" ? "direct" : "proxy";
    return {
      baseUrl: parsed.baseUrl.trim(),
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      mode,
      autoRefresh:
        typeof parsed.autoRefresh === "number" && Number.isFinite(parsed.autoRefresh)
          ? Math.max(0, parsed.autoRefresh)
          : DEFAULT_AUTO_REFRESH,
    };
  } catch {
    return null;
  }
}

export function saveConnection(config: ConnectionConfig): void {
  const mode: ConnectionMode = STATIC_EXPORT ? "direct" : config.mode;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, mode }));
}

export function clearConnection(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export type ThemePreference = "light" | "dark";

export function loadTheme(): ThemePreference {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme: ThemePreference): void {
  localStorage.setItem(THEME_KEY, theme);
}

export type BaseUrlError =
  "required" | "query" | "proxyProtocol" | "proxyInvalid" | "directProtocol" | "directInvalid";

/** Returns a stable error code when the server URL cannot be used. */
export function validateBaseUrl(baseUrl: string, mode: ConnectionMode): BaseUrlError | null {
  const value = baseUrl.trim();
  if (!value) return "required";
  if (value.includes("?") || value.includes("#")) return "query";
  if (mode === "proxy") {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "proxyProtocol";
      }
    } catch {
      return "proxyInvalid";
    }
    return null;
  }
  if (value.startsWith("/")) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "directProtocol";
    }
  } catch {
    return "directInvalid";
  }
  return null;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function serverLabel(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
