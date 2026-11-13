import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleSchedyProxy } from "./server/proxy.mjs";

/**
 * Exposes the same-origin Schedy API proxy in dev and preview.
 * The proxy target and API key come from browser headers, never from this file.
 */
function schedyProxyPlugin(): Plugin {
  const install = (middlewares: {
    use: (
      path: string,
      handler: (
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse,
      ) => void,
    ) => void;
  }) => {
    middlewares.use("/__schedy", (req, res) => {
      handleSchedyProxy(req, res);
    });
  };

  return {
    name: "schedy-api-proxy",
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [react(), schedyProxyPlugin()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
