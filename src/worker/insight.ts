// What the dashboard can say about a failure: since when it fails and which platform commits came in
// since it last passed.

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { commitsBetween } from "@/lib/automation/git";
import type { CulpritCommit } from "@/lib/automation/types";
import { db, schema } from "@/lib/db";

const FAILING = ["failed", "known_bug"];

/** Earlier results of the same test, newest first. */
async function history(nodeid: string, before: Date) {
  return db
    .select({ outcome: schema.runTests.outcome, startedAt: schema.runs.startedAt, commit: schema.runs.platformCommit })
    .from(schema.runTests)
    .innerJoin(schema.runs, eq(schema.runs.id, schema.runTests.runId))
    .where(and(eq(schema.runTests.nodeid, nodeid), lt(schema.runs.startedAt, before), inArray(schema.runs.status, ["passed", "failed"])))
    .orderBy(desc(schema.runs.startedAt))
    .limit(60);
}

export async function analyseFailure(
  nodeid: string,
  runStartedAt: Date,
  commit: string | undefined,
): Promise<{ failingSince: Date; culprits: CulpritCommit[] }> {
  const earlier = await history(nodeid, runStartedAt);
  let failingSince = runStartedAt;
  let lastPassCommit: string | null = null;
  for (const entry of earlier) {
    if (FAILING.includes(entry.outcome)) {
      if (entry.startedAt) failingSince = entry.startedAt;
      continue;
    }
    lastPassCommit = entry.commit;
    break;
  }
  const culprits = commit && lastPassCommit && lastPassCommit !== commit ? await commitsBetween(lastPassCommit, commit) : [];
  return { failingSince, culprits };
}
