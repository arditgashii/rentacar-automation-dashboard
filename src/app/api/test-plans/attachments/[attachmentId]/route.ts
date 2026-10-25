import fs from "node:fs";

import { eq } from "drizzle-orm";

import { errorResponse, json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { attachmentPath } from "@/lib/test-plans/attachments";
import { idFrom } from "@/lib/test-plans/data";

type Context = { params: Promise<{ attachmentId: string }> };

async function find(context: Context) {
  const id = await idFrom(context.params, "attachmentId", "att");
  return db.query.tpAttachments.findFirst({ where: eq(schema.tpAttachments.id, id) });
}

/** Images open inline (for the preview); everything else downloads. */
export const GET = route(async (_request: Request, context: Context) => {
  await requireApi("testPlans");
  const row = await find(context);
  const file = row && attachmentPath(row.storedName);
  if (!row || !file || !fs.existsSync(file)) return errorResponse(404, "This file was removed.");
  const inline = row.mime.startsWith("image/");
  return new Response(await fs.promises.readFile(file), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${row.filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("testPlans", "write");
  const row = await find(context);
  if (!row) return errorResponse(404, "This file was removed.");
  await db.delete(schema.tpAttachments).where(eq(schema.tpAttachments.id, row.id));
  await fs.promises.rm(attachmentPath(row.storedName), { force: true });
  return json({ ok: true });
});
