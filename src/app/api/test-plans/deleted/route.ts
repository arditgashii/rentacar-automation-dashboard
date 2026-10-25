import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { listDeleted, restore } from "@/lib/test-plans/data";
import { RestoreSchema } from "@/lib/test-plans/validation";

export const GET = route(async () => {
  await requireApi("testPlans");
  return json({ items: await listDeleted() });
});

/** Restores one delete (a project, a suite or folder with what was inside, or test cases). */
export const POST = route(async (request: Request) => {
  await requireApi("testPlans", "write");
  const { batch } = await readBody(request, RestoreSchema);
  await restore(batch);
  return json({ ok: true });
});
