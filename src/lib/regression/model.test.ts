import { describe, expect, it } from "vitest";

import { countResults, functionsBelow, groupTone, type Item, jiraHref, jiraLabel, linkify, parseJira, visible } from "./model";

const item = (id: string, parentId: string | null, kind: Item["kind"], name: string, result: Item["result"] = "not_tested"): Item => ({
  id,
  parentId,
  libraryId: null,
  kind,
  name,
  jira: "",
  position: 0,
  result,
  comment: "",
  removedFromLibrary: false,
  updatedBy: null,
  updatedAt: null,
});

const items = [
  item("m", null, "module", "Photos"),
  item("f", "m", "feature", "Upload"),
  item("a", "f", "function", "Upload a JPG", "passed"),
  item("b", "f", "function", "Refuse a file over 5 MB", "failed"),
  item("c", "f", "function", "At most 8 photos"),
];

describe("regression model", () => {
  it("counts only functions", () => {
    expect(countResults(items)).toEqual({ not_tested: 1, passed: 1, failed: 1, blocked: 0, total: 3 });
    expect(functionsBelow(items, "m").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("colours a group by its worst result", () => {
    expect(groupTone(countResults(items))).toBe("fail");
    expect(groupTone(countResults([items[2]]))).toBe("pass");
    expect(groupTone(countResults([items[4]]))).toBe("skip");
  });

  it("filters by result and searches the module and feature names", () => {
    expect(visible(items[3], items, "failed", "")).toBe(true);
    expect(visible(items[2], items, "failed", "")).toBe(false);
    expect(visible(items[2], items, "all", "photos")).toBe(true);
    expect(visible(items[2], items, "all", "booking")).toBe(false);
  });

  it("accepts Jira keys and browse links only", () => {
    expect(parseJira("dn-1234")).toBe("DN-1234");
    expect(parseJira(" DN-77 ")).toBe("DN-77");
    expect(parseJira("https://drivenow.atlassian.net/browse/DN-1234")).toBe("https://drivenow.atlassian.net/browse/DN-1234");
    expect(parseJira("DN1234")).toBeNull();
    expect(parseJira("https://example.com/DN-1234")).toBeNull();
    expect(parseJira("javascript:alert(1)")).toBeNull();
    expect(jiraHref("DN-1", "https://jira.example.com/browse")).toBe("https://jira.example.com/browse/DN-1");
    expect(jiraLabel("https://x.atlassian.net/browse/DN-9")).toBe("DN-9");
  });

  it("turns URLs and Jira keys in comments into links", () => {
    const parts = linkify("See DN-1234 and https://example.com/a.png.", "https://jira.example.com/browse/");
    expect(parts).toEqual([
      { text: "See " },
      { text: "DN-1234", href: "https://jira.example.com/browse/DN-1234" },
      { text: " and " },
      { text: "https://example.com/a.png", href: "https://example.com/a.png" },
      { text: "." },
    ]);
  });
});
