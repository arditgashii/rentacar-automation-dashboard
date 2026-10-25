import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { removeFromLibrary } from "@/lib/regression/data";

/** New runs stop getting this item; the current run keeps it and its result. */
export const POST = route(async (_request: Request, context: { params: Promise<{ itemId: string }> }) => {
  await requireApi("regression", "write");
  await removeFromLibrary((await context.params).itemId);
  return json({ ok: true });
});
