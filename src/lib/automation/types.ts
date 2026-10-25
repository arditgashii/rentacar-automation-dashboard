// Types shared by the web app and the worker.

/** One test as the catalog of the QA repo describes it. */
export type CatalogTest = {
  nodeid: string;
  file: string;
  module: string;
  feature: string;
  role: string;
  testCaseId: string | null;
  title: string;
  markers: string[];
  line: number;
};

export type Catalog = {
  generatedAt: string;
  tests: CatalogTest[];
  // Set when the last refresh failed; the previous tests stay usable.
  error?: string;
};

/** What a run, a schedule or a suite points at. Modules and features run whatever they hold at run time. */
export type SelectionItem =
  | { kind: "module"; module: string }
  | { kind: "feature"; module: string; feature: string }
  | { kind: "file"; file: string }
  | { kind: "test"; nodeid: string };

export type TestSet = "smoke" | "full";

export type RunTarget =
  | { kind: "tests"; selection: SelectionItem[] }
  | { kind: "suite"; suiteId: string; suiteName: string };

export type RunOptions = {
  environment: "local";
  target: RunTarget;
  testSet: TestSet;
  includeCostly: boolean;
  // Opens the browser window on this computer while the UI tests run.
  headed: boolean;
  // Watch live in the dashboard: one worker, so the progress follows one test at a time.
  watch: boolean;
  // Extra attempts for a failing test. Scheduled runs retry twice, Run now never.
  retries: number;
};

export type ScheduleTarget = Pick<RunOptions, "target" | "testSet" | "includeCostly">;

export type SuiteItems = {
  include: SelectionItem[];
  // Tests left out of an included module, feature or file ("1 test left out").
  exclude: string[];
};

export type RunProgress = {
  total: number;
  done: number;
  passed: number;
  failed: number;
  skipped: number;
  current?: string;
  pid?: number;
};

export type EnvironmentReport = {
  checkedAt: string;
  platformUrl: string;
  reachable: boolean;
  ready: boolean;
  checks: Record<string, string>;
  version?: string;
  commit?: string;
  seedAgeDays?: number;
  accounts: string[];
  notRun: string[];
  warnings: string[];
};

export type TestStep = { title: string; failed: boolean };

export type TestMedia = { screenshots: string[]; video?: string; trace?: string };

export type CulpritCommit = { sha: string; message: string; author: string; date: string; url: string };

export type FailureType = "product" | "test" | "environment" | "known_bug";

export const FAILURE_TYPE_LABELS: Record<FailureType, string> = {
  product: "Product bug",
  test: "Test issue",
  environment: "Environment",
  known_bug: "Known bug",
};

export type RunStatus = "queued" | "running" | "passed" | "failed" | "stopped" | "error" | "not_ready";
export type TestOutcome = "passed" | "failed" | "skipped" | "flaky" | "known_bug";
export type Repeat = "off" | "today" | "weekdays" | "daily" | "weekly" | "biweekly" | "custom";
