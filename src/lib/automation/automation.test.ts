import { describe, expect, it } from "vitest";

import { buildBugReport } from "./bug-report";
import { buildTree, label, resolveTests, summarize } from "./catalog";
import { failureTypeOf } from "./failure";
import { periodRange, validateCustom } from "./period";
import { describeRule, nextRunAt, slotAfter, validateRule } from "./schedule";
import { isTestIncluded, putBack, stateOf, toggle, unavailable } from "./suite-selection";
import { SAMPLE_TESTS } from "./test-catalog";
import type { SuiteItems } from "./types";

const tree = buildTree(SAMPLE_TESTS);
const id = (file: string) => `${file}::test_x`;
const LOGIN = "tests/authentication/login/admin/test_tc_001_a.py";
const LOGOUT = "tests/authentication/logout/client/test_tc_012_b.py";
const CREATE = "tests/fleet/cars/create/client/test_tc_004_c.py";

describe("catalog", () => {
  it("labels path parts", () => {
    expect(label("cars/generate-description")).toBe("Cars / Generate description");
    expect(label("no-login")).toBe("No login");
  });

  it("builds a sorted module, feature, file tree with counts", () => {
    expect(tree.map((m) => [m.label, m.testCount])).toEqual([
      ["Authentication", 2],
      ["Fleet", 3],
    ]);
    expect(tree[1].features.map((f) => f.label)).toEqual(["Cars / Create", "Cars / Generate description", "Cars / Update"]);
  });

  it("resolves a selection with the test set and the LLM credits choice", () => {
    const all = resolveTests(SAMPLE_TESTS, [{ kind: "module", module: "fleet" }], { testSet: "full", includeCostly: false });
    expect(all.map((t) => t.testCaseId)).toEqual(["TC-004", "TC-005"]);
    const withCostly = resolveTests(SAMPLE_TESTS, [{ kind: "module", module: "fleet" }], { testSet: "full", includeCostly: true });
    expect(withCostly).toHaveLength(3);
    const smoke = resolveTests(SAMPLE_TESTS, [{ kind: "feature", module: "fleet", feature: "cars" }], { testSet: "smoke", includeCostly: true });
    expect(smoke.map((t) => t.testCaseId)).toEqual(["TC-004"]);
  });

  it("leaves excluded tests out", () => {
    const tests = resolveTests(SAMPLE_TESTS, [{ kind: "module", module: "authentication" }], {
      exclude: [id(LOGIN)],
      testSet: "full",
      includeCostly: false,
    });
    expect(tests.map((t) => t.testCaseId)).toEqual(["TC-012"]);
  });

  it("summarizes the selection", () => {
    expect(summarize(2, [{ kind: "module", module: "fleet" }], tree)).toBe("2 tests in Fleet (All) on Local");
    expect(summarize(1, [{ kind: "file", file: CREATE }], tree)).toBe("1 test in Fleet (1 selected) on Local");
  });
});

describe("schedule", () => {
  const monday8 = new Date(2026, 9, 26, 8, 0); // Monday 26 Oct 2026, 08:00

  it("finds the next weekday slot", () => {
    const friday = new Date(2026, 9, 30, 23, 0);
    expect(nextRunAt({ repeat: "weekdays", days: [], time: "07:00" }, friday)?.getDay()).toBe(1);
  });

  it("runs today only once, later today", () => {
    expect(nextRunAt({ repeat: "today", days: [], time: "07:00" }, monday8)).toBeNull();
    expect(nextRunAt({ repeat: "today", days: [], time: "09:30" }, monday8)?.getHours()).toBe(9);
  });

  it("keeps the weekday for weekly schedules and moves past missed slots", () => {
    const slot = new Date(2026, 9, 12, 22, 0);
    const next = slotAfter({ repeat: "weekly", days: [], time: "22:00" }, slot, monday8)!;
    expect(next.getDay()).toBe(slot.getDay());
    expect(next > monday8).toBe(true);
  });

  it("never runs off or custom without days", () => {
    expect(nextRunAt({ repeat: "off", days: [], time: "07:00" }, monday8)).toBeNull();
    expect(nextRunAt({ repeat: "custom", days: [], time: "07:00" }, monday8)).toBeNull();
  });

  it("validates like the dialog", () => {
    expect(validateRule({ repeat: "custom", days: [], time: "07:00" }, monday8)).toBe("Choose at least one day.");
    expect(validateRule({ repeat: "today", days: [], time: "07:59" }, monday8)).toBe("Choose a time later today.");
    expect(validateRule({ repeat: "daily", days: [], time: "25:00" }, monday8)).toBe("Choose a time.");
    expect(validateRule({ repeat: "daily", days: [], time: "06:00" }, monday8)).toBeNull();
  });

  it("describes the rule in words", () => {
    expect(describeRule({ repeat: "custom", days: [4, 2], time: "08:00" })).toBe("Every Tuesday, Thursday at 08:00");
    expect(describeRule({ repeat: "weekdays", days: [], time: "07:00" })).toBe("Weekdays at 07:00");
  });
});

