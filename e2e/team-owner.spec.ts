import { expect, test, waitForApp } from "./fixtures";
import { createClient } from "@supabase/supabase-js";
import { freshContext, remoteTarget } from "./helpers";

/**
 * The OWNER's controls (verify, delete, restore, Settings). Skipped unless E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD are set,
 * and, like every signed-in test, never run against a live site. The owner signs in fresh in its own browser context, so the
 * member's saved session is untouched. It creates one "[e2e]" guide and removes it for good afterwards.
 */
const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const hasOwner = !!ownerEmail && !!ownerPassword && !remoteTarget && process.env.E2E_ALLOW_WRITES === "1";

test.skip(!hasOwner, "Set E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD and E2E_ALLOW_WRITES=1 (local server only) to run the owner tests");
test.skip(({ isMobile }) => isMobile, "owner flow checked once, on desktop");
test.describe.configure({ mode: "serial" });

const TITLE = `[e2e] ${Date.now()} owner delete test`;

test.afterAll(async () => {
  if (!hasOwner) return;
  // Runs even when the test fails midway: the owner hard-deletes the [e2e] guide (RLS allows the owner to DELETE).
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  await sb.auth.signInWithPassword({ email: ownerEmail!, password: ownerPassword! });
  await sb.from("guides").delete().eq("title", TITLE);
  await sb.auth.signOut({ scope: "local" });
});

test("the owner can verify, delete and restore a guide, and sees the owner-only settings", async ({ browser }) => {
  const context = await freshContext(browser);
  const page = await context.newPage();
  const goto = page.goto.bind(page);
  page.goto = async (url, options) => {
    const response = await goto(url, options);
    await waitForApp(page);
    return response;
  };
  try {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail!);
    await page.getByLabel("Password").fill(ownerPassword!);
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });

    // Create an [e2e] guide to work on.
    await page.goto("/guides/new");
    await page.getByLabel("Title").fill(TITLE);
    await page.getByLabel("Fix steps").fill("1. Owner step");
    await page.getByRole("button", { name: "Save guide" }).click();
    await expect(page).toHaveURL(/\/guides\/G-\d+$/, { timeout: 30_000 });
    const code = page.url().split("/").pop()!;

    // Verify and un-verify.
    await page.getByRole("button", { name: "Mark verified" }).click();
    await expect(page.getByRole("button", { name: "Mark unverified" })).toBeVisible();
    await expect(page.locator("aside").getByText("Marked as verified")).toBeVisible();

    // Delete, find it in the bin, restore.
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Move to bin" }).click();
    await expect(page).toHaveURL(/\/guides$/);
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Export to Excel" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Model" })).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: code });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText(`${code} restored`)).toBeVisible();
    await page.goto(`/guides/${code}`);
    await expect(page.getByText("Restored from the bin")).toBeVisible();

    // Team page: the owner sees the link and the approved test member listed under Team.
    await page.goto("/team");
    await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Team", exact: true })).toBeVisible();
    const team = page.getByRole("region", { name: "Team" });
    await expect(team.getByRole("button", { name: "Remove access" }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Waiting for approval" })).toBeVisible();
  } finally {
    await context.close();
  }
});
