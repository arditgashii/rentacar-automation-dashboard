import { expect, test } from "@playwright/test";

import { email, login } from "./helpers";

test.describe("login and logout", () => {
  test("a wrong password shows one message and no session", async ({ page }) => {
    await login(page, email("admin"), "not-the-password");
    await expect(page.getByText("Wrong email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("private pages and APIs need a session", async ({ page, request }) => {
    await page.goto("/test-plans");
    await expect(page).toHaveURL(/\/login\?next=%2Ftest-plans/);
    expect((await request.get("/api/test-plans")).status()).toBe(401);
    expect((await request.get("/api/automation/runs")).status()).toBe(401);
  });

  test("an editor lands on Test Plans and Back after logout does not show a private page", async ({ page }) => {
    await login(page, email("editor"));
    await page.waitForURL("**/test-plans**");
    await page.getByRole("link", { name: "Manual Regression" }).click();
    await expect(page.getByRole("heading", { name: "Manual Regression" })).toBeVisible();
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL("**/login**");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Manual Regression" })).toHaveCount(0);
  });

  test("the next parameter only goes to local pages", async ({ page }) => {
    await page.goto("/login?next=//evil.example.com");
    await page.getByLabel("Email").fill(email("admin"));
    await page.getByLabel("Password").fill(process.env.SEED_PASSWORD ?? "QaHub!2026");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/automation-test**");
  });
});
