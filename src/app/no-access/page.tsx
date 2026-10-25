import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { homeFor } from "@/lib/auth/permissions";
import { currentUser } from "@/lib/auth/session";
import { LogoutButton } from "./logout-button";

export const metadata: Metadata = { title: "No access" };

export default async function NoAccessPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role) redirect(homeFor(user.role));

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[420px] rounded-lg border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="mt-2 text-base text-muted">
          You are logged in as <span className="text-ink">{user.email}</span>, but you are not a member of the QA Hub.
          Ask an admin to add you in Members.
        </p>
        <div className="mt-5">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
