// Seed data: users, Automation Tests (channels, suites, schedules, 30 days of demo history),
// Test Plans and Manual Regression. `npm run seed -- --reset` wipes everything and seeds again.

import { sql } from "drizzle-orm";

import { hashPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";
import { seedAutomation } from "./seed/automation";
import { seedRegression } from "./seed/regression";
import { seedTestPlans } from "./seed/test-plans";

const USERS = [
  { email: "admin@qahub.test", name: "Ardita Hoxha", role: "admin" as const },
  { email: "editor@qahub.test", name: "Besnik Rama", role: "editor" as const },
  { email: "viewer@qahub.test", name: "Vesa Kryeziu", role: "viewer" as const },
];

const TABLES = [
  "reg_history", "reg_items", "reg_runs", "reg_library", "tp_attachments", "tp_cases", "tp_nodes", "tp_projects",
  "run_tests", "runs", "schedules", "suites", "teams_settings", "teams_channels", "users",
]; // fmt: skip

async function main(): Promise<void> {
  if (process.argv.includes("--reset")) {
    await db.execute(sql.raw(`truncate ${TABLES.join(", ")} restart identity cascade`));
    console.log("All data removed.");
  }
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length) {
    console.log("Seed data already present, nothing to do. Use npm run seed -- --reset to start over.");
    await db.$client.end();
    return;
  }

  const passwordHash = await hashPassword(env.seedPassword);
  const users = USERS.map((user) => ({ id: newId("usr"), passwordHash, ...user }));
  await db.insert(schema.users).values(users);
  const [admin, editor] = users;

  await seedAutomation(admin.id);
  console.log("Automation Tests seeded.");
  await seedTestPlans(admin.id);
  console.log("Test Plans seeded.");
  await seedRegression({ admin: admin.id, editor: editor.id });
  console.log("Manual Regression seeded.");
  await db.$client.end();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await db.$client.end();
  process.exit(1);
});
