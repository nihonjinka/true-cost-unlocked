import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { handleOpenRouter } from "./server/openrouter";

function localAIProxy(env: Record<string, string | undefined>): Plugin {
  const configure = (server: Pick<ViteDevServer, "middlewares">) => {
    server.middlewares.use("/.netlify/functions/openrouter", async (req, res) => {
      const controller = new AbortController();
      const abort = () => { if (!res.writableEnded) controller.abort(); };
      res.on("close", abort);
      try {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 300_000) { res.statusCode = 413; res.end(JSON.stringify({ error: "AI request is too large." })); return; }
          chunks.push(Buffer.from(chunk));
        }
        if (controller.signal.aborted) return;
        const response = await handleOpenRouter(new Request(`http://${req.headers.host}/.netlify/functions/openrouter`, {
          method: req.method, headers: { ...(req.headers.origin ? { origin: req.headers.origin } : {}) },
          ...(req.method === "POST" ? { body: Buffer.concat(chunks) } : {}), signal: controller.signal,
        }), env);
        res.statusCode = response.status;
        response.headers.forEach((value, name) => res.setHeader(name, value));
        res.end(await response.text());
      } catch {
        if (!res.destroyed && !res.writableEnded) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "The local AI service could not handle this request. Please retry." }));
        }
      } finally { res.off("close", abort); }
    });
  };
  return { name: "local-ai-proxy", configureServer: configure, configurePreviewServer: configure };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Only explicitly public settings may be included in the JavaScript bundle.
  envPrefix: "VITE_PUBLIC_",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), localAIProxy({ ...loadEnv(mode, process.cwd(), ""), ...process.env })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
