// Deletes videos, screenshots and traces of runs older than MEDIA_RETENTION_DAYS. Results stay.

import fs from "node:fs";
import path from "node:path";

import { and, eq, lt } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { runDir } from "./runner";

export async function deleteOldMedia(now: Date): Promise<void> {
  const limit = new Date(now.getTime() - env.mediaRetentionDays * 86_400_000);
  const old = await db
    .select({ id: schema.runs.id })
    .from(schema.runs)
    .where(and(eq(schema.runs.mediaDeleted, false), eq(schema.runs.source, "real"), lt(schema.runs.finishedAt, limit)));
  for (const run of old) {
    fs.rmSync(path.join(runDir(run.id), "artifacts"), { recursive: true, force: true });
    await db.update(schema.runs).set({ mediaDeleted: true }).where(eq(schema.runs.id, run.id));
  }
  if (old.length) console.log(`[retention] media deleted for ${old.length} runs`);
}
