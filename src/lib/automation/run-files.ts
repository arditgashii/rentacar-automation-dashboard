// Files of a run on disk (log, screenshots, videos, traces), reached only through checked paths.

import path from "node:path";

import { env } from "@/lib/env";

export const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".webm": "video/webm",
  ".zip": "application/zip",
  ".log": "text/plain; charset=utf-8",
};

/** The absolute path of a file inside a run folder, or null when the path tries to leave it. */
export function runFilePath(runId: string, relative: string): string | null {
  if (!/^run_[0-9a-z]{10}$/.test(runId)) return null;
  if (relative.includes("\\") || relative.split("/").some((part) => part === ".." || part === "")) return null;
  if (!CONTENT_TYPES[path.extname(relative).toLowerCase()]) return null;
  const base = path.resolve(env.storageDir, "runs", runId);
  const full = path.resolve(base, relative);
  return full.startsWith(base + path.sep) ? full : null;
}
