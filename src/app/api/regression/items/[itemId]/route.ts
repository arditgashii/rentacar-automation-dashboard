import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { changeItem, deleteItem } from "@/lib/regression/data";
import { ItemChangeSchema } from "@/lib/regression/validation";

type Context = { params: Promise<{ itemId: string }> };

/** Result, comment, name (also in the library) or, for sprint items, type and Jira link. */
export const PATCH = route(async (request: Request, context: Context) => {
  const user = await requireApi("regression", "write");
  const body = await readBody(request, ItemChangeSchema);
  const saved = await changeItem((await context.params).itemId, body, user.id);
  return json({ updatedAt: saved.updatedAt, updatedBy: saved.changed ? user.name : null });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("regression", "write");
  await deleteItem((await context.params).itemId);
  return json({ ok: true });
});
