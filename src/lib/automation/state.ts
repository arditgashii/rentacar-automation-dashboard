// Small shared values kept in app_state: the test catalog and the worker heartbeat.

import { eq } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import type { Catalog } from "./types";

export async function readState<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.query.appState.findFirst({ where: eq(schema.appState.key, key) });
  return (row?.value as T | undefined) ?? null;
}

export async function writeState(db: Db, key: string, value: unknown): Promise<void> {
  await db
    .insert(schema.appState)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.appState.key, set: { value, updatedAt: new Date() } });
}

export async function readCatalog(db: Db): Promise<Catalog> {
  return (await readState<Catalog>(db, "catalog")) ?? { generatedAt: "", tests: [] };
}

/** The worker writes its heartbeat every few seconds; the UI warns when it is older than this. */
export const WORKER_STALE_MS = 30_000;