describe("period", () => {
  const now = new Date(2026, 9, 25, 15, 0);

  it("refuses a custom range that is reversed or longer than 31 days", () => {
    expect(validateCustom("2026-10-20", "2026-10-10")).toBe('"From" cannot be after "To".');
    expect(validateCustom("2026-09-01", "2026-10-25")).toBe("Choose at most 31 days.");
    expect(validateCustom("2026-10-01", "2026-10-31")).toBeNull();
    expect(validateCustom("2026-02-30", "2026-03-01")).toBe("Choose both dates.");
  });

  it("builds ranges", () => {
    const today = periodRange("today", now)!;
    expect(today.from.getDate()).toBe(25);
    expect(periodRange("7d", now)!.from.getDate()).toBe(19);
    expect(periodRange("custom", now, { from: "2026-10-01", to: "2026-10-02" })!.to.getDate()).toBe(3);
  });
});

describe("failure type", () => {
  it("puts known bugs and the environment before product bugs", () => {
    expect(failureTypeOf({ knownBug: "BUG-001", errorType: "assertion" })).toBe("known_bug");
    expect(failureTypeOf({ knownBug: null, errorType: "environment" })).toBe("environment");
    expect(failureTypeOf({ knownBug: null, errorType: "timeout" })).toBe("test");
    expect(failureTypeOf({ knownBug: null, errorType: "assertion" })).toBe("product");
  });
});

describe("suite selection", () => {
  const empty: SuiteItems = { include: [], exclude: [] };

  it("keeps the other features when one is turned off inside a chosen module", () => {
    const chosen = toggle(empty, tree, { kind: "module", module: "fleet" }, true);
    expect(chosen.include).toEqual([{ kind: "module", module: "fleet" }]);
    const next = toggle(chosen, tree, { kind: "feature", module: "fleet", feature: "cars/update" }, false);
    expect(next.include).toEqual([
      { kind: "feature", module: "fleet", feature: "cars/create" },
      { kind: "feature", module: "fleet", feature: "cars/generate-description" },
    ]);
    expect(next.exclude).toEqual([]);
  });

  it("merges all files of a feature into the feature, and all features into the module", () => {
    let items = toggle(empty, tree, { kind: "file", file: LOGIN }, true);
    items = toggle(items, tree, { kind: "file", file: LOGOUT }, true);
    expect(items.include).toEqual([{ kind: "module", module: "authentication" }]);
  });

  it("leaves a single test out of a chosen group and puts it back", () => {
    const chosen = toggle(empty, tree, { kind: "module", module: "authentication" }, true);
    const left = toggle(chosen, tree, { kind: "test", nodeid: id(LOGIN) }, false);
    expect(left.exclude).toEqual([id(LOGIN)]);
    expect(isTestIncluded(left, tree, id(LOGIN))).toBe(false);
    expect(stateOf(left, tree, [id(LOGIN), id(LOGOUT)])).toBe("indeterminate");
    expect(putBack(left, id(LOGIN)).exclude).toEqual([]);
  });

  it("reports items the catalog no longer has", () => {
    const items: SuiteItems = { include: [{ kind: "file", file: "tests/gone/x/y/test_z.py" }], exclude: [] };
    expect(unavailable(items, tree)).toHaveLength(1);
  });
});

describe("bug report", () => {
  const base = {
    testCaseId: "TC-005",
    title: "Admin updates car details",
    module: "fleet",
    feature: "cars/update",
    role: "admin",
    failureType: "known_bug" as const,
    steps: [
      { title: "open the car", failed: false },
      { title: "the saved car has the new values", failed: true },
    ],
    culprits: [],
    knownBug: "BUG-001",
  };

  it("reads expected and actual values with decimals", () => {
    const report = buildBugReport({ ...base, errorMessage: "saved car differs: daily_price: expected 89.99, got 89.0" });
    expect(report.expected).toBe("89.99");
    expect(report.actual).toBe("89.0");
    expect(report.title).toContain('fails at "the saved car has the new values"');
    expect(report.failureType).toBe("Known bug (BUG-001)");
  });

  it("keeps locators out of the readable text", () => {
    const report = buildBugReport({ ...base, errorMessage: "Locator expected to be visible get_by_test_id('x') Call log: waiting" });
    expect(report.actual).not.toMatch(/get_by_test_id|Call log/);
  });
});
