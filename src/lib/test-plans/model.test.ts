import { describe, expect, it } from "vitest";

import { caseCode, childrenOf, countByNode, matchesSearch, parseTags, pathOf, subtreeIds, toCsv, type TreeNode } from "./model";

const node = (id: string, parentId: string | null, position = 0, kind: TreeNode["kind"] = parentId ? "folder" : "suite"): TreeNode => ({
  id,
  projectId: "prj",
  parentId,
  kind,
  name: id,
  position,
});

const nodes = [node("suite", null), node("a", "suite", 1), node("b", "suite", 0), node("a1", "a"), node("other", null, 1)];

describe("test plans model", () => {
  it("numbers test cases past 1000", () => {
    expect(caseCode(1)).toBe("TC-001");
    expect(caseCode(42)).toBe("TC-042");
    expect(caseCode(1204)).toBe("TC-1204");
  });

  it("orders children by position", () => {
    expect(childrenOf(nodes, "prj", "suite").map((n) => n.id)).toEqual(["b", "a"]);
    expect(childrenOf(nodes, "prj", null).map((n) => n.id)).toEqual(["suite", "other"]);
  });

  it("finds a subtree and the path to a node", () => {
    expect(subtreeIds(nodes, "a").sort()).toEqual(["a", "a1"]);
    expect(subtreeIds(nodes, "suite")).toHaveLength(4);
    expect(pathOf(nodes, "a1").map((n) => n.id)).toEqual(["suite", "a", "a1"]);
  });

  it("counts test cases with the folders below", () => {
    const counts = countByNode(nodes, [{ nodeId: "a1" }, { nodeId: "a1" }, { nodeId: "b" }, { nodeId: "suite" }]);
    expect(counts.get("a1")).toBe(2);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("suite")).toBe(4);
    expect(counts.get("other")).toBeUndefined();
  });

  it("searches by title, ID and tag", () => {
    const c = { number: 5, title: "Admin updates car details", tags: ["fleet", "smoke"] };
    expect(matchesSearch(c, "UPDATES")).toBe(true);
    expect(matchesSearch(c, "tc-005")).toBe(true);
    expect(matchesSearch(c, "TC-5")).toBe(true);
    expect(matchesSearch(c, "5")).toBe(true);
    expect(matchesSearch(c, "smoke")).toBe(true);
    expect(matchesSearch(c, "15")).toBe(false);
    expect(matchesSearch(c, "booking")).toBe(false);
  });

  it("parses tags without duplicates or blanks", () => {
    expect(parseTags(" smoke, api ,, smoke ")).toEqual(["smoke", "api"]);
  });

  it("writes CSV that Excel cannot run as a formula", () => {
    expect(toCsv([["ID", "Title"], ["TC-001", 'Says "hi", twice'], ["TC-002", "=SUM(A1)"]])).toBe('ID,Title\r\nTC-001,"Says ""hi"", twice"\r\nTC-002,\'=SUM(A1)');
  });
});
