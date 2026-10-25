import { z } from "zod";

import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { canWrite } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { runDetails, setRunStatus } from "@/lib/regression/data";

type Context = { params: Promise<{ runId: string }> };

export const GET = route(async (_request: Request, context: Context) => {
  const user = await requireApi("regression");
  const details = await runDetails((await context.params).runId);
  return json({ ...details, canWrite: canWrite(user.role, "regression"), jiraBaseUrl: env.jiraBaseUrl });
});

const StatusSchema = z.strictObject({ status: z.enum(["open", "completed"]) });

/** Complete (read only afterwards) or Reopen. */
export const PATCH = route(async (request: Request, context: Context) => {
  const user = await requireApi("regression", "write");
  const { status } = await readBody(request, StatusSchema);
  await setRunStatus((await context.params).runId, status, user.id);
  return json({ ok: true });
});
