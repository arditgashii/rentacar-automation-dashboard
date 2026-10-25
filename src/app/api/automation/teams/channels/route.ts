import { sql } from "drizzle-orm";

import { isTeamsWebhook } from "@/lib/automation/teams";
import { ChannelSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { newId } from "@/lib/ids";

export const POST = route(async (request: Request) => {
  await requireApi("settings", "write");
  const body = await readBody(request, ChannelSchema);
  if (!isTeamsWebhook(body.webhookUrl, env.allowLocalWebhook)) {
    return errorResponse(400, "Paste the link of a Teams workflow (it ends in webhook.office.com, logic.azure.com or powerplatform.com).");
  }
  const taken = await db.query.teamsChannels.findFirst({ where: sql`lower(${schema.teamsChannels.name}) = ${body.name.toLowerCase()}` });
  if (taken) return errorResponse(409, `A channel named "${taken.name}" already exists.`);
  const id = newId("chn");
  await db.insert(schema.teamsChannels).values({ id, name: body.name, webhookUrl: body.webhookUrl });
  return json({ id }, 201);
});
