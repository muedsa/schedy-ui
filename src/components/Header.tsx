import { Activity, ListChecks, Moon, Settings, Sun, Wifi, WifiOff } from "lucide-react";
import type { Route } from "../hooks/useHashRoute";
import { serverLabel } from "../lib/config";
import { useI18n } from "../lib/i18n";
import type { ConnectionConfig } from "../types";
import { Brand } from "./Brand";

export type HealthState =
  | { state: "checking" }
  | { state: "online"; version: string; status: string }
  | { state: "offline" };

interface HeaderProps {
  route: Route;
  navigate: (route: Route) => void;
  config: ConnectionConfig;
  health: HealthState;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function Header({
  route,
  navigate,
  config,
  health,
  theme,
  onToggleTheme,
  onOpenSettings,
}: HeaderProps) {
  const { t, toggleLocale } = useI18n();
  const host = serverLabel(config.baseUrl);
  const modeLabel = config.mode === "proxy" ? t("common.proxyMode") : t("common.directMode");
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand">
          <Brand />
          <span className="topbar-divider" aria-hidden />
          <nav className="main-nav" aria-label={t("nav.label")}>
            <button
              type="button"
              className={route === "tasks" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("tasks")}
            >
              <ListChecks size={16} />
              {t("nav.tasks")}
            </button>
            <button
              type="button"
              className={route === "system" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("system")}
            >
              <Activity size={16} />
              {t("nav.system")}
            </button>
          </nav>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className="server-pill"
            onClick={onOpenSettings}
            title={`${config.baseUrl} · ${modeLabel}`}
          >
            {health.state === "online" ? (
              <Wifi size={14} className="server-online-icon" />
            ) : (
              <WifiOff
                size={14}
                className={health.state === "offline" ? "server-offline-icon" : ""}
              />
            )}
            <span className="server-host">{host}</span>
            <span
              className={`health-dot ${
                health.state === "online"
                  ? "online"
                  : health.state === "offline"
                    ? "offline"
                    : "checking"
              }`}
              aria-hidden
            />
            <span className="server-version">
              {health.state === "online"
                ? health.version || t("common.online")
                : health.state === "offline"
                  ? t("common.offline")
                  : t("common.connecting")}
            </span>
          </button>
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
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? t("header.switchToLight") : t("header.switchToDark")}
            title={theme === "dark" ? t("header.switchToLight") : t("header.switchToDark")}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenSettings}
            aria-label={t("header.connectionSettings")}
            title={t("header.connectionSettings")}
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
