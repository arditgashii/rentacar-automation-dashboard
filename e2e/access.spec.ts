import { expect, test } from "@playwright/test";

import { session } from "./helpers";

test.describe("editor", () => {
  test.use({ storageState: session("editor") });

  test("cannot reach Automation Tests, Settings or Members", async ({ page, request }) => {
    for (const path of ["/automation-test", "/automation-test/runs", "/automation-test/settings", "/members"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect`).toHaveURL(/\/test-plans/);
    }
    expect((await request.get("/api/automation/runs")).status()).toBe(403);
    expect((await request.get("/api/automation/teams")).status()).toBe(403);
    expect((await request.get("/api/members")).status()).toBe(403);
  });

  test("the sidebar shows only what the role can open", async ({ page }) => {
    await page.goto("/test-plans");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Test Plans" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Automation Tests" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Members" })).toHaveCount(0);
  });
});

test.describe("viewer", () => {
  test.use({ storageState: session("viewer") });

  test("reads Test Plans without change buttons and the API refuses writes", async ({ page, request }) => {
    await page.goto("/test-plans");
    await expect(page.getByTestId("case-row").first()).toBeVisible();
    await expect(page.getByTestId("new-case")).toHaveCount(0);
    await expect(page.getByLabel("Select all")).toHaveCount(0);
    const workspace = await (await request.get("/api/test-plans")).json();
    const projectId = workspace.projects[0].id;
    expect((await request.post("/api/test-plans/nodes", { data: { projectId, parentId: null, name: "Nope" } })).status()).toBe(403);
  });

  test("reads a regression run without result buttons", async ({ page }) => {
    await page.goto("/regression/before-release?team=Fleet&release=v1.5.0");
    await expect(page.getByTestId("run-bar")).toContainText("v1.5.0");
    await expect(page.getByTestId("complete-run")).toHaveCount(0);
    await page.getByRole("button", { name: /^Search/ }).first().click();
    await expect(page.getByTestId("item-row").first()).toBeVisible();
    await expect(page.getByRole("group", { name: /^Result of/ })).toHaveCount(0);
  });
});

test.describe("API input checks", () => {
  test.use({ storageState: session("admin") });

  test("odd ids and extra fields are refused", async ({ request }) => {
    expect((await request.get("/api/automation/runs/..%2F..%2Fetc")).status()).toBe(404);
    expect((await request.get("/api/test-plans/cases/not-an-id")).status()).toBe(404);
    const extra = await request.post("/api/test-plans/projects", { data: { name: "X", admin: true } });
    expect(extra.status()).toBe(400);
  });

  test("no password hash or Teams link reaches the browser", async ({ request }) => {
    const members = await (await request.get("/api/members")).text();
    expect(members).not.toContain("$2");
    expect(members.toLowerCase()).not.toContain("hash");
    const teams = await (await request.get("/api/automation/teams")).text();
    expect(teams).not.toContain("http://");
    expect(teams).not.toContain("https://");
  });
});
