import { json, route } from "@/lib/api";
import { getSession } from "@/lib/auth/session";

export const POST = route(async () => {
  const session = await getSession();
  session.destroy();
  return json({ ok: true });
});
