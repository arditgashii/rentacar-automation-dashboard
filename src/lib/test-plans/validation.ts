// Request schemas for the Test Plans API. Every object is strict: unknown fields are refused.

import { z } from "zod";

import { appId } from "@/lib/automation/validation";
import { AUTOMATION, PRIORITIES, STATES, TYPES } from "./model";

const name = (what: string) => z.string().trim().min(1, `Give the ${what} a name.`).max(120);

export const ProjectSchema = z.strictObject({ name: name("project") });

export const NewNodeSchema = z.strictObject({
  projectId: appId("prj"),
  // null adds a suite to the project, a node id adds a folder inside it
  parentId: appId("nod").nullable(),
  name: name("item"),
});

export const NodeChangeSchema = z.union([
  z.strictObject({ name: name("item") }),
  z.strictObject({ move: z.enum(["up", "down"]) }),
]);

const text = (max: number) => z.string().max(max);

export const CaseSchema = z.strictObject({
  nodeId: appId("nod"),
  title: z.string().trim().min(1, "Give the test case a title.").max(300),
  state: z.enum(STATES),
  priority: z.enum(PRIORITIES),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  description: text(10_000),
  preconditions: text(5_000),
  steps: z.array(z.strictObject({ action: text(2_000), expected: text(2_000) })).max(100),
  type: z.enum(TYPES),
  automation: z.enum(AUTOMATION),
  automatedTest: text(400),
});

export type CaseInput = z.infer<typeof CaseSchema>;

export const BulkDeleteSchema = z.strictObject({ ids: z.array(appId("tcs")).min(1).max(500) });

export const RestoreSchema = z.strictObject({ batch: appId("del") });

// The export file. Ids are not kept: an import always adds new projects.
const ExportCase = z.strictObject({
  number: z.number().int().min(1).max(1_000_000),
  title: z.string().trim().min(1).max(300),
  state: z.enum(STATES),
  priority: z.enum(PRIORITIES),
  tags: z.array(z.string().max(40)).max(20),
  description: text(10_000),
  preconditions: text(5_000),
  steps: z.array(z.strictObject({ action: text(2_000), expected: text(2_000) })).max(100),
  type: z.enum(TYPES),
  automation: z.enum(AUTOMATION),
  automatedTest: text(400),
});

export type ExportNode = { name: string; cases: z.infer<typeof ExportCase>[]; folders: ExportNode[] };

const ExportNodeSchema: z.ZodType<ExportNode> = z.lazy(() =>
  z.strictObject({ name: z.string().trim().min(1).max(120), cases: z.array(ExportCase).max(5_000), folders: z.array(ExportNodeSchema).max(500) }),
);

export const ExportSchema = z.strictObject({
  format: z.literal("drivenow-test-plans"),
  version: z.literal(1),
  exportedAt: z.string().max(40),
  projects: z
    .array(z.strictObject({ name: z.string().trim().min(1).max(120), nextNumber: z.number().int().min(1).max(1_000_001), suites: z.array(ExportNodeSchema).max(500) }))
    .max(50),
});

export type ExportFile = z.infer<typeof ExportSchema>;
