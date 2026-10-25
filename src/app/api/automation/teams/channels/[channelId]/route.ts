import { and, eq, ne, or, sql } from "drizzle-orm";

import { isTeamsWebhook } from "@/lib/automation/teams";
import { appId, ChannelSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

type Context = { params: Promise<{ channelId: string }> };

async function channelFrom(context: Context) {
  const parsed = appId("chn").safeParse((await context.params).channelId);
  return parsed.success ? db.query.teamsChannels.findFirst({ where: eq(schema.teamsChannels.id, parsed.data) }) : undefined;
}

/** Edit: an empty link keeps the saved one. */
export const PUT = route(async (request: Request, context: Context) => {
  await requireApi("settings", "write");
  const channel = await channelFrom(context);
  if (!channel) return errorResponse(404, "Channel not found.");
  const body = await readBody(request, ChannelSchema);
  if (body.webhookUrl && !isTeamsWebhook(body.webhookUrl, env.allowLocalWebhook)) {
    return errorResponse(400, "Paste the link of a Teams workflow (it ends in webhook.office.com, logic.azure.com or powerplatform.com).");
  }
  const taken = await db.query.teamsChannels.findFirst({
    where: and(sql`lower(${schema.teamsChannels.name}) = ${body.name.toLowerCase()}`, ne(schema.teamsChannels.id, channel.id)),
  });
  if (taken) return errorResponse(409, `A channel named "${taken.name}" already exists.`);
  await db
    .update(schema.teamsChannels)
    .set({ name: body.name, webhookUrl: body.webhookUrl || channel.webhookUrl, updatedAt: new Date() })
    .where(eq(schema.teamsChannels.id, channel.id));
  return json({ ok: true });
});

/** Refused while a schedule or the settings use the channel. */
export const DELETE = route(async (_request: Request, context: Context) => {
  await requireApi("settings", "write");
  const channel = await channelFrom(context);
  if (!channel) return errorResponse(404, "Channel not found.");
  const usedBy = await db.select({ name: schema.schedules.name }).from(schema.schedules).where(eq(schema.schedules.teamsChannelId, channel.id));
  if (usedBy.length) return errorResponse(409, `Used by ${usedBy.map((s) => s.name).join(", ")}. Change those schedules first.`);
  const settings = await db.query.teamsSettings.findFirst({
    where: or(
      eq(schema.teamsSettings.resultsChannelId, channel.id),
      eq(schema.teamsSettings.bugsChannelId, channel.id),
      eq(schema.teamsSettings.morningChannelId, channel.id),
    ),
  });
  if (settings) return errorResponse(409, "Used by the Teams settings (two channels or the morning summary). Change them first.");
  await db.delete(schema.teamsChannels).where(eq(schema.teamsChannels.id, channel.id));
  return json({ ok: true });
});
