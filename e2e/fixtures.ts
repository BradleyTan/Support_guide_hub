import { test as base, expect, type Page } from "@playwright/test";

/**
 * Waits until the app's code has loaded (components/providers.tsx sets data-ready on <html>). Before that,
 * clicks do nothing and typed text is reset when the page takes over, which made tests flaky under load.
 */
export async function waitForApp(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1", null, { timeout: 30_000 });
}

/** Playwright's test, with page.goto() waiting for the app to be ready. Specs import test/expect from here. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await waitForApp(page);
      return response;
    };
    await use(page);
  },
});

export { expect };
