import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { itemHistory } from "@/lib/regression/data";

export const GET = route(async (_request: Request, context: { params: Promise<{ itemId: string }> }) => {
  await requireApi("regression");
  return json({ history: await itemHistory((await context.params).itemId) });
});
