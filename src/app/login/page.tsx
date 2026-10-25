import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { homeFor } from "@/lib/auth/permissions";
import { env } from "@/lib/env";
import { currentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect(user.role ? homeFor(user.role) : "/no-access");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-accent text-sm font-bold text-white">D</span>
          <span className="text-lg font-semibold tracking-tight">
            DriveNow <span className="font-normal text-muted">QA Hub</span>
          </span>
        </div>
        <div className="rounded-lg border border-line bg-surface p-6">
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 mb-5 text-sm text-muted">Use the account an admin created for you.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        {env.demoMode ? (
          <div className="mt-4 rounded-lg border border-line bg-surface p-4 text-sm" data-testid="demo-accounts">
            <p className="font-medium text-ink">Public demo</p>
            <p className="mt-1 text-muted">
              Log in as <span className="font-mono text-ink">admin@qahub.test</span> (everything) or{" "}
              <span className="font-mono text-ink">viewer@qahub.test</span> (read only), password{" "}
              <span className="font-mono text-ink">{env.seedPassword}</span>. The data is a sample and is reset from time to time.
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No account or forgot the password? Ask an admin of the team.</p>
        )}
      </div>
    </main>
  );
}
