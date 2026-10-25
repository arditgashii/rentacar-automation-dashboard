import { eq } from "drizzle-orm";
import { z } from "zod";

import { postToTeams } from "@/lib/automation/teams-send";
import { appId } from "@/lib/automation/validation";
import { errorResponse, json, readBody, route } from "@/lib/api";
import { requireApi } from "@/lib/auth/guards";
import { db, schema } from "@/lib/db";

const Body = z.strictObject({ channelId: appId("chn") });

export const POST = route(async (request: Request) => {
  const user = await requireApi("automation", "write");
  const { channelId } = await readBody(request, Body);
  const channel = await db.query.teamsChannels.findFirst({ where: eq(schema.teamsChannels.id, channelId) });
  if (!channel) return errorResponse(404, "Channel not found.");
  const result = await postToTeams(channel.webhookUrl, `Test message from the DriveNow QA Hub\nSent by ${user.name}. If you can read this, the channel works.`);
  if (!result.ok) return errorResponse(502, `Teams did not accept the message${result.status ? ` (status ${result.status})` : ""}. Check the workflow link.`);
  return json({ ok: true });
});
