import { expect, type Browser, type Page } from "@playwright/test";

export const AUTH_FILE = "e2e/.auth/user.json";
/** Set E2E_SIGNED_IN=0 to run only the signed-out tests (e.g. while test account details are being fixed). */
export const hasTestAccount = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD && process.env.E2E_SIGNED_IN !== "0";
export const allowWrites = hasTestAccount && process.env.E2E_ALLOW_WRITES === "1";

/**
 * Signs in on a fresh page. Only for tests that must end a session (sign-out tests), so they never
 * revoke the shared session the other tests reuse.
 */
export async function signInFresh(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}

/** A brand-new, signed-out browser context (e.g. a second device). */
export async function freshContext(browser: Browser) {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}
