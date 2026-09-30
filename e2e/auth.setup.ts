import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE, hasTestAccount } from "./helpers";

/** Signs in once per test run and saves the session, so each test doesn't sign in again (and hit rate limits). */
setup("sign in once", async ({ page }) => {
  setup.skip(!hasTestAccount, "No test account configured");
  await page.goto("/login");
  await page.waitForLoadState("networkidle"); // form is interactive
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.context().storageState({ path: AUTH_FILE });
});
