import { handleGoldPrice } from "../src/lib/api-handlers";

export default async function handler() {
  return handleGoldPrice();
}
