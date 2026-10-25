// Keeps the test catalog in the database fresh: it is read again whenever a file under tests/ changes.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { readCatalog, writeState } from "@/lib/automation/state";
import type { CatalogTest } from "@/lib/automation/types";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const run = promisify(execFile);
let lastSignature = "";

/** File names and modification times of everything that defines the tests. */
function signature(): string {
  const parts: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "__pycache__") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".py")) parts.push(`${full}:${fs.statSync(full).mtimeMs}`);
    }
  };
  for (const dir of ["tests", "plugins"]) {
    const full = path.join(env.qaRepo, dir);
    if (fs.existsSync(full)) walk(full);
  }
  const conftest = path.join(env.qaRepo, "conftest.py");
  if (fs.existsSync(conftest)) parts.push(`conftest:${fs.statSync(conftest).mtimeMs}`);
  return parts.sort().join("|");
}

export async function refreshCatalog(force = false): Promise<void> {
  let current: string;
  try {
    current = signature();
  } catch (error) {
    await saveError(`Cannot read the QA repo at ${env.qaRepo}: ${(error as Error).message}`);
    return;
  }
  if (!force && current === lastSignature) return;

  const out = path.join(os.tmpdir(), `qahub-catalog-${process.pid}.json`);
  try {
    await run(env.qaPython, ["-m", "pytest", "--collect-only", "-q", "-p", "no:randomly", `--dashboard-catalog=${out}`], {
      cwd: env.qaRepo,
      timeout: 120_000,
      windowsHide: true,
    });
    const { tests } = JSON.parse(fs.readFileSync(out, "utf8")) as { tests: CatalogTest[] };
    await writeState(db, "catalog", { generatedAt: new Date().toISOString(), tests });
    lastSignature = current;
    console.log(`[catalog] ${tests.length} tests`);
  } catch (error) {
    await saveError(`Could not read the tests: ${(error as Error).message.split("\n")[0]}`);
  } finally {
    fs.rmSync(out, { force: true });
  }
}

async function saveError(message: string): Promise<void> {
  const previous = await readCatalog(db);
  await writeState(db, "catalog", { ...previous, error: message });
  console.error(`[catalog] ${message}`);
}
