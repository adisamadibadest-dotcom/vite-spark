import { handleChat } from "../../src/lib/api-handlers";

export default async (request: Request) => handleChat(request);
