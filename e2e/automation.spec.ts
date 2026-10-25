import { expect, test } from "@playwright/test";

import { session } from "./helpers";

test.use({ storageState: session("admin") });

test.describe("Automation Tests", () => {
  test("the overview and the runs list show the seeded history", async ({ page }) => {
    await page.goto("/automation-test");
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Runs", exact: true }).first().click();
    await expect(page).toHaveURL(/\/automation-test\/runs/);
    const firstRun = page.locator("a[href^='/automation-test/runs/run_']").first();
    await expect(firstRun).toBeVisible();
    await firstRun.click();
    await expect(page).toHaveURL(/\/automation-test\/runs\/run_/);
  });

  test("the New run dialog counts the tests and Escape closes the menu before the dialog", async ({ page }) => {
    await page.goto("/automation-test/runs");
    await page.getByTestId("new-run").click();
    const dialog = page.getByRole("dialog");
    await expect(page.getByTestId("run-summary")).toHaveText("Choose what to run.");
    await expect(page.getByTestId("new-run-submit")).toBeDisabled();
    await page.getByLabel("Modules").click();
    await page.getByRole("option", { name: "Fleet" }).click();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("run-summary")).toContainText("in Fleet");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("a schedule can be paused and resumed", async ({ page }) => {
    await page.goto("/automation-test/schedules");
    const name = "Fleet weekly";
    const row = page.locator("table [data-testid=schedule-row]").filter({ hasText: name });
    await expect(row).toBeVisible();
    // A run that stopped half way may have left it paused.
    if (await row.getByText("Paused").count()) {
      await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
      await page.getByRole("menuitem", { name: "Resume" }).click();
      await expect(row.getByText("Paused")).toHaveCount(0);
    }
    await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
    await page.getByRole("menuitem", { name: "Pause" }).click();
    await expect(row.getByText("Paused")).toBeVisible();
    await page.getByRole("button", { name: `Actions for ${name}` }).first().click();
    await page.getByRole("menuitem", { name: "Resume" }).click();
    await expect(row.getByText("Paused")).toHaveCount(0);
  });

  test("an unknown placeholder blocks saving the Teams template", async ({ page }) => {
    await page.goto("/automation-test/settings");
    const area = page.getByLabel("Test results template");
    await area.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n{{nope}}");
    await expect(page.getByText("Unknown placeholder {{nope}}.")).toBeVisible();
    await expect(page.getByTestId("save-bar").getByRole("button", { name: "Save" })).toBeDisabled();
    await page.getByTestId("save-bar").getByRole("button", { name: "Discard" }).click();
    await expect(page.getByTestId("save-bar")).toHaveCount(0);
  });
});
