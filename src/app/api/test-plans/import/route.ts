import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { importFile } from "@/lib/test-plans/data";
import { ExportSchema } from "@/lib/test-plans/validation";

/** Adds the projects of an export file as new projects and reports what was added. */
export const POST = route(async (request: Request) => {
  const user = await requireApi("testPlans", "write");
  const file = await readBody(request, ExportSchema);
  return json(await importFile(file, user.id), 201);
});
