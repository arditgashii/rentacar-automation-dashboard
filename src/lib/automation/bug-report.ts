// A readable bug report for a failed test: plain sentences, the test's own steps, no locators.

import { label } from "./catalog";
import { firstLine } from "./failure";
import { type CulpritCommit, FAILURE_TYPE_LABELS, type FailureType, type TestStep } from "./types";

export type BugReportInput = {
  testCaseId: string | null;
  title: string;
  module: string;
  feature: string;
  role: string;
  failureType: FailureType;
  errorMessage: string | null;
  steps: TestStep[] | null;
  culprits: CulpritCommit[] | null;
  knownBug: string | null;
};

export type BugReport = {
  title: string;
  testCase: string;
  failureType: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  commits: string;
};

const EXPECTED_GOT = /expected (.+?),\s*got (.+?)(?:[.;(]|$)/i;
// Playwright locators and internals that mean nothing to a reader
const TECHNICAL = /(get_by_test_id|locator\(|page\.|\[data-testid|Call log:|waiting for).*/gi;

function cleaned(message: string): string {
  return firstLine(message.replace(TECHNICAL, "").replace(/\s+/g, " "), 300);
}

export function buildBugReport(input: BugReportInput): BugReport {
  const where = `${label(input.module)} / ${label(input.feature)}`;
  const message = input.errorMessage ?? "";
  const match = EXPECTED_GOT.exec(message);
  const failedAt = input.steps?.find((step) => step.failed)?.title;
  const steps = (input.steps ?? []).map((step, index) => `${index + 1}. ${step.title}${step.failed ? " (fails here)" : ""}`);
  const summary = cleaned(message) || "The test failed without a message.";
  return {
    title: `${where}: ${input.title}${failedAt ? `, fails at "${failedAt}"` : ""}`,
    testCase: input.testCaseId ?? "no ID",
    failureType: FAILURE_TYPE_LABELS[input.failureType] + (input.knownBug ? ` (${input.knownBug})` : ""),
    description: `As ${input.role.replace(/-/g, " ")}, in ${where}: ${summary}`,
    steps: steps.join("\n") || "1. Run the test",
    expected: match ? match[1].trim() : failedAt ? `"${failedAt}" passes` : "The test passes",
    actual: match ? match[2].trim() : summary,
    commits:
      input.culprits && input.culprits.length > 0
        ? input.culprits.map((c) => `${c.sha.slice(0, 7)} ${c.message} (${c.author})`).join("\n")
        : "",
  };
}

/** The bug report as one block of text, for "Copy bug report". */
export function bugReportText(report: BugReport): string {
  return [
    `Title: ${report.title}`,
    `Test case: ${report.testCase}`,
    `Failure type: ${report.failureType}`,
    "",
    `Description: ${report.description}`,
    "",
    "Steps:",
    report.steps,
    "",
    `Expected: ${report.expected}`,
    `Actual: ${report.actual}`,
    ...(report.commits ? ["", "Commits since it last passed:", report.commits] : []),
  ].join("\n");
}
