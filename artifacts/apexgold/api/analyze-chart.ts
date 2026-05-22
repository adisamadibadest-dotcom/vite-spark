import { handleAnalyzeChart } from "../src/lib/api-handlers";
import { sendWebResponse, toWebRequest } from "./_utils";

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(request: Request, response?: unknown) {
  const webRequest =
    request instanceof Request ? request : await toWebRequest(request as never);
  const webResponse = await handleAnalyzeChart(webRequest);
  if (response && typeof response === "object" && "setHeader" in response) {
    return sendWebResponse(response as never, webResponse);
  }
  return webResponse;
}
