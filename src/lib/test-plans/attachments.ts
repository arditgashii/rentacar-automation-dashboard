// Attachment files live in storage/attachments/<attachment id><extension>. Only the id from the
// database is ever used to build a path, never the uploaded name.

import "server-only";

import path from "node:path";

import { env } from "@/lib/env";

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".har": "application/json",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const attachmentsDir = () => path.join(env.storageDir, "attachments");

export function attachmentPath(storedName: string): string {
  return path.join(attachmentsDir(), path.basename(storedName));
}

/** "../x.png" or "a\b" become a plain file name for the download header. */
export function safeFilename(name: string): string {
  return path.basename(name.replace(/\\/g, "/")).replace(/[^\w.\- ()]/g, "_").slice(0, 150) || "file";
}
