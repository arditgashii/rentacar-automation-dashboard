import "server-only";

import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { type Area, canRead, canWrite, homeFor } from "./permissions";
import { type CurrentUser, currentUser } from "./session";

/** For pages: sends the visitor to login, to No access, or to their home when the area is closed. */
export async function requirePage(area: Area, nextPath: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!user.role) redirect("/no-access");
  if (!canRead(user.role, area)) redirect(homeFor(user.role));
  return user;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** For API routes: 401 without a session, 403 when the role may not read (or write) the area. */
export async function requireApi(area: Area, mode: "read" | "write" = "read"): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Log in first.");
  const allowed = mode === "read" ? canRead(user.role, area) : canWrite(user.role, area);
  if (!allowed) throw new HttpError(403, "You do not have access to this.");
  if (mode === "write" && (area === "members" || area === "settings")) assertNotDemo();
  return user;
}

export const DEMO_MESSAGE = "This is the public demo, so this is switched off. Run the project locally to try it (see the README).";

/** In the public demo, starting runs, uploads, Teams and Members are refused. */
export function assertNotDemo(): void {
  if (env.demoMode) throw new HttpError(403, DEMO_MESSAGE);
}
