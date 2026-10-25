import { expect, test } from "@playwright/test";

import { session, unique } from "./helpers";

test.use({ storageState: session("editor") });

test("a new release copies the library, takes results and can be completed and reopened", async ({ page }) => {
  const release = unique("v9");
  await page.goto("/regression/before-release?team=Payments");
  const input = page.getByTestId("release-input");
  await input.click();
  await input.fill(release);
  await page.getByRole("option", { name: `Add "${release}"` }).click();
  await expect(page.getByTestId("run-bar")).toContainText(release);
  await expect(page).toHaveURL(new RegExp(`release=${encodeURIComponent(release).replace(/%20/g, "(\\+|%20)")}`));

  const counts = page.getByTestId("run-counts");
  await page.getByTestId("module-card").first().getByRole("button", { expanded: false }).first().click();
  const row = page.getByTestId("item-row").first();
  const name = (await row.locator("p").first().innerText()).trim();
  await row.getByRole("group", { name: `Result of ${name}` }).getByRole("button", { name: "Failed" }).click();
  await expect(counts).toContainText("1 failed");

  await row.getByRole("button", { name: `Comment on ${name}` }).click();
  await page.keyboard.type("Logged as DN-4321");
  await page.keyboard.press("Enter");
  await expect(row.getByRole("link", { name: "DN-4321" })).toBeVisible();

  await row.getByRole("button", { name: `History of ${name}` }).click();
  await expect(page.getByTestId("history")).toContainText("from Not tested to Failed");
  await page.keyboard.press("Escape");

  await page.getByTestId("complete-run").click();
  await expect(page.getByRole("dialog")).toContainText("still Not tested");
  await page.getByTestId("confirm-yes").click();
  await expect(page.getByText("This run is completed and read only.")).toBeVisible();
  await page.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByTestId("complete-run")).toBeVisible();

  // The same name in other letters opens the same run.
  await input.click();
  await input.fill(release.toUpperCase());
  await expect(page.getByRole("option", { name: /^Add "/ })).toHaveCount(0);
});

test("a sprint item needs a real Jira link", async ({ page }) => {
  const sprint = unique("Sprint");
  await page.goto("/regression/sprint?team=Core");
  const input = page.getByTestId("release-input");
  await input.click();
  await input.fill(sprint);
  await page.getByRole("option", { name: `Add "${sprint}"` }).click();
  await expect(page.getByText("A sprint run starts empty.")).toBeVisible();
  await page.getByTestId("add-sprint-item").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill("Show the refund status");
  await dialog.getByLabel("Jira link").fill("see ticket");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(dialog.getByText("Use a Jira key like DN-1234")).toBeVisible();
  await dialog.getByLabel("Jira link").fill("dn-77");
  await dialog.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByTestId("item-row").getByRole("link", { name: "DN-77" })).toBeVisible();
});
