// A small catalog used by the unit tests: two modules, three features, one file per test.

import type { CatalogTest } from "./types";

function test(file: string, markers: string[] = [], id = ""): CatalogTest {
  const parts = file.split("/");
  return {
    nodeid: `${file}::test_x`,
    file,
    module: parts[1],
    feature: parts.slice(2, -2).join("/"),
    role: parts[parts.length - 2],
    testCaseId: id || null,
    title: parts[parts.length - 1],
    markers,
    knownBug: null,
    line: 10,
  };
}

export const SAMPLE_TESTS: CatalogTest[] = [
  test("tests/authentication/login/admin/test_tc_001_a.py", ["smoke", "ui"], "TC-001"),
  test("tests/authentication/logout/client/test_tc_012_b.py", ["regression", "ui"], "TC-012"),
  test("tests/fleet/cars/create/client/test_tc_004_c.py", ["smoke", "ui"], "TC-004"),
  test("tests/fleet/cars/update/admin/test_tc_005_d.py", ["regression"], "TC-005"),
  test("tests/fleet/cars/generate-description/client/test_tc_011_e.py", ["regression", "costly"], "TC-011"),
];
