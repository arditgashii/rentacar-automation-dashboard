import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { deleteCases } from "@/lib/test-plans/data";
import { BulkDeleteSchema } from "@/lib/test-plans/validation";

export const POST = route(async (request: Request) => {
  await requireApi("testPlans", "write");
  const { ids } = await readBody(request, BulkDeleteSchema);
  return json({ deleted: await deleteCases(ids) });
});
