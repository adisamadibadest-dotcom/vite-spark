import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleGoldPrice } from "../server/handlers.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const result = await handleGoldPrice();
  for (const [key, val] of Object.entries(result.headers)) {
    res.setHeader(key, val);
  }
  res.status(result.status).json(result.body);
}
