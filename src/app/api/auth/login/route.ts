import { eq } from "drizzle-orm";
import { z } from "zod";

import { json, readBody, route } from "@/lib/api";
import { dummyPasswordHash, verifyPassword } from "@/lib/auth/password";
import { homeFor } from "@/lib/auth/permissions";
import { loginThrottle } from "@/lib/auth/throttle";
import { getSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

const Body = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

/** Only local paths, so a login link can never send someone to another site. */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export const POST = route(async (request: Request) => {
  const body = await readBody(request, Body);
  const wait = loginThrottle.waitFor(body.email);
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60_000);
    return json({ error: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` }, 429);
  }
  const user = await db.query.users.findFirst({ where: eq(schema.users.email, body.email) });
  const matches = await verifyPassword(body.password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !matches) {
    loginThrottle.failed(body.email);
    return json({ error: "Wrong email or password." }, 401);
  }
  loginThrottle.succeeded(body.email);

  const session = await getSession();
  session.userId = user.id;
  await session.save();
  return json({ redirect: user.role ? (safeNext(body.next) ?? homeFor(user.role)) : "/no-access" });
});
