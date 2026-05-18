import { handleChat } from "../src/lib/api-handlers";

export default async function handler(request: Request) {
  return handleChat(request);
}
