import { CalendarClock } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Schedy Console">
      <span className="brand-mark">
        <CalendarClock size={compact ? 18 : 20} strokeWidth={2.1} />
      </span>
      <span className="brand-copy">
        <span className="brand-name">schedy</span>
        {!compact && <span className="brand-suffix">console</span>}
      </span>
    </div>
  );
}
