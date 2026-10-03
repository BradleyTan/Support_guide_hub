import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { allowWrites, hasTestAccount } from "./helpers";

test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

test.describe("read-only", () => {
  test("Insights shows activity, gaps and library health", async ({ page }) => {
    await page.goto("/insights");
    await expect(page.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
    await expect(page.getByText("Searches that found no guide")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity by week" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Search gaps \(\d+\)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Library health" })).toBeVisible();
  });

  test("Home lists most-opened guides and search gaps, with no AI wording", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Guidelines" })).toBeVisible();
    // Signed-in Home shows either the empty library or the sections; both must be free of AI claims.
    const main = page.getByRole("main");
    await expect(main).not.toContainText(/the AI/);
    if (await page.getByText("Start your guide library").isVisible()) return;
    await expect(page.getByRole("heading", { name: "Most opened" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Search gaps \(\d+\)$/ })).toBeVisible();
  });

  test("Insights is under More on the phone, not in the tab bar", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout only");
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Quick" }).getByRole("link", { name: "Insights" })).toHaveCount(0);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Insights" }).click();
    await expect(page).toHaveURL(/\/insights$/);
  });

  test("a gap's Write a guide link prefills the new guide title", async ({ page }) => {
    await page.goto("/guides/new?title=EPF%20rate%20for%20foreign%20workers");
    await expect(page.getByLabel("Title")).toHaveValue("EPF rate for foreign workers");
  });
});

test.describe("search gaps (writes data)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "write tests run once, on desktop");
  test.skip(!allowWrites, "Set E2E_ALLOW_WRITES=1 to run tests that save data");

  // Nonsense words only: "[e2e]" would match the other write tests' temporary [e2e] guides.
  const query = `zqxjv wqpfk ${Date.now()}`;

  test.afterAll(async () => {
    if (!allowWrites) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    await sb.from("search_log").delete().eq("query", query);
    await sb.auth.signOut({ scope: "local" });
  });

  test("a search that finds nothing, made twice, becomes a gap", async ({ page }) => {
    // Repeats within 30 minutes count once, so the earlier search is added directly as if made yesterday.
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    const { error } = await sb.from("search_log").insert({ query, guide_hits: 0, created_at: new Date(Date.now() - 86_400_000).toISOString() });
    await sb.auth.signOut({ scope: "local" });
    expect(error).toBeNull();

    await page.goto(`/search?q=${encodeURIComponent(query)}`);
    await expect(page.getByText("None of your guides match")).toBeVisible();

    await page.goto("/insights");
    const gap = page.getByRole("listitem").filter({ hasText: query });
    await expect(gap).toContainText("Searched 2×");
    await gap.getByRole("link", { name: `Write a guide for ${query}` }).click();
    await expect(page.getByLabel("Title")).toHaveValue(query);
  });
});
