import { handleGoldPrice } from "../src/lib/api-handlers";
import { sendWebResponse } from "./_utils";

export default async function handler(_request: unknown, response?: unknown) {
  const webResponse = await handleGoldPrice();
  if (response && typeof response === "object" && "setHeader" in response) {
    return sendWebResponse(response as never, webResponse);
  }
  return webResponse;
}
