// Request schemas for the Manual Regression API. Every object is strict: unknown fields are refused.

import { z } from "zod";

import { ENVIRONMENTS, KINDS, TEAMS } from "./library";
import { SPRINT_KINDS } from "./model";

export const KindSchema = z.enum(KINDS.map((k) => k.key) as [(typeof KINDS)[number]["key"], ...(typeof KINDS)[number]["key"][]]);
export const TeamSchema = z.enum(TEAMS);
export const EnvironmentSchema = z.enum(ENVIRONMENTS);

export const RunQuerySchema = z.strictObject({ kind: KindSchema, team: TeamSchema, environment: EnvironmentSchema });

export const NewRunSchema = z.strictObject({
  kind: KindSchema,
  team: TeamSchema,
  environment: EnvironmentSchema,
  name: z.string().trim().min(1, "Give the release or sprint a name.").max(60),
});

const name = z.string().trim().min(1, "Give it a name.").max(200);

export const ItemChangeSchema = z
  .strictObject({
    result: z.enum(["not_tested", "passed", "failed", "blocked"]).optional(),
    comment: z.string().max(2000).optional(),
    name: name.optional(),
    jira: z.string().trim().max(300).optional(),
    kind: z.enum(SPRINT_KINDS).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Nothing to change.");

export const NewItemSchema = z.strictObject({
  kind: z.enum(["module", "feature", "function", ...SPRINT_KINDS]),
  parentId: z
    .string()
    .regex(/^itm_[0-9a-z]{10}$/, "Not a valid id.")
    .nullable(),
  name,
  jira: z.string().trim().max(300).default(""),
  alsoLibrary: z.boolean().default(false),
});
