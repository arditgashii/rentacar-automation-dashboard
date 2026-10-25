import { redirect } from "next/navigation";

import { homeFor } from "@/lib/auth/permissions";
import { currentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await currentUser();
  redirect(homeFor(user?.role ?? null));
}
