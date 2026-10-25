import fs from "node:fs";
import path from "node:path";

import { CONTENT_TYPES, runFilePath } from "@/lib/automation/run-files";
import { errorResponse, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";

/** Screenshots, videos and traces of a run. Paths are checked so nothing outside the run folder is served. */
export const GET = route(async (_request: Request, context: { params: Promise<{ runId: string; path: string[] }> }) => {
  await requireApi("automation");
  const { runId, path: parts } = await context.params;
  const relative = parts.map(decodeURIComponent).join("/");
  const file = runFilePath(runId, relative);
  if (!file || !fs.existsSync(file)) return errorResponse(404, "This file was deleted or never existed.");
  const data = await fs.promises.readFile(file);
  const isTrace = path.extname(file) === ".zip";
  return new Response(data, {
    headers: {
      "Content-Type": CONTENT_TYPES[path.extname(file).toLowerCase()],
      "Cache-Control": "private, max-age=3600",
      ...(isTrace ? { "Content-Disposition": `attachment; filename="trace-${runId}.zip"` } : {}),
    },
  });
});
