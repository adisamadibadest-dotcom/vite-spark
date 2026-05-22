import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleAnalyzeChart } from "../server/handlers.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const result = await handleAnalyzeChart(
    req.body as Parameters<typeof handleAnalyzeChart>[0]
  );
  res.status(result.status).json(result.body);
}
