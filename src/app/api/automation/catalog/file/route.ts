import { readCatalog } from "@/lib/automation/state";
import { TestPathSchema } from "@/lib/automation/validation";
import { errorResponse, json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/** The tests of one file, read when the file is opened in the suite editor. */
export const GET = route(async (request: Request) => {
  await requireApi("automation");
  const file = TestPathSchema.parse(new URL(request.url).searchParams.get("file"));
  const catalog = await readCatalog(db);
  const tests = catalog.tests.filter((test) => test.file === file);
  if (tests.length === 0) return errorResponse(404, `Could not read ${file}: it is not in the test catalog.`);
  return json({ tests });
});
