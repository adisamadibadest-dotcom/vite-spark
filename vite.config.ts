import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import type { IncomingMessage, ServerResponse } from "node:http";

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function sendResponse(res: ServerResponse, response: Response) {
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.statusCode = response.status;
  res.end(Buffer.from(await response.arrayBuffer()));
}

function toRequest(req: IncomingMessage, body?: Buffer) {
  return new Request(`http://localhost${req.url ?? "/"}`, {
    method: req.method ?? "GET",
    headers: req.headers as HeadersInit,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : new Uint8Array(body ?? Buffer.alloc(0)),
  });
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    {
      name: "apex-local-api",
      configureServer(server) {
        server.middlewares.use("/api/gold-price", async (_req, res) => {
          const mod = await server.ssrLoadModule("/src/lib/api-handlers.ts");
          await sendResponse(res, await mod.handleGoldPrice());
        });
        server.middlewares.use("/api/analyze-chart", async (req, res) => {
          const mod = await server.ssrLoadModule("/src/lib/api-handlers.ts");
          await sendResponse(res, await mod.handleAnalyzeChart(toRequest(req, await readBody(req))));
        });
        server.middlewares.use("/api/chat", async (req, res) => {
          const mod = await server.ssrLoadModule("/src/lib/api-handlers.ts");
          await sendResponse(res, await mod.handleChat(toRequest(req, await readBody(req))));
        });
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
});