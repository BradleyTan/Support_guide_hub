import { expect, type Browser, type Page } from "@playwright/test";
import { waitForApp } from "./fixtures";

export const AUTH_FILE = "e2e/.auth/user.json";
/** E2E_BASE_URL runs the tests against another address (e.g. the live site) instead of a local build. */
export const remoteTarget = !!process.env.E2E_BASE_URL && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(process.env.E2E_BASE_URL);
/**
 * Signed-in tests run only against this PC: the test account is never typed into a live site.
 * Set E2E_SIGNED_IN=0 to run only the signed-out tests locally too.
 */
export const hasTestAccount = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD && process.env.E2E_SIGNED_IN !== "0" && !remoteTarget;
export const allowWrites = hasTestAccount && process.env.E2E_ALLOW_WRITES === "1";

/**
 * Signs in on a fresh page. Only for tests that must end a session (sign-out tests), so they never
 * revoke the shared session the other tests reuse.
 */
export async function signInFresh(page: Page) {
  await page.goto("/login");
  await waitForApp(page);
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}

/** A brand-new, signed-out browser context (e.g. a second device). */
export async function freshContext(browser: Browser) {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}
