import { asc, eq } from "drizzle-orm";

import { DEFAULT_TEMPLATES, maskWebhook, validateTemplate } from "@/lib/automation/teams";
import { TeamsSettingsSchema } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

/** Channels (links masked, they never reach the browser), templates and the morning summary. */
export const GET = route(async () => {
  await requireApi("settings");
  const channels = await db.select().from(schema.teamsChannels).orderBy(asc(schema.teamsChannels.name));
  const schedules = await db.select({ name: schema.schedules.name, channel: schema.schedules.teamsChannelId }).from(schema.schedules);
  const settings = await db.query.teamsSettings.findFirst();
  return json({
    channels: channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      webhook: maskWebhook(channel.webhookUrl),
      usedBy: schedules.filter((s) => s.channel === channel.id).map((s) => s.name),
    })),
    settings: {
      twoChannels: settings?.twoChannels ?? false,
      resultsChannelId: settings?.resultsChannelId ?? null,
      bugsChannelId: settings?.bugsChannelId ?? null,
      resultsTemplate: settings?.resultsTemplate || DEFAULT_TEMPLATES.results,
      bugTemplate: settings?.bugTemplate || DEFAULT_TEMPLATES.bug,
      morningEnabled: settings?.morningEnabled ?? false,
      morningChannelId: settings?.morningChannelId ?? null,
    },
    defaults: DEFAULT_TEMPLATES,
  });
});

export const PUT = route(async (request: Request) => {
  await requireApi("settings", "write");
  const body = await readBody(request, TeamsSettingsSchema);
  const problems = [...validateTemplate("results", body.resultsTemplate), ...validateTemplate("bug", body.bugTemplate)];
  if (problems.length) return errorResponse(400, problems[0]);
  if (body.morningEnabled && !body.morningChannelId) return errorResponse(400, "Choose a channel for the morning summary.");
  if (body.twoChannels && (!body.resultsChannelId || !body.bugsChannelId)) return errorResponse(400, "Choose both channels.");
  const existing = await db.query.teamsSettings.findFirst();
  if (existing) await db.update(schema.teamsSettings).set(body).where(eq(schema.teamsSettings.id, 1));
  else await db.insert(schema.teamsSettings).values({ id: 1, ...body });
  return json({ ok: true });
});
