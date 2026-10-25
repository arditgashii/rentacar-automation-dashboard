CREATE TABLE "app_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reg_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"user_id" text,
	"field" text NOT NULL,
	"old_value" text DEFAULT '' NOT NULL,
	"new_value" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reg_items" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"library_id" text,
	"parent_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"jira" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"result" text DEFAULT 'not_tested' NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"removed_from_library" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reg_library" (
	"id" text PRIMARY KEY NOT NULL,
	"team" text NOT NULL,
	"parent_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"removed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reg_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"team" text NOT NULL,
	"environment" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"started_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_by" text,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "run_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"nodeid" text NOT NULL,
	"test_case_id" text,
	"title" text NOT NULL,
	"module" text NOT NULL,
	"feature" text NOT NULL,
	"role" text NOT NULL,
	"file" text NOT NULL,
	"markers" text[] DEFAULT '{}'::text[] NOT NULL,
	"outcome" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error_type" text,
	"error_message" text,
	"failure_type" text,
	"known_bug" text,
	"failing_since" timestamp with time zone,
	"culprits" jsonb,
	"steps" jsonb,
	"media" jsonb,
	"is_setup" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"number" serial NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"trigger" text NOT NULL,
	"options" jsonb NOT NULL,
	"schedule_id" text,
	"suite_id" text,
	"rerun_of" text,
	"queue_position" integer,
	"stop_requested" boolean DEFAULT false NOT NULL,
	"command" text DEFAULT '' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"flaky" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"known_bug" integer DEFAULT 0 NOT NULL,
	"progress" jsonb,
	"environment_report" jsonb,
	"platform_commit" text,
	"error_message" text,
	"media_deleted" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'real' NOT NULL,
	"created_by" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "runs_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"target" jsonb NOT NULL,
	"repeat" text NOT NULL,
	"days" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"time" text NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"next_run_at" timestamp with time zone,
	"missed_at" timestamp with time zone,
	"last_run_id" text,
	"teams_channel_id" text,
	"teams_mode" text DEFAULT 'every' NOT NULL,
	"teams_bug_reports" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suites" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"items" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"webhook_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"two_channels" boolean DEFAULT false NOT NULL,
	"results_channel_id" text,
	"bugs_channel_id" text,
	"results_template" text,
	"bug_template" text,
	"morning_enabled" boolean DEFAULT false NOT NULL,
	"morning_channel_id" text,
	"morning_last_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tp_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"stored_name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tp_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"preconditions" text DEFAULT '' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"type" text DEFAULT 'functional' NOT NULL,
	"automation" text DEFAULT 'not_automated' NOT NULL,
	"automated_test" text DEFAULT '' NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_batch" text
);
--> statement-breakpoint
CREATE TABLE "tp_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"parent_id" text,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_batch" text
);
--> statement-breakpoint
CREATE TABLE "tp_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_batch" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "reg_history" ADD CONSTRAINT "reg_history_item_id_reg_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."reg_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reg_items" ADD CONSTRAINT "reg_items_run_id_reg_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reg_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_tests" ADD CONSTRAINT "run_tests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tp_attachments" ADD CONSTRAINT "tp_attachments_case_id_tp_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."tp_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tp_cases" ADD CONSTRAINT "tp_cases_project_id_tp_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tp_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tp_cases" ADD CONSTRAINT "tp_cases_node_id_tp_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."tp_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tp_nodes" ADD CONSTRAINT "tp_nodes_project_id_tp_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."tp_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reg_history_item_idx" ON "reg_history" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "reg_items_run_idx" ON "reg_items" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "reg_library_team_idx" ON "reg_library" USING btree ("team");--> statement-breakpoint
CREATE UNIQUE INDEX "reg_runs_key" ON "reg_runs" USING btree ("kind","team","environment","name_key");--> statement-breakpoint
CREATE INDEX "run_tests_run_idx" ON "run_tests" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_tests_nodeid_idx" ON "run_tests" USING btree ("nodeid");--> statement-breakpoint
CREATE INDEX "runs_status_idx" ON "runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "runs_queued_at_idx" ON "runs" USING btree ("queued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suites_name_key" ON "suites" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "teams_channels_name_key" ON "teams_channels" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "tp_cases_project_number_key" ON "tp_cases" USING btree ("project_id","number");--> statement-breakpoint
CREATE INDEX "tp_cases_node_idx" ON "tp_cases" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "tp_nodes_project_idx" ON "tp_nodes" USING btree ("project_id");