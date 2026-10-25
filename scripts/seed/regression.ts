// Demo data for Manual Regression: the library of every team, and a few runs in different states.

import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { LIBRARY, TEAMS } from "@/lib/regression/library";
import { copyLibraryIntoRun } from "@/lib/regression/runs";

export async function seedRegression(users: { admin: string; editor: string }): Promise<void> {
  const rows: (typeof schema.regLibrary.$inferInsert)[] = [];
  for (const team of TEAMS) {
    Object.entries(LIBRARY[team]).forEach(([module, features], m) => {
      const moduleId = newId("lib");
      rows.push({ id: moduleId, team, parentId: null, kind: "module", name: module, position: m });
      Object.entries(features).forEach(([feature, functions], f) => {
        const featureId = newId("lib");
        rows.push({ id: featureId, team, parentId: moduleId, kind: "feature", name: feature, position: f });
        functions.forEach((name, position) => rows.push({ id: newId("lib"), team, parentId: featureId, kind: "function", name, position }));
      });
    });
  }
  await db.insert(schema.regLibrary).values(rows);

  const day = 86_400_000;
  const now = Date.now();

  // A finished release check of Fleet: mostly passed, one failure with a Jira key, one blocked.
  const done = await createRun("before-release", "Fleet", "v1.4.0", users.editor, new Date(now - 9 * day));
  const items = await db.select().from(schema.regItems).where(eq(schema.regItems.runId, done));
  for (const item of items.filter((i) => i.kind === "function")) {
    const failed = item.name === "Refuse a file over 5 MB";
    const blocked = item.name === "Upload PNG and WEBP";
    await db
      .update(schema.regItems)
      .set({
        result: failed ? "failed" : blocked ? "blocked" : "passed",
        comment: failed ? "A 6 MB photo was accepted. Logged as DN-1234." : blocked ? "No WEBP test file on the test machine." : "",
        updatedBy: users.editor,
        updatedAt: new Date(now - 9 * day + 3_600_000),
      })
      .where(eq(schema.regItems.id, item.id));
  }
  await db.update(schema.regRuns).set({ status: "completed", completedBy: users.editor, completedAt: new Date(now - 8 * day) }).where(eq(schema.regRuns.id, done));

  // The next release, half way through.
  const open = await createRun("before-release", "Fleet", "v1.5.0", users.editor, new Date(now - day));
  const openItems = await db.select().from(schema.regItems).where(eq(schema.regItems.runId, open));
  for (const item of openItems.filter((i) => i.kind === "function").filter((i, index) => index < 13 || i.name === "Duplicate plate is refused")) {
    await db
      .update(schema.regItems)
      .set({ result: item.name === "Duplicate plate is refused" ? "failed" : "passed", comment: item.name === "Duplicate plate is refused" ? "Saved twice with a space in the plate, see DN-1301" : "", updatedBy: users.admin, updatedAt: new Date(now - day / 2) })
      .where(eq(schema.regItems.id, item.id));
  }

  await createRun("after-release", "Core", "v1.4.0", users.admin, new Date(now - 7 * day));

  // A sprint run starts empty; these items were added by the team.
  const sprint = await createRun("sprint", "Bookings", "Sprint 42", users.editor, new Date(now - 3 * day));
  const sprintItems = [
    { kind: "story" as const, name: "Clients can cancel a pending booking", jira: "DN-1288", result: "passed" as const },
    { kind: "story" as const, name: "Live total in the booking form", jira: "DN-1290", result: "passed" as const },
    { kind: "task" as const, name: "Refuse bookings longer than 30 days", jira: "DN-1294", result: "not_tested" as const },
    { kind: "bug" as const, name: "Overlapping bookings are accepted", jira: "DN-1297", result: "failed" as const },
  ];
  await db.insert(schema.regItems).values(
    sprintItems.map((item, position) => ({
      id: newId("itm"),
      runId: sprint,
      kind: item.kind,
      name: item.name,
      jira: item.jira,
      position,
      result: item.result,
      comment: item.result === "failed" ? "Still reproducible on Development: a booking that covers another one is saved." : "",
      updatedBy: item.result === "not_tested" ? null : users.editor,
      updatedAt: item.result === "not_tested" ? null : new Date(now - 2 * day),
    })),
  );
}

async function createRun(kind: "before-release" | "after-release" | "e2e" | "sprint", team: string, name: string, userId: string, startedAt: Date): Promise<string> {
  const id = newId("rgr");
  await db.insert(schema.regRuns).values({ id, kind, team, environment: "Development", name, nameKey: name.toLowerCase(), startedBy: userId, startedAt });
  if (kind !== "sprint") await copyLibraryIntoRun(db, id, team);
  return id;
}
