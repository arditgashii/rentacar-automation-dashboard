import { eq } from "drizzle-orm";

import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { MemberChangeSchema } from "@/lib/auth/members";
import { hashPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";

type Context = { params: Promise<{ memberId: string }> };

async function member(context: Context) {
  const id = (await context.params).memberId;
  if (!/^[a-z]{3}_[0-9a-z]{10}$/.test(id)) return undefined;
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

/** Role, name or a new temporary password. Your own role cannot be changed, so an Admin is always left. */
export const PATCH = route(async (request: Request, context: Context) => {
  const user = await requireApi("members", "write");
  const target = await member(context);
  if (!target) return errorResponse(404, "Member not found.");
  const body = await readBody(request, MemberChangeSchema);
  if ("role" in body) {
    if (target.id === user.id) return errorResponse(409, "You cannot change your own role.");
    await db.update(schema.users).set({ role: body.role, updatedAt: new Date() }).where(eq(schema.users.id, target.id));
  } else if ("password" in body) {
    await db.update(schema.users).set({ passwordHash: await hashPassword(body.password), updatedAt: new Date() }).where(eq(schema.users.id, target.id));
  } else {
    await db.update(schema.users).set({ name: body.name, updatedAt: new Date() }).where(eq(schema.users.id, target.id));
  }
  return json({ ok: true });
});

/** Removes the account. What they did stays, shown as "A removed user". */
export const DELETE = route(async (_request: Request, context: Context) => {
  const user = await requireApi("members", "write");
  const target = await member(context);
  if (!target) return errorResponse(404, "Member not found.");
  if (target.id === user.id) return errorResponse(409, "You cannot remove yourself.");
  await db.delete(schema.users).where(eq(schema.users.id, target.id));
  return json({ ok: true });
});
