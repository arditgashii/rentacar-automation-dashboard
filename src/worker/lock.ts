// One run at a time. The lock file holds the worker's process id, so a lock left behind by a worker
// that crashed is recognised and released instead of blocking every future run.

import fs from "node:fs";
import path from "node:path";

import { env } from "@/lib/env";

const LOCK = path.join(env.storageDir, "run.lock");

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Takes the lock for this process; false when another living worker holds it. */
export function acquireLock(runId: string): boolean {
  fs.mkdirSync(env.storageDir, { recursive: true });
  try {
    const held = JSON.parse(fs.readFileSync(LOCK, "utf8")) as { pid: number; runId: string };
    if (held.pid !== process.pid && alive(held.pid)) return false;
  } catch {
    // no lock file, or an unreadable one: free
  }
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, runId, at: new Date().toISOString() }));
  return true;
}

export function releaseLock(): void {
  fs.rmSync(LOCK, { force: true });
}
