import { expect, type Page } from "@playwright/test";

export type Role = "admin" | "editor" | "viewer";

export const PASSWORD = process.env.SEED_PASSWORD ?? "QaHub!2026";

export const email = (role: Role) => `${role}@qahub.test`;

/** The saved session of a seeded user (written by auth.setup.ts). */
export const session = (role: Role) => `e2e/.auth/${role}.json`;

/** A name no other test run has used. */
export const unique = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;

export async function login(page: Page, address: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(address);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** No page may scroll sideways (390 px phones included). */
export async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${page.url()} scrolls sideways`).toBeLessThanOrEqual(0);
}
