import type { HttpMethod, TaskStatus } from "../types";
import { useI18n } from "../lib/i18n";

export function StatusBadge({ status, subtle = false }: { status: TaskStatus; subtle?: boolean }) {
  const { statusLabel } = useI18n();
  return (
    <span className={`status-badge status-${status} ${subtle ? "is-subtle" : ""}`}>
      <span className="status-dot" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}

export function MethodBadge({ method }: { method: HttpMethod }) {
  return <span className={`method-badge method-${method.toLowerCase()}`}>{method}</span>;
}

export function CodeBadge({ code }: { code: number }) {
  const tone = code === 0 ? "code-error" : code >= 200 && code < 300 ? "code-ok" : "code-error";
  return <span className={`code-badge ${tone}`}>{code === 0 ? "ERR" : code}</span>;
}
