import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ToastProvider } from "./components/Toast";
import { I18nProvider } from "./lib/i18n";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

createRoot(container).render(
  <I18nProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </I18nProvider>,
);
