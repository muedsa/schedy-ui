import { Eye, EyeOff, Globe2, PlugZap, ShieldCheck } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { STATIC_EXPORT } from "../lib/runtime";
import type { ConnectionMode } from "../types";

export interface ConnectionDraft {
  baseUrl: string;
  apiKey: string;
  mode: ConnectionMode;
  autoRefresh: number;
}

const AUTO_REFRESH_OPTIONS = [0, 5000, 10000, 15000, 30000, 60000];

interface ConnectionFieldsProps {
  value: ConnectionDraft;
  onChange: (next: ConnectionDraft) => void;
  showKey: boolean;
  onToggleShowKey: () => void;
  showAutoRefresh?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function ConnectionFields({
  value,
  onChange,
  showKey,
  onToggleShowKey,
  showAutoRefresh = false,
  disabled = false,
  autoFocus = false,
}: ConnectionFieldsProps) {
  const { t } = useI18n();
  const patch = (next: Partial<ConnectionDraft>) => onChange({ ...value, ...next });

  return (
    <div className="connection-fields">
      {STATIC_EXPORT ? (
        <div className="field">
          <span className="field-label">{t("connection.mode")}</span>
          <p className="hint">{t("connection.staticHint")}</p>
        </div>
      ) : (
        <div className="field">
          <span className="field-label">{t("connection.mode")}</span>
          <div className="segmented mode-segmented" role="group" aria-label={t("connection.mode")}>
            <button
              type="button"
              className={value.mode === "proxy" ? "segment active" : "segment"}
              onClick={() => patch({ mode: "proxy" })}
              disabled={disabled}
              aria-pressed={value.mode === "proxy"}
            >
              <ShieldCheck size={15} />
              {t("connection.proxy")}
              <span className="segment-badge">{t("connection.recommended")}</span>
            </button>
            <button
              type="button"
              className={value.mode === "direct" ? "segment active" : "segment"}
              onClick={() => patch({ mode: "direct" })}
              disabled={disabled}
              aria-pressed={value.mode === "direct"}
            >
              <Globe2 size={15} />
              {t("connection.direct")}
            </button>
          </div>
          <p className="hint">
            {value.mode === "proxy" ? t("connection.proxyHint") : t("connection.directHint")}
          </p>
        </div>
      )}

      <label className="field">
        <span className="field-label">{t("connection.serverUrl")}</span>
        <div className="input-with-icon">
          <PlugZap size={16} aria-hidden />
          <input
            className="input"
            type="url"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="http://127.0.0.1:8080"
            value={value.baseUrl}
            onChange={(event) => patch({ baseUrl: event.target.value })}
            disabled={disabled}
            autoFocus={autoFocus}
            required
          />
        </div>
        <span className="hint">{t("connection.serverUrlHint")}</span>
      </label>

      <label className="field">
        <span className="field-label">
          API Key <span className="label-optional">{t("common.optional")}</span>
        </span>
        <div className="input-with-action">
          <input
            className="input mono"
            type={showKey ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("connection.apiKeyPlaceholder")}
            value={value.apiKey}
            onChange={(event) => patch({ apiKey: event.target.value })}
            disabled={disabled}
          />
          <button
            type="button"
            className="input-action"
            onClick={onToggleShowKey}
            aria-label={showKey ? t("connection.hideApiKey") : t("connection.showApiKey")}
            title={showKey ? t("connection.hideApiKey") : t("connection.showApiKey")}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <span className="hint">{t("connection.apiKeyHint")}</span>
      </label>

      {showAutoRefresh && (
        <label className="field">
          <span className="field-label">{t("connection.autoRefresh")}</span>
          <select
            className="select"
            value={String(value.autoRefresh)}
            onChange={(event) => patch({ autoRefresh: Number(event.target.value) })}
            disabled={disabled}
          >
            {AUTO_REFRESH_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds === 0 ? t("connection.off") : t("connection.everySeconds", seconds / 1000)}
              </option>
            ))}
          </select>
          <span className="hint">{t("connection.autoRefreshHint")}</span>
        </label>
      )}
    </div>
  );
}
