import { json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { listRuns, openOrCreateRun } from "@/lib/regression/data";
import { NewRunSchema, RunQuerySchema } from "@/lib/regression/validation";

/** The releases or sprints of one kind, team and environment (the picker reloads this every time it opens). */
export const GET = route(async (request: Request) => {
  await requireApi("regression");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = RunQuerySchema.parse(params);
  return json({ runs: await listRuns(query.kind, query.team, query.environment) });
});

/** Opens the run with this name (any case), or creates it with a copy of the team's library. */
export const POST = route(async (request: Request) => {
  const user = await requireApi("regression", "write");
  const body = await readBody(request, NewRunSchema);
  const run = await openOrCreateRun(body, user.id);
  return json(run, run.created ? 201 : 200);
});
