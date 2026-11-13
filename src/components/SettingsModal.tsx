import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LogOut, Settings2 } from "lucide-react";
import { ApiError, testConnection } from "../lib/api";
import { validateBaseUrl, type BaseUrlError } from "../lib/config";
import { useI18n } from "../lib/i18n";
import type { ConnectionConfig } from "../types";
import { ConnectionFields, type ConnectionDraft } from "./ConnectionFields";
import { Modal } from "./Modal";

interface SettingsModalProps {
  open: boolean;
  config: ConnectionConfig;
  onClose: () => void;
  onSave: (config: ConnectionConfig) => void;
  onDisconnect: () => void;
}

type TestState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

export function SettingsModal({ open, config, onClose, onSave, onDisconnect }: SettingsModalProps) {
  const { t, baseUrlError } = useI18n();
  const [draft, setDraft] = useState<ConnectionDraft>(config);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<TestState>({ kind: "idle" });
  const [formError, setFormError] = useState<BaseUrlError | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(config);
    setTestState({ kind: "idle" });
    setFormError(null);
    setConfirmDisconnect(false);
    setShowKey(false);
  }, [open, config]);

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
    const next = validate();
    if (!next) return;
    setTesting(true);
    setTestState({ kind: "idle" });
    try {
      const result = await testConnection(next, AbortSignal.timeout(20_000));
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

  const handleSave = () => {
    const next = validate();
    if (!next) return;
    onSave(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("settings.title")}
      description={t("settings.description")}
      icon={<Settings2 size={19} />}
      size="md"
      footer={
        <div className="modal-footer-split">
          <div>
            {confirmDisconnect ? (
              <span className="disconnect-confirm">
                {t("settings.disconnectConfirm")}
                <button type="button" className="link-btn danger" onClick={onDisconnect}>
                  {t("settings.clear")}
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setConfirmDisconnect(false)}
                >
                  {t("common.cancel")}
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="link-btn danger"
                onClick={() => setConfirmDisconnect(true)}
              >
                <LogOut size={14} />
                {t("settings.disconnect")}
              </button>
            )}
          </div>
          <div className="footer-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTest}
              disabled={testing}
            >
              {testing && <Loader2 size={15} className="spin" />}
              {t("common.testConnection")}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {t("common.save")}
            </button>
          </div>
        </div>
      }
    >
      <ConnectionFields
        value={draft}
        onChange={setDraft}
        showKey={showKey}
        onToggleShowKey={() => setShowKey((current) => !current)}
        showAutoRefresh
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
          {testState.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{testState.message}</span>
        </div>
      )}

      <div className="settings-note">
        <div>
          <strong>{t("settings.corsTitle")}</strong>
          <p>
            {t("settings.corsPrefix")}
            <code>SCHEDY_CORS_ORIGIN</code>
            {t("settings.corsSuffix")}
          </p>
        </div>
      </div>
    </Modal>
  );
}
