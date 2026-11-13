import type { Task } from "../types";
import { getActiveLocale, localeTag, tGlobal } from "./i18n";

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

function dateFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = getActiveLocale();
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(localeTag(locale), options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

function relativeFormatter(): Intl.RelativeTimeFormat {
  const locale = getActiveLocale();
  let formatter = relativeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
    relativeFormatters.set(locale, formatter);
  }
  return formatter;
}

export function formatNumber(value: number): string {
  return value.toLocaleString(localeTag(getActiveLocale()));
}

export function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return dateFormatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatCompactDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return dateFormatter({
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  }
  return dateFormatter({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const formatter = relativeFormatter();

  if (abs < 60_000) {
    return formatter.format(Math.round(diffMs / 1000), "second");
  }
  if (abs < 3_600_000) {
    return formatter.format(Math.round(diffMs / 60_000), "minute");
  }
  if (abs < 86_400_000) {
    return formatter.format(Math.round(diffMs / 3_600_000), "hour");
  }
  if (abs < 2_592_000_000) {
    return formatter.format(Math.round(diffMs / 86_400_000), "day");
  }
  return formatter.format(Math.round(diffMs / 2_592_000_000), "month");
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return toLocalDateTimeInput(date);
}

export function toLocalDateTimeInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function dateTimeInputToIso(value: string): string {
  return new Date(value).toISOString();
}

export function defaultExecuteAt(minutesAhead = 5): string {
  const date = new Date(Date.now() + minutesAhead * 60_000);
  date.setSeconds(0, 0);
  return toLocalDateTimeInput(date);
}

export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
}

const GO_DURATION_PART = /(\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g;

export type GoDurationError = "required" | "format" | "positive";

/**
 * Validates a Go duration string such as "15m", "2h", "1h30m".
 * Returns an error code, or null when valid and positive.
 */
export function validateGoDuration(value: string): GoDurationError | null {
  const trimmed = value.trim();
  if (!trimmed) return "required";
  if (!/^(\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h))+$/.test(trimmed)) {
    return "format";
  }
  GO_DURATION_PART.lastIndex = 0;
  let totalSeconds = 0;
  for (const match of trimmed.matchAll(GO_DURATION_PART)) {
    const valueNumber = Number.parseFloat(match[1]);
    const unit = match[2];
    const secondsPerUnit: Record<string, number> = {
      ns: 1e-9,
      us: 1e-6,
      µs: 1e-6,
      ms: 1e-3,
      s: 1,
      m: 60,
      h: 3600,
    };
    totalSeconds += valueNumber * (secondsPerUnit[unit] ?? 0);
  }
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "positive";
  }
  return null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

export function buildCurl(task: Task): string {
  const lines = [`curl -X ${task.method} '${escapeSingleQuotes(task.url)}'`];
  for (const [key, value] of Object.entries(task.headers ?? {})) {
    lines.push(`  -H '${escapeSingleQuotes(key)}: ${escapeSingleQuotes(value)}'`);
  }
  const hasBody =
    task.payload !== undefined &&
    task.payload !== null &&
    task.method !== "GET" &&
    task.method !== "HEAD";
  if (hasBody) {
    const body =
      typeof task.payload === "string" ? task.payload : JSON.stringify(task.payload, null, 2);
    lines.push(`  --data-raw '${escapeSingleQuotes(body)}'`);
  }
  return lines.join(" \\\n");
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function maskKey(key: string): string {
  if (!key) return tGlobal("common.notConfigured");
  if (key.length <= 6) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-3)}`;
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}
