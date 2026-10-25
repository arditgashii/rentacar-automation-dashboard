import { expect, test } from "@playwright/test";

import { login, session, unique } from "./helpers";

test.use({ storageState: session("admin") });

test("an admin adds a member who can log in, then removes them", async ({ page, browser }) => {
  const name = unique("Lira");
  const address = `${name.replace(/\s+/g, ".").toLowerCase()}@qahub.test`;
  await page.goto("/members");
  await page.getByTestId("add-member").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill(address);
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Role").selectOption("viewer");
  await dialog.getByLabel("Temporary password").fill("Welcome2026x");
  await dialog.getByRole("button", { name: "Add member" }).click();
  const row = page.getByTestId("member-row").filter({ hasText: address });
  await expect(row).toBeVisible();

  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const newcomer = await other.newPage();
  await login(newcomer, address, "Welcome2026x");
  await newcomer.waitForURL("**/test-plans**");

  await row.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await page.getByTestId("confirm-yes").click();
  await expect(row).toHaveCount(0);
  expect((await newcomer.request.get("/api/test-plans")).status()).toBe(401);
  await other.close();
});

test("an admin cannot change their own role", async ({ page }) => {
  await page.goto("/members");
  const me = page.getByTestId("member-row").filter({ hasText: "admin@qahub.test" });
  await expect(me.getByText("You")).toBeVisible();
  await expect(me.getByRole("combobox")).toHaveCount(0);
});
