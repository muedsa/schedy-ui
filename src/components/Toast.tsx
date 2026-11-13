import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useI18n } from "../lib/i18n";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

export interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = crypto.randomUUID();
      setItems((current) => [...current.slice(-4), { id, kind, title, description }]);
      const timer = setTimeout(() => dismiss(id), kind === "error" ? 8000 : 5000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const current = timers.current;
    return () => {
      current.forEach((timer) => clearTimeout(timer));
      current.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => {
          const Icon =
            item.kind === "success" ? CheckCircle2 : item.kind === "error" ? AlertCircle : Info;
          return (
            <div
              key={item.id}
              className={`toast toast-${item.kind}`}
              role={item.kind === "error" ? "alert" : "status"}
            >
              <Icon size={18} className="toast-icon" aria-hidden />
              <div className="toast-copy">
                <div className="toast-title">{item.title}</div>
                {item.description && <div className="toast-description">{item.description}</div>}
              </div>
              <button
                type="button"
                className="toast-close"
                onClick={() => dismiss(item.id)}
                aria-label={t("common.close")}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
