// Regression runs: a new run copies the team's library; later changes to the library do not touch it.

import { and, asc, eq } from "drizzle-orm";

import { type Db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function copyLibraryIntoRun(db: Db, runId: string, team: string): Promise<void> {
  const library = await db
    .select()
    .from(schema.regLibrary)
    .where(and(eq(schema.regLibrary.team, team), eq(schema.regLibrary.removed, false)))
    .orderBy(asc(schema.regLibrary.position));
  const idFor = new Map(library.map((item) => [item.id, newId("itm")]));
  const rows = library
    // A removed parent hides its children too.
    .filter((item) => !item.parentId || idFor.has(item.parentId))
    .map((item) => ({
      id: idFor.get(item.id)!,
      runId,
      libraryId: item.id,
      parentId: item.parentId ? idFor.get(item.parentId)! : null,
      kind: item.kind,
      name: item.name,
      position: item.position,
    }));
  if (rows.length) await db.insert(schema.regItems).values(rows);
}
