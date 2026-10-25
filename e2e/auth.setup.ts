import { test as setup } from "@playwright/test";

import { email, login, type Role, session } from "./helpers";

const homes: Record<Role, string> = { admin: "**/automation-test**", editor: "**/test-plans**", viewer: "**/test-plans**" };

for (const role of ["admin", "editor", "viewer"] as const) {
  setup(`log in as ${role}`, async ({ page }) => {
    await login(page, email(role));
    await page.waitForURL(homes[role]);
    await page.context().storageState({ path: session(role) });
  });
}
