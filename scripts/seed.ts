import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { newId } from "@/lib/ids";

const USERS = [
  { email: "admin@qahub.test", name: "Ardita Hoxha", role: "admin" as const },
  { email: "editor@qahub.test", name: "Besnik Rama", role: "editor" as const },
  { email: "viewer@qahub.test", name: "Vesa Kryeziu", role: "viewer" as const },
];

async function seedUsers(): Promise<void> {
  const passwordHash = await hashPassword(env.seedPassword);
  await db
    .insert(schema.users)
    .values(USERS.map((user) => ({ id: newId("usr"), passwordHash, ...user })))
    .onConflictDoNothing({ target: schema.users.email });
}

async function main(): Promise<void> {
  await seedUsers();
  console.log("Seed data created.");
  await db.$client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
