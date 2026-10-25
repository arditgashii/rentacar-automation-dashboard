// Request schemas for the automation API. Every object is strict: unknown fields are refused.

import { z } from "zod";

// Paths and node ids come from the catalog; anything with "..", a backslash or an absolute path is refused.
const testPath = z
  .string()
  .max(400)
  .regex(/^tests\/[A-Za-z0-9_\-/]+\.py$/, "Not a test file.");
const nodeid = z
  .string()
  .max(500)
  .regex(/^tests\/[A-Za-z0-9_\-/]+\.py::[A-Za-z0-9_\-[\].]+$/, "Not a test id.");
const segment = z.string().max(120).regex(/^[a-z0-9_\-/]+$/, "Not a valid name.");

export const appId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[0-9a-z]{10}$`), "Not a valid id.");

export const SelectionItemSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("module"), module: segment }),
  z.strictObject({ kind: z.literal("feature"), module: segment, feature: segment }),
  z.strictObject({ kind: z.literal("file"), file: testPath }),
  z.strictObject({ kind: z.literal("test"), nodeid }),
]);

export const TargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("tests"), selection: z.array(SelectionItemSchema).min(1, "Choose what to run.").max(200) }),
  z.strictObject({ kind: z.literal("suite"), suiteId: appId("ste"), suiteName: z.string().max(80) }),
]);

export const TestSetSchema = z.enum(["smoke", "full"]);

export const PreviewSchema = z.strictObject({
  target: TargetSchema,
  testSet: TestSetSchema,
  includeCostly: z.boolean(),
});

export const NewRunSchema = PreviewSchema.extend({ headed: z.boolean(), watch: z.boolean() }).strict();

export const SuiteItemsSchema = z.strictObject({
  include: z.array(SelectionItemSchema).max(500),
  exclude: z.array(nodeid).max(500),
});

export const SuiteSchema = z.strictObject({
  name: z.string().trim().min(1, "Give the suite a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(500).default(""),
  items: SuiteItemsSchema,
});

export const ScheduleSchema = z.strictObject({
  name: z.string().trim().min(1, "Give the schedule a name.").max(80, "Keep the name under 80 characters."),
  target: TargetSchema,
  testSet: TestSetSchema,
  includeCostly: z.boolean(),
  repeat: z.enum(["off", "today", "weekdays", "daily", "weekly", "biweekly", "custom"]),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time."),
  teamsChannelId: appId("chn").nullable(),
  teamsMode: z.enum(["every", "failures"]),
  teamsBugReports: z.boolean(),
});

export const ChannelSchema = z.strictObject({
  name: z.string().trim().min(1, "Give the channel a name.").max(60),
  // Empty on edit means "keep the saved link".
  webhookUrl: z.string().trim().max(2000),
});

export const TeamsSettingsSchema = z.strictObject({
  twoChannels: z.boolean(),
  resultsChannelId: appId("chn").nullable(),
  bugsChannelId: appId("chn").nullable(),
  resultsTemplate: z.string().max(4000),
  bugTemplate: z.string().max(4000),
  morningEnabled: z.boolean(),
  morningChannelId: appId("chn").nullable(),
});

export { nodeid as NodeIdSchema, testPath as TestPathSchema };
