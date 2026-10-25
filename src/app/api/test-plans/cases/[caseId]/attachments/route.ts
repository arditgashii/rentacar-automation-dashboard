import fs from "node:fs";
import path from "node:path";

import { errorResponse, json, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { ATTACHMENT_TYPES, attachmentPath, attachmentsDir, MAX_ATTACHMENT_BYTES, safeFilename } from "@/lib/test-plans/attachments";
import { idFrom, liveCase } from "@/lib/test-plans/data";

/** One or more files in the "files" field, at most 25 MB each. The test case must be saved already. */
export const POST = route(async (request: Request, context: { params: Promise<{ caseId: string }> }) => {
  const user = await requireApi("testPlans", "write");
  const current = await liveCase(await idFrom(context.params, "caseId", "tcs"));
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "Send the files as a form upload.");
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return errorResponse(400, "Choose at least one file.");
  if (files.length > 10) return errorResponse(400, "Add at most 10 files at once.");
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ATTACHMENT_TYPES[ext]) return errorResponse(400, `${safeFilename(file.name)}: this file type is not allowed.`);
    if (file.size > MAX_ATTACHMENT_BYTES) return errorResponse(400, `${safeFilename(file.name)} is larger than 25 MB.`);
    if (file.size === 0) return errorResponse(400, `${safeFilename(file.name)} is empty.`);
  }
  await fs.promises.mkdir(attachmentsDir(), { recursive: true });
  const added = [];
  for (const file of files) {
    const id = newId("att");
    const ext = path.extname(file.name).toLowerCase();
    const storedName = `${id}${ext}`;
    await fs.promises.writeFile(attachmentPath(storedName), Buffer.from(await file.arrayBuffer()));
    const row = { id, caseId: current.id, filename: safeFilename(file.name), mime: ATTACHMENT_TYPES[ext], size: file.size, storedName, createdBy: user.id };
    await db.insert(schema.tpAttachments).values(row);
    added.push({ id, filename: row.filename, mime: row.mime, size: row.size });
  }
  return json({ added }, 201);
});
