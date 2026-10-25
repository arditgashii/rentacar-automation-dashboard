"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), next }),
      });
      const data = (await response.json()) as { redirect?: string; error?: string };
      if (!response.ok || !data.redirect) {
        setError(response.status === 400 ? "Enter your email and password." : (data.error ?? "Could not log in."));
        return;
      }
      router.replace(data.redirect);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <p role="alert" data-testid="login-error" className="rounded-md bg-fail-soft px-3 py-2 text-sm text-fail">
          {error}
        </p>
      ) : null}
      <Field label="Email">
        {(props) => <Input {...props} name="email" type="email" autoComplete="username" required autoFocus />}
      </Field>
      <Field label="Password">
        {(props) => <Input {...props} name="password" type="password" autoComplete="current-password" required />}
      </Field>
      <Button type="submit" variant="primary" disabled={busy} className="mt-1 w-full">
        {busy ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
