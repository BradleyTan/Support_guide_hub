import { expect, test } from "./fixtures";
import { hasTestAccount } from "./helpers";

/** Read-only search checks (signed in via auth.setup.ts). They don't change any data. */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

test("finds official help-centre articles, with meaning search working", async ({ page }) => {
  await page.goto("/search?q=bank%20reconciliation");
  const official = page.locator("section", { has: page.getByRole("heading", { name: "Official AutoCount sources" }) });
  await expect(official.getByText(/help-centre articles searched/)).toBeVisible();
  await expect(official.locator('a[href^="https://help.accounting.autocountcloud.com/support/solutions/articles/"]').first()).toBeVisible();
  // Google searches for the sites that aren't indexed
  await expect(official.getByRole("link", { name: /AutoCount website & wiki/ })).toHaveAttribute("href", /site%3Awiki\.autocountsoft\.com/);
  // The embed Edge Function answered for this signed-in user
  const mine = page.locator("section", { has: page.getByRole("heading", { name: "Your guides" }) });
  await expect(mine.getByText(/match/).first()).toBeVisible();
  await expect(mine.getByText("meaning search unavailable")).toHaveCount(0);
});

test("typing a search updates the address and results", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText("Search your guides and AutoCount’s own documentation")).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("PCB");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=PCB$/);
  const official = page.locator("section", { has: page.getByRole("heading", { name: "Official AutoCount sources" }) });
  await expect(official.locator('a[href^="https://help.hrms.autocountcloud.com/"]').first()).toBeVisible();
});

test("shows clear empty states for a search with no matches", async ({ page }) => {
  await page.goto("/search?q=zqxjv%20wqpfk");
  await expect(page.getByText("None of your guides match")).toBeVisible();
  await expect(page.getByText("No help-centre articles match")).toBeVisible();
});

test("filters open and product chips toggle", async ({ page }) => {
  await page.goto("/search?q=invoice");
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByLabel("Module")).toBeVisible();
  const payroll = page.getByRole("button", { name: "Payroll", exact: true });
  await payroll.click();
  await expect(payroll).toHaveAttribute("aria-pressed", "true");
});
