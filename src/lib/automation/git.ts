// Platform commits from the local checkout of the platform repo (origin/main is fetched first).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { env } from "@/lib/env";
import type { CulpritCommit } from "./types";

const run = promisify(execFile);
let fetchedAt = 0;

function git(args: string[]) {
  return run("git", ["-C", env.platformRepo, ...args], { timeout: 20_000, windowsHide: true });
}

/** Commits after `from` up to `to`, newest first (at most 20). Empty when git or a commit is unknown. */
export async function commitsBetween(from: string, to: string): Promise<CulpritCommit[]> {
  if (!/^[0-9a-f]{7,40}$/.test(from) || !/^[0-9a-f]{7,40}$/.test(to) || from === to) return [];
  try {
    if (Date.now() - fetchedAt > 5 * 60_000) {
      await git(["fetch", "-q", "origin", "main"]).catch(() => undefined);
      fetchedAt = Date.now();
    }
    const { stdout } = await git(["log", "--max-count=20", "--format=%H%x1f%s%x1f%an%x1f%aI", `${from}..${to}`]);
    return stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, message, author, date] = line.split("\x1f");
        return { sha, message, author, date, url: `${env.platformGithubUrl}/commit/${sha}` };
      });
  } catch {
    return [];
  }
}
