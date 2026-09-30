import { expect, test, type Page } from "@playwright/test";
import { freshContext, hasTestAccount, signInFresh } from "./helpers";

/** Every app screen, with the heading we expect to see when signed in. */
const routes: [string, RegExp][] = [
  ["/", /Guidelines/],
  ["/guides", /Guide library/],
  ["/guides/new", /New guide/],
  ["/guides/import", /Import guides/],
  ["/search?q=server%20not%20found", /Search/],
  ["/analyst", /Accounting analyst/],
  ["/replies", /Reply generator/],
  ["/sop", /SOP builder/],
  ["/templates", /Templates/],
  ["/releases", /Versions & releases/],
  ["/settings", /Settings/],
];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(1);
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page renders without errors", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Sign in/);
    await noSideScroll(page);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  for (const [path] of routes) {
    test(`${path} redirects to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("login form validates input before contacting the server", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await expect(page.locator("form").getByRole("alert")).toContainText(/valid email/);
  });

  test("wrong password shows a clear message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.invalid");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await expect(page.locator("form").getByRole("alert")).toContainText(/incorrect/);
  });

  test("forgot password opens the reset form, validates the email and goes back", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reset your password");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(/valid email/);
    await page.getByRole("button", { name: "Back to sign in" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Sign in/);
  });

  test("an expired reset link opens the reset form with an explanation", async ({ page }) => {
    await page.goto("/login?error=reset");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reset your password");
    await expect(page.locator("form").getByRole("alert")).toContainText(/expired/);
  });

  test("a bad email link is rejected", async ({ page }) => {
    await page.goto("/auth/confirm?code=not-a-real-code&next=/reset-password");
    await expect(page).toHaveURL(/\/login\?error=reset/);
  });

  test("the set-new-password page needs a valid reset link", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/login/);
  });
});

// Signed-in checks need a dedicated test account (E2E_EMAIL / E2E_PASSWORD); they reuse the session from auth.setup.ts.
test.describe("signed in", () => {
  test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

  for (const [path, heading] of routes) {
    test(`${path} renders without console errors`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await noSideScroll(page);
      expect(errors, errors.join("\n")).toEqual([]);
    });
  }

  test("unknown guide shows the not-found page", async ({ page }) => {
    await page.goto("/guides/G-99999");
    await expect(page.getByText("That page or guide doesn’t exist")).toBeVisible();
  });

  test("upload rejects wrong file type", async ({ page }) => {
    await page.goto("/guides/new");
    await page.locator("input[type=file][multiple]").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    await expect(page.getByText("this file type isn't supported")).toBeVisible();
  });

  test("set-new-password form checks length and matching before saving", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set a new password");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password").fill("short");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(/at least 8/);
    await page.getByLabel("New password", { exact: true }).fill("a-long-password-1");
    await page.getByLabel("Confirm new password").fill("a-different-password-2");
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(/don’t match/);
  });

  // Signing out ends a session, so these use their own fresh sign-ins and never touch the shared one.
  test("sign out returns to the login page, and other devices stay signed in", async ({ browser, isMobile }) => {
    test.skip(isMobile, "checked once on desktop");
    const deviceA = await freshContext(browser);
    const deviceB = await freshContext(browser);
    const a = await deviceA.newPage();
    const b = await deviceB.newPage();
    await signInFresh(a);
    await signInFresh(b);

    await a.getByRole("button", { name: "Sign out" }).click();
    await expect(a).toHaveURL(/\/login/);
    await a.goto("/guides");
    await expect(a).toHaveURL(/\/login/); // really signed out on this device

    await b.goto("/guides");
    await expect(b.getByRole("heading", { level: 1 })).toHaveText(/Guide library/); // the other device is still in
    await deviceA.close();
    await deviceB.close();
  });
});
