import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { addItem } from "@/lib/regression/data";
import { NewItemSchema } from "@/lib/regression/validation";

/** Add module, feature or function (optionally to the library too), or a sprint item. */
export const POST = route(async (request: Request, context: { params: Promise<{ runId: string }> }) => {
  const user = await requireApi("regression", "write");
  const body = await readBody(request, NewItemSchema);
  const id = await addItem((await context.params).runId, body, user.id);
  return json({ id }, 201);
});
