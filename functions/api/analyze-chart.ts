import { handleAnalyzeChart } from "../../src/lib/api-handlers";

export const onRequestPost = ({ request }: { request: Request }) => handleAnalyzeChart(request);
