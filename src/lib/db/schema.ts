import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type {
  EnvironmentReport,
  RunOptions,
  RunProgress,
  ScheduleTarget,
  SuiteItems,
  TestMedia,
  TestStep,
  CulpritCommit,
} from "@/lib/automation/types";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// People and access

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  // null = not a member: the account exists but sees the No access page
  role: text("role").$type<"admin" | "editor" | "viewer">(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Automation Tests

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    number: serial("number").notNull().unique(),
    name: text("name").notNull(),
    status: text("status")
      .$type<"queued" | "running" | "passed" | "failed" | "stopped" | "error" | "not_ready">()
      .notNull(),
    trigger: text("trigger").$type<"on_demand" | "scheduled">().notNull(),
    options: jsonb("options").$type<RunOptions>().notNull(),
    scheduleId: text("schedule_id"),
    suiteId: text("suite_id"),
    rerunOf: text("rerun_of"),
    queuePosition: integer("queue_position"),
    stopRequested: boolean("stop_requested").notNull().default(false),
    command: text("command").notNull().default(""),
    total: integer("total").notNull().default(0),
    passed: integer("passed").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    flaky: integer("flaky").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    knownBug: integer("known_bug").notNull().default(0),
    progress: jsonb("progress").$type<RunProgress>(),
    environmentReport: jsonb("environment_report").$type<EnvironmentReport>(),
    platformCommit: text("platform_commit"),
    errorMessage: text("error_message"),
    mediaDeleted: boolean("media_deleted").notNull().default(false),
    // "seed" marks the generated demo history, "real" a run that executed pytest
    source: text("source").$type<"real" | "seed">().notNull().default("real"),
    createdBy: text("created_by"),
    queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("runs_status_idx").on(t.status), index("runs_queued_at_idx").on(t.queuedAt)],
);

export const runTests = pgTable(
  "run_tests",
  {
    id: serial("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    nodeid: text("nodeid").notNull(),
    testCaseId: text("test_case_id"),
    title: text("title").notNull(),
    module: text("module").notNull(),
    feature: text("feature").notNull(),
    role: text("role").notNull(),
    file: text("file").notNull(),
    markers: text("markers").array().notNull().default(sql`'{}'::text[]`),
    outcome: text("outcome")
      .$type<"passed" | "failed" | "skipped" | "flaky" | "known_bug">()
      .notNull(),
    attempts: integer("attempts").notNull().default(1),
    durationMs: integer("duration_ms").notNull().default(0),
    errorType: text("error_type"),
    errorMessage: text("error_message"),
    failureType: text("failure_type").$type<"product" | "test" | "environment" | "known_bug">(),
    knownBug: text("known_bug"),
    failingSince: timestamp("failing_since", { withTimezone: true }),
    culprits: jsonb("culprits").$type<CulpritCommit[]>(),
    steps: jsonb("steps").$type<TestStep[]>(),
    media: jsonb("media").$type<TestMedia>(),
    isSetup: boolean("is_setup").notNull().default(false),
  },
  (t) => [index("run_tests_run_idx").on(t.runId), index("run_tests_nodeid_idx").on(t.nodeid)],
);

export const suites = pgTable(
  "suites",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    items: jsonb("items").$type<SuiteItems>().notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("suites_name_key").on(sql`lower(${t.name})`)],
);

export const schedules = pgTable("schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  target: jsonb("target").$type<ScheduleTarget>().notNull(),
  repeat: text("repeat")
    .$type<"off" | "today" | "weekdays" | "daily" | "weekly" | "biweekly" | "custom">()
    .notNull(),
  days: integer("days").array().notNull().default(sql`'{}'::integer[]`),
  time: text("time").notNull(),
  paused: boolean("paused").notNull().default(false),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  missedAt: timestamp("missed_at", { withTimezone: true }),
  lastRunId: text("last_run_id"),
  teamsChannelId: text("teams_channel_id"),
  teamsMode: text("teams_mode").$type<"every" | "failures">().notNull().default("every"),
  teamsBugReports: boolean("teams_bug_reports").notNull().default(false),
  createdBy: text("created_by"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const teamsChannels = pgTable(
  "teams_channels",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // Server only. Never sent to the browser or written to a log.
    webhookUrl: text("webhook_url").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("teams_channels_name_key").on(sql`lower(${t.name})`)],
);

export const teamsSettings = pgTable("teams_settings", {
  id: integer("id").primaryKey().default(1),
  twoChannels: boolean("two_channels").notNull().default(false),
  resultsChannelId: text("results_channel_id"),
  bugsChannelId: text("bugs_channel_id"),
  resultsTemplate: text("results_template"),
  bugTemplate: text("bug_template"),
  morningEnabled: boolean("morning_enabled").notNull().default(false),
  morningChannelId: text("morning_channel_id"),
  morningLastSentAt: timestamp("morning_last_sent_at", { withTimezone: true }),
});

// Small shared state written by the worker: the test catalog and the worker heartbeat.
export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// Test Plans

export const tpProjects = pgTable("tp_projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // The next TC number of this project. Numbers are never reused, also after a delete.
  nextNumber: integer("next_number").notNull().default(1),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBatch: text("deleted_batch"),
});

