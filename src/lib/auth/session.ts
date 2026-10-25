import "server-only";

import { eq } from "drizzle-orm";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { Role } from "./permissions";

export type SessionData = { userId?: string };

export type CurrentUser = { id: string; email: string; name: string; role: Role | null };

export const SESSION_COOKIE = "qahub_session";

function sessionOptions(): SessionOptions {
  if (env.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters (see .env.example).");
  }
  return {
    cookieName: SESSION_COOKIE,
    password: env.sessionSecret,
    ttl: 60 * 60 * 12,
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: env.secureCookies, path: "/" },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

/** The logged-in user, read fresh from the database so a role change or removal applies at once. */
export async function currentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role ?? null };
}
