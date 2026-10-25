import { asc, eq } from "drizzle-orm";

import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { NewMemberSchema } from "@/lib/auth/members";
import { hashPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";

/** Every account with its role. Password hashes never leave the server. */
export const GET = route(async () => {
  const user = await requireApi("members");
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role, createdAt: schema.users.createdAt })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
  return json({ members: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })), you: user.id });
});

/** Adds a member with a temporary password the Admin passes on. */
export const POST = route(async (request: Request) => {
  await requireApi("members", "write");
  const body = await readBody(request, NewMemberSchema);
  const taken = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  if (taken) return errorResponse(409, `${body.email} is already a member.`);
  const id = newId("usr");
  await db.insert(schema.users).values({ id, email: body.email, name: body.name, role: body.role, passwordHash: await hashPassword(body.password) });
  return json({ id }, 201);
});
