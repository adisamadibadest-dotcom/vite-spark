import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleChat } from "../server/handlers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const result = await handleChat(
    req.body as Parameters<typeof handleChat>[0]
  );
  res.status(result.status).json(result.body);
}
