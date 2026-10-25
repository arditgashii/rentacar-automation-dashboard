import { expect, test } from "@playwright/test";

import { session, unique } from "./helpers";

test.use({ storageState: session("editor") });

test("an editor writes a test case, finds it, deletes it and restores it", async ({ page }) => {
  const suite = unique("E2E suite");
  const title = unique("Refund shows on the booking");
  await page.goto("/test-plans");
  const tree = page.getByRole("tree");
  await tree.getByRole("button", { name: "DriveNow", exact: true }).hover();
  await tree.getByRole("button", { name: "Add suite to DriveNow" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(suite);
  await page.getByRole("button", { name: "Add suite" }).click();
  await expect(page.getByText("No test cases yet.")).toBeVisible();

  await page.keyboard.press("n");
  const sheet = page.getByTestId("case-sheet");
  await expect(sheet).toContainText("New test case");
  await sheet.getByLabel("Title").fill(title);
  await sheet.getByRole("button", { name: "Click here to add a step" }).click();
  await page.keyboard.type("Cancel a confirmed booking");
  await sheet.getByLabel("Step 1 expected result").fill("The booking shows Refund pending");
  await page.keyboard.press("Control+s");
  await expect(sheet).toContainText(/TC-\d{3}/);
  await expect(page).toHaveURL(/case=tcs_/);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.keyboard.press("/");
  await page.keyboard.type(title.split(" ").pop()!);
  await expect(page.getByTestId("case-row")).toHaveCount(1);

  await page.getByLabel("Search test cases").fill("");
  await page.getByTestId("case-row").filter({ hasText: title }).click();
  await sheet.getByRole("button", { name: "Test case actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByTestId("confirm-yes").click();
  await expect(page.getByTestId("case-row").filter({ hasText: title })).toHaveCount(0);

  await page.getByRole("button", { name: "Deleted" }).first().click();
  const item = page.getByTestId("deleted-item").filter({ hasText: title });
  await item.getByRole("button", { name: "Restore" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("case-row").filter({ hasText: title })).toHaveCount(1);
});

test("an unsaved change asks before the panel closes", async ({ page }) => {
  await page.goto("/test-plans");
  await page.getByTestId("case-row").first().click();
  const sheet = page.getByTestId("case-sheet");
  await sheet.getByLabel("Preconditions").fill("Changed but not saved");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Discard changes?" })).toBeVisible();
  await page.getByTestId("confirm-yes").click();
  await expect(sheet).toHaveCount(0);
});
