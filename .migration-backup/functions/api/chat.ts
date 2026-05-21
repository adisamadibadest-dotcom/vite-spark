import { handleChat } from "../../src/lib/api-handlers";

export const onRequestPost = ({ request }: { request: Request }) => handleChat(request);
