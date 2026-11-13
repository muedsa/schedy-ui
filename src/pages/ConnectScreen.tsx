import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Loader2, Moon, Sun } from "lucide-react";
import { Brand } from "../components/Brand";
import { ConnectionFields, type ConnectionDraft } from "../components/ConnectionFields";
import { ApiError, testConnection } from "../lib/api";
import {
  DEFAULT_AUTO_REFRESH,
  saveConnection,
  validateBaseUrl,
  type BaseUrlError,
} from "../lib/config";
import { useI18n } from "../lib/i18n";
import type { ConnectionConfig } from "../types";

interface ConnectScreenProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onConnected: (config: ConnectionConfig) => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

export function ConnectScreen({ theme, onToggleTheme, onConnected }: ConnectScreenProps) {
  const { t, toggleLocale, baseUrlError } = useI18n();
  const [draft, setDraft] = useState<ConnectionDraft>({
    baseUrl: "",
    apiKey: "",
    mode: "proxy",
    autoRefresh: DEFAULT_AUTO_REFRESH,
  });
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [formError, setFormError] = useState<BaseUrlError | null>(null);

  const validate = (): ConnectionConfig | null => {
    const baseUrl = draft.baseUrl.trim();
    const error = validateBaseUrl(baseUrl, draft.mode);
    if (error) {
      setFormError(error);
      return null;
    }
    setFormError(null);
    return {
      baseUrl,
      apiKey: draft.apiKey.trim(),
      mode: draft.mode,
      autoRefresh: draft.autoRefresh,
    };
  };

  const handleTest = async () => {
    const config = validate();
    if (!config) return;
    setTesting(true);
    setTestState({ kind: "idle" });
    try {
      const result = await testConnection(config, AbortSignal.timeout(20_000));
      if (result.authenticated) {
        setTestState({
          kind: "success",
          message: t("connect.testSuccess", result.health.version || t("common.unknown")),
        });
      } else {
        setTestState({
          kind: "warning",
          message: t(
            "connect.testWarning",
            result.health.version || t("common.unknown"),
            result.authError ?? t("connect.testFailed"),
          ),
        });
      }
    } catch (error) {
      setTestState({
        kind: "error",
        message: error instanceof ApiError ? error.message : t("connect.testFailed"),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = () => {
    const config = validate();
    if (!config) return;
    saveConnection(config);
    onConnected(config);
  };

  return (
    <div className="connect-page">
      <div className="connect-backdrop" aria-hidden />
      <div className="connect-topbar">
        <Brand />
        <div className="connect-topbar-actions">
          <button
            type="button"
            className="lang-toggle"
            onClick={toggleLocale}
            aria-label={t("header.switchLanguage")}
            title={t("header.switchLanguage")}
          >
            {t("header.languageLabel")}
          </button>
          <button
            type="button"
            className="icon-btn subtle"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? t("header.switchToLight") : t("header.switchToDark")}
            title={theme === "dark" ? t("header.switchToLight") : t("header.switchToDark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <div className="connect-layout">
        <section className="connect-intro">
          <div className="eyebrow">
            <span className="pulse-dot" />
            {t("connect.eyebrow")}
          </div>
          <h1>
            {t("connect.titleLead")}
            <br />
            <span className="gradient-text">{t("connect.titleAccent")}</span>
          </h1>
          <p className="connect-lead">{t("connect.lead")}</p>
          <ul className="connect-points">
            <li>
              <CheckCircle2 size={16} />
              {t("connect.point1")}
            </li>
            <li>
              <CheckCircle2 size={16} />
              {t("connect.point2")}
            </li>
            <li>
              <CheckCircle2 size={16} />
              {t("connect.point3")}
            </li>
          </ul>
        </section>

        <section className="connect-card">
          <div className="connect-card-head">
            <div className="connect-card-icon">
              <KeyRound size={20} />
            </div>
            <div>
              <h2>{t("connect.heading")}</h2>
              <p>{t("connect.subheading")}</p>
            </div>
          </div>

          <ConnectionFields
            value={draft}
            onChange={setDraft}
            showKey={showKey}
            onToggleShowKey={() => setShowKey((current) => !current)}
            autoFocus
            disabled={testing}
          />

          {formError && (
            <div className="inline-alert inline-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{baseUrlError(formError)}</span>
            </div>
          )}

          {testState.kind !== "idle" && (
            <div className={`inline-alert inline-alert-${testState.kind}`} role="status">
              {testState.kind === "success" ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{testState.message}</span>
            </div>
          )}

          <div className="connect-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing && <Loader2 size={16} className="spin" />}
              {t("common.testConnection")}
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={handleConnect}>
              {t("connect.start")}
              <ArrowRight size={17} />
            </button>
          </div>

          <p className="connect-footnote">
            {t("connect.footnoteBefore")}
            <code>SCHEDY_API_KEY</code>
            {t("connect.footnoteAfter")}
          </p>
        </section>
      </div>
    </div>
  );
}
