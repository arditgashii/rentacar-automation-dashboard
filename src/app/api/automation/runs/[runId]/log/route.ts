import fs from "node:fs";

import { runFilePath } from "@/lib/automation/run-files";
import { json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";

const MAX_BYTES = 2 * 1024 * 1024;

/** The terminal output of the run (the last 2 MB when it is longer). */
export const GET = route(async (_request: Request, context: { params: Promise<{ runId: string }> }) => {
  await requireApi("automation");
  const file = runFilePath((await context.params).runId, "output.log");
  if (!file || !fs.existsSync(file)) return json({ log: null });
  const { size } = await fs.promises.stat(file);
  const handle = await fs.promises.open(file, "r");
  try {
    const length = Math.min(size, MAX_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    return json({ log: buffer.toString("utf8"), truncated: size > MAX_BYTES });
  } finally {
    await handle.close();
  }
});
