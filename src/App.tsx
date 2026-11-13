import { useCallback, useEffect, useRef, useState } from "react";
import { Header, type HealthState } from "./components/Header";
import { SettingsModal } from "./components/SettingsModal";
import { useToast } from "./components/Toast";
import { useHashRoute } from "./hooks/useHashRoute";
import { useTheme } from "./hooks/useTheme";
import { getHealth } from "./lib/api";
import { clearConnection, loadConnection, saveConnection } from "./lib/config";
import { ConnectScreen } from "./pages/ConnectScreen";
import { SystemPage } from "./pages/SystemPage";
import { TasksPage } from "./pages/TasksPage";
import { useI18n } from "./lib/i18n";
import type { ConnectionConfig } from "./types";

export function App() {
  const toast = useToast();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [route, navigate] = useHashRoute();
  const [config, setConfig] = useState<ConnectionConfig | null>(() => loadConnection());
  const [revision, setRevision] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState<HealthState>({ state: "checking" });
  const healthSeq = useRef(0);

  useEffect(() => {
    if (!config) {
      setHealth({ state: "checking" });
      return;
    }
    let cancelled = false;
    const check = async () => {
      const requestId = ++healthSeq.current;
      try {
        const result = await getHealth(config);
        if (cancelled || requestId !== healthSeq.current) return;
        setHealth({ state: "online", version: result.version, status: result.status });
      } catch {
        if (cancelled || requestId !== healthSeq.current) return;
        setHealth({ state: "offline" });
      }
    };
    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 30_000);
    return () => {
      cancelled = true;
      healthSeq.current += 1;
      window.clearInterval(timer);
    };
  }, [config]);

  const handleConnected = useCallback((next: ConnectionConfig) => {
    saveConnection(next);
    setConfig(next);
    setRevision((current) => current + 1);
    setHealth({ state: "checking" });
  }, []);

  const handleSaveSettings = useCallback(
    (next: ConnectionConfig) => {
      saveConnection(next);
      setConfig(next);
      setRevision((current) => current + 1);
      setSettingsOpen(false);
      setHealth({ state: "checking" });
      toast.success(t("app.settingsSaved"));
    },
    [toast, t],
  );

  const handleDisconnect = useCallback(() => {
    clearConnection();
    setConfig(null);
    setSettingsOpen(false);
    setRevision((current) => current + 1);
    toast.info(t("app.disconnectedTitle"), t("app.disconnectedDescription"));
  }, [toast, t]);

  if (!config) {
    return (
      <ConnectScreen theme={theme} onToggleTheme={toggleTheme} onConnected={handleConnected} />
    );
  }

  return (
    <div className="app-shell">
      <Header
        route={route}
        navigate={navigate}
        config={config}
        health={health}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className="app-main" key={revision}>
        {route === "tasks" ? (
          <TasksPage config={config} onOpenSettings={() => setSettingsOpen(true)} />
        ) : (
          <SystemPage config={config} onOpenSettings={() => setSettingsOpen(true)} />
        )}
      </main>
      <footer className="app-footer">
        <span>
          Schedy Console ·{" "}
          {config.mode === "proxy" ? t("common.proxyMode") : t("common.directMode")}
        </span>
        <a href="https://schedy.mintlify.app" target="_blank" rel="noreferrer">
          {t("common.apiDocs")}
        </a>
      </footer>

      <SettingsModal
        open={settingsOpen}
        config={config}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