export const tpNodes = pgTable(
  "tp_nodes",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => tpProjects.id),
    // null for a suite at the top of a project; a folder always has a parent
    parentId: text("parent_id"),
    kind: text("kind").$type<"suite" | "folder">().notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBatch: text("deleted_batch"),
  },
  (t) => [index("tp_nodes_project_idx").on(t.projectId)],
);

export const tpCases = pgTable(
  "tp_cases",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => tpProjects.id),
    nodeId: text("node_id")
      .notNull()
      .references(() => tpNodes.id),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    state: text("state").$type<"draft" | "active" | "deprecated">().notNull().default("draft"),
    priority: text("priority").$type<"low" | "medium" | "high" | "critical">().notNull().default("medium"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    description: text("description").notNull().default(""),
    preconditions: text("preconditions").notNull().default(""),
    steps: jsonb("steps").$type<{ action: string; expected: string }[]>().notNull().default([]),
    type: text("type").$type<"functional" | "ui" | "api" | "regression" | "smoke">().notNull().default("functional"),
    automation: text("automation")
      .$type<"not_automated" | "in_progress" | "automated">()
      .notNull()
      .default("not_automated"),
    automatedTest: text("automated_test").notNull().default(""),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBatch: text("deleted_batch"),
  },
  (t) => [uniqueIndex("tp_cases_project_number_key").on(t.projectId, t.number), index("tp_cases_node_idx").on(t.nodeId)],
);

export const tpAttachments = pgTable("tp_attachments", {
  id: text("id").primaryKey(),
  caseId: text("case_id")
    .notNull()
    .references(() => tpCases.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storedName: text("stored_name").notNull(),
  createdBy: text("created_by"),
  createdAt: createdAt(),
});

// Manual Regression

export const regLibrary = pgTable(
  "reg_library",
  {
    id: text("id").primaryKey(),
    team: text("team").notNull(),
    parentId: text("parent_id"),
    kind: text("kind").$type<"module" | "feature" | "function">().notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    removed: boolean("removed").notNull().default(false),
  },
  (t) => [index("reg_library_team_idx").on(t.team)],
);

export const regRuns = pgTable(
  "reg_runs",
  {
    id: text("id").primaryKey(),
    kind: text("kind").$type<"before-release" | "after-release" | "e2e" | "sprint">().notNull(),
    team: text("team").notNull(),
    environment: text("environment").notNull(),
    name: text("name").notNull(),
    // lower-case name, so "v1.2" and "V1.2" open the same run
    nameKey: text("name_key").notNull(),
    status: text("status").$type<"open" | "completed">().notNull().default("open"),
    startedBy: text("started_by"),
    startedAt: createdAt(),
    completedBy: text("completed_by"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("reg_runs_key").on(t.kind, t.team, t.environment, t.nameKey)],
);

export const regItems = pgTable(
  "reg_items",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => regRuns.id, { onDelete: "cascade" }),
    libraryId: text("library_id"),
    parentId: text("parent_id"),
    kind: text("kind").$type<"module" | "feature" | "function" | "story" | "task" | "bug">().notNull(),
    name: text("name").notNull(),
    jira: text("jira").notNull().default(""),
    position: integer("position").notNull().default(0),
    result: text("result").$type<"not_tested" | "passed" | "failed" | "blocked">().notNull().default("not_tested"),
    comment: text("comment").notNull().default(""),
    removedFromLibrary: boolean("removed_from_library").notNull().default(false),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (t) => [index("reg_items_run_idx").on(t.runId)],
);

export const regHistory = pgTable(
  "reg_history",
  {
    id: serial("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => regItems.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    field: text("field").$type<"result" | "comment" | "name" | "jira">().notNull(),
    oldValue: text("old_value").notNull().default(""),
    newValue: text("new_value").notNull().default(""),
    at: createdAt(),
  },
  (t) => [index("reg_history_item_idx").on(t.itemId)],
);
