// The check before every run: is the platform up, are its dependencies ready, which commit runs,
// how old is the seed data and which accounts will the tests use.

import fs from "node:fs";
import path from "node:path";

import type { EnvironmentReport } from "@/lib/automation/types";
import { env } from "@/lib/env";

const SEED_WARNING_DAYS = 7;

async function getJson(url: string): Promise<{ status: number; body: Record<string, unknown> } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** Account pools from the QA repo's .env (emails only; passwords are never read). */
function accountPools(): string[] {
  const file = path.join(env.qaRepo, ".env");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const pool = (key: string, fallback: string) => {
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    const emails = (line ? line.slice(key.length + 1) : fallback).split(",").filter(Boolean);
    return `${key === "POOL_ADMIN" ? "Admins" : "Clients"}: ${emails.length} (${emails.join(", ")})`;
  };
  return [
    pool("POOL_ADMIN", "admin1@drivenow.test,admin2@drivenow.test,admin3@drivenow.test"),
    pool("POOL_CLIENT", Array.from({ length: 6 }, (_, i) => `client${i + 1}@drivenow.test`).join(",")),
  ];
}

export async function checkEnvironment(): Promise<EnvironmentReport> {
  const base = env.platformUrl.replace(/\/$/, "");
  const health = await getJson(`${base}/health`);
  const ready = await getJson(`${base}/health/ready`);
  const report: EnvironmentReport = {
    checkedAt: new Date().toISOString(),
    platformUrl: base,
    reachable: health?.status === 200,
    ready: ready?.status === 200,
    checks: (ready?.body.checks as Record<string, string>) ?? {},
    version: health?.body.version as string | undefined,
    commit: health?.body.commit as string | undefined,
    accounts: accountPools(),
    notRun: [],
    warnings: [],
  };
  const seededAt = ready?.body.seededAt as string | undefined;
  if (seededAt) {
    report.seedAgeDays = Math.floor((Date.now() - new Date(seededAt).getTime()) / 86_400_000);
    if (report.seedAgeDays > SEED_WARNING_DAYS) {
      report.warnings.push(`The seed data is ${report.seedAgeDays} days old. Reseed the platform if tests fail on missing data.`);
    }
  }
  if (!report.reachable) report.warnings.push(`DriveNow does not answer at ${base}.`);
  else if (!report.ready) {
    const failing = Object.entries(report.checks).filter(([, value]) => value !== "ok").map(([name]) => name);
    report.warnings.push(`DriveNow is up but not ready: ${failing.join(", ") || "unknown dependency"}.`);
  }
  return report;
}
