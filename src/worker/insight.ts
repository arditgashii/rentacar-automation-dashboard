// What the dashboard can say about a failure: since when it fails and which platform commits came in
// since it last passed.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import type { CulpritCommit } from "@/lib/automation/types";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

const run = promisify(execFile);
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

let fetchedAt = 0;

/** Commits on the platform's main branch between two commits, newest first (at most 20). */
async function commitsBetween(from: string, to: string): Promise<CulpritCommit[]> {
  const git = (args: string[]) => run("git", ["-C", env.platformRepo, ...args], { timeout: 20_000, windowsHide: true });
  try {
    if (Date.now() - fetchedAt > 5 * 60_000) {
      await git(["fetch", "-q", "origin", "main"]).catch(() => undefined);
      fetchedAt = Date.now();
    }
    const { stdout } = await git(["log", "--max-count=20", "--format=%H%x1f%s%x1f%an%x1f%aI", `${from}..${to}`]);
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, message, author, date] = line.split("\x1f");
        return { sha, message, author, date, url: `${env.platformGithubUrl}/commit/${sha}` };
      });
  } catch {
    return [];
  }
}
