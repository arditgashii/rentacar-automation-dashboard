import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "@/lib/db";

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database is up to date.");
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
