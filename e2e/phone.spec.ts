import { expect, test } from "@playwright/test";

import { expectNoSideScroll, session } from "./helpers";

test.use({ storageState: session("admin") });

const pages = [
  "/automation-test",
  "/automation-test/runs",
  "/automation-test/schedules",
  "/automation-test/suites",
  "/automation-test/settings",
  "/test-plans",
  "/regression/before-release?team=Fleet&release=v1.5.0",
  "/regression/sprint?team=Bookings&release=Sprint%2042",
  "/members",
];

for (const path of pages) {
  test(`${path} fits a 390 px phone`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoSideScroll(page);
  });
}

test("the sidebar is a drawer on phones", async ({ page }) => {
  await page.goto("/test-plans");
  await page.getByRole("button", { name: /menu/i }).first().click();
  await expect(page.getByRole("link", { name: "Manual Regression" })).toBeVisible();
});
