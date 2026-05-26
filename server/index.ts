import express from "express";
import cors from "cors";
import { handleGoldPrice, handleChat, handleAnalyzeChart } from "./handlers.js";
import { registerAdminRoutes } from "./admin.js";
import { registerMpesaRoutes } from "./mpesa.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/api/gold-price", async (_req, res) => {
  const result = await handleGoldPrice();
  for (const [key, val] of Object.entries(result.headers)) {
    res.setHeader(key, val);
  }
  res.status(result.status).json(result.body);
});

app.post("/api/chat", async (req, res) => {
  const result = await handleChat(req.body as Parameters<typeof handleChat>[0]);
  res.status(result.status).json(result.body);
});

app.post("/api/analyze-chart", async (req, res) => {
  const result = await handleAnalyzeChart(
    req.body as Parameters<typeof handleAnalyzeChart>[0]
  );
  res.status(result.status).json(result.body);
});

registerAdminRoutes(app);
registerMpesaRoutes(app);

const PORT = Number(process.env.API_PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});
