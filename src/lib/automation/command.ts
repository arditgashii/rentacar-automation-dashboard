// Turns a selection into the pytest arguments the worker runs and the command the dashboard shows.

import type { SelectionItem, TestSet } from "./types";

export const MAX_WORKERS = 3;

export function markerExpression(testSet: TestSet, includeCostly: boolean): string {
  const parts = [testSet === "smoke" ? "smoke" : "", includeCostly ? "" : "not costly"].filter(Boolean);
  return parts.join(" and ");
}

function pathOf(item: SelectionItem): string {
  switch (item.kind) {
    case "module":
      return `tests/${item.module}`;
    case "feature":
      return `tests/${item.module}/${item.feature}`;
    case "file":
      return item.file;
    case "test":
      return item.nodeid;
  }
}

/**
 * The pytest arguments for a selection. Paths come first, then the marker filter and the tests that
 * are left out. `extra` holds the arguments the worker adds (report folder, retries, workers).
 */
export function pytestArgs(input: {
  selection: SelectionItem[];
  exclude: string[];
  testSet: TestSet;
  includeCostly: boolean;
  testCount: number;
  watch: boolean;
  headed: boolean;
  retries: number;
}): string[] {
  const args = input.selection.map(pathOf);
  const markers = markerExpression(input.testSet, input.includeCostly);
  if (markers) args.push("-m", markers);
  for (const nodeid of input.exclude) args.push("--deselect", nodeid);
  const workers = input.watch ? 0 : Math.min(MAX_WORKERS, Math.max(1, input.testCount));
  if (workers > 1) args.push("-n", String(workers));
  if (input.retries > 0) args.push("--reruns", String(input.retries));
  if (input.headed) args.push("--headed");
  return args;
}

/** The command as a person would type it, quoting arguments with spaces. No secrets are ever part of it. */
export function displayCommand(args: string[]): string {
  return ["pytest", ...args.map((arg) => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg))].join(" ");
}
