import { expect, test } from "./fixtures";
import { createClient } from "@supabase/supabase-js";
import { allowWrites, hasTestAccount } from "./helpers";

/** Knowledge hub. Read-only tests change nothing; the write tests remove only the rows they created. */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

const NOT_FOUND = "Not found in a source yet — add it once checked";

test.describe("read-only", () => {
  test("the Knowledge hub opens and explains itself", async ({ page }) => {
    await page.goto("/knowledge");
    await expect(page.getByRole("heading", { level: 1, name: "Knowledge hub" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: /Add starter articles/ }).or(page.getByLabel("Filter articles"))).toBeVisible();
  });

  test("the starter picker lists articles by category and adds nothing on its own", async ({ page }) => {
    await page.goto("/knowledge");
    const open = page.getByRole("main").getByRole("button", { name: /Add starter articles/ }).first();
    test.skip(!(await open.isVisible()), "every starter article is already added");
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Add starter articles" })).toBeVisible();
    // Nothing is ticked until the user ticks it (a deleted article must never come back pre-ticked).
    await expect(dialog.getByRole("checkbox", { checked: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /^Add/ })).toBeDisabled();
    await dialog.getByRole("button", { name: "Select all" }).click();
    await expect(dialog.getByRole("button", { name: /^Add/ })).toBeEnabled();
    await page.keyboard.press("Escape");
  });

  test("a new article form explains what's missing (nothing is saved)", async ({ page }) => {
    await page.goto("/knowledge/new");
    await page.getByRole("button", { name: "Save article" }).click();
    await expect(page.getByText("Give the article a title.")).toBeVisible();
    await expect(page.getByText("Write what to tell the customer.")).toBeVisible();
  });
});

test.describe("saving (writes data)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "write tests run once, on desktop");
  test.skip(!allowWrites, "Set E2E_ALLOW_WRITES=1 to run tests that save data");

  const started = new Date().toISOString();
  const SLUGS = ["debtor-aging", "ar-deposit"];

  test.afterAll(async () => {
    if (!allowWrites) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    // Only rows this run created: the two starters added after it started, and [e2e] articles.
    await sb.from("knowledge_articles").delete().in("starter_slug", SLUGS).gte("created_at", started);
    await sb.from("knowledge_articles").delete().like("title", "[e2e]%");
    await sb.auth.signOut({ scope: "local" });
  });

  test("add two starters, read one, copy the customer text, delete it, and it isn't offered again", async ({ page }) => {
    await page.goto("/knowledge");
    const open = page.getByRole("main").getByRole("button", { name: /Add starter articles/ }).first();
    await open.click();
    const dialog = page.getByRole("dialog");
    test.skip(!(await dialog.getByRole("checkbox", { name: "Debtor aging" }).isVisible()), "the test account already has these starters");
    await dialog.getByRole("button", { name: "Select none" }).click();
    await dialog.getByRole("checkbox", { name: "Debtor aging" }).check();
    await dialog.getByRole("checkbox", { name: "Customer deposit (AR deposit)" }).check();
    await dialog.getByRole("button", { name: "Add 2 articles" }).click();
    await expect(page.getByText("Added 2 articles")).toBeVisible();

    await page.getByRole("link", { name: /^Debtor aging/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Debtor aging" })).toBeVisible();
    // "Tell the customer" comes first, before the details.
    const headings = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
    expect(headings[0]).toBe("Tell the customer");
    await page.getByRole("button", { name: "Copy for the customer" }).click();
    await expect(page.getByText("Copied")).toBeVisible();
    await expect(page.getByText("Accounting Menu > Reports > Debtor Aging")).toBeVisible();
    await expect(page.getByLabel("Desktop").getByText(NOT_FOUND)).toBeVisible();
    await expect(page.getByText("Needs verification").first()).toBeVisible();

    await page.getByRole("button", { name: "Mark as reviewed" }).click();
    await expect(page.getByRole("button", { name: "Reviewed" })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Move to bin" }).click();
    await expect(page).toHaveURL(/\/knowledge$/);

    await page.getByRole("main").getByRole("button", { name: /Add starter articles/ }).first().click();
    await expect(page.getByRole("dialog").getByRole("checkbox", { name: "Debtor aging" })).toHaveCount(0);
  });

  test("write your own article and edit it", async ({ page }) => {
    await page.goto("/knowledge/new");
    await page.getByLabel("Title").fill("[e2e] Rounding adjustment");
    await page.getByLabel("Tell the customer").fill("Rounding adjustment is the few sen added or removed so the total is a round amount.");
    await page.getByLabel("Cloud").fill("Settings > Rounding");
    await page.getByRole("button", { name: "Save article" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "[e2e] Rounding adjustment" })).toBeVisible();
    await expect(page.getByLabel("Desktop").getByText(NOT_FOUND)).toBeVisible();

    // A long pasted link must wrap on a phone instead of making the page scroll sideways.
    await page.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("What it is").fill(`See https://example.com/${"averyveryverylongpath".repeat(12)} for details.`);
    await page.getByRole("button", { name: "Save article" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "[e2e] Rounding adjustment" })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "[e2e] Rounding adjustment" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "article page wider than a phone screen").toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Example").fill("Total RM 10.97 becomes RM 10.95.");
    await page.getByRole("button", { name: "Save article" }).click();
    await expect(page.getByText("Total RM 10.97 becomes RM 10.95.")).toBeVisible();

    // Search finds it under its own Knowledge hub heading, and it links to the article.
    await page.goto(`/search?q=${encodeURIComponent("Rounding adjustment")}`);
    const hub = page.locator("section", { has: page.getByRole("heading", { name: "Knowledge hub" }) });
    await hub.getByRole("link", { name: /\[e2e\] Rounding adjustment/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "[e2e] Rounding adjustment" })).toBeVisible();
  });
});
