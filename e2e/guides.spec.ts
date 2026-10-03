import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { createClient } from "@supabase/supabase-js";
import { allowWrites } from "./helpers";

/**
 * Guide library write tests: they create, change and delete guides, so they only run when
 * E2E_ALLOW_WRITES=1 and a test account is set (signed in via auth.setup.ts). Everything they
 * create has a title starting with "[e2e]" and is permanently removed afterwards.
 */
const RUN = `[e2e] ${Date.now()}`;

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "write tests run once, on desktop");
test.skip(!allowWrites, "Set E2E_EMAIL, E2E_PASSWORD and E2E_ALLOW_WRITES=1 to run guide write tests");

async function pick(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test.afterAll(async () => {
  if (!allowWrites) return;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
  const { data } = await sb.from("guides").select("id, guide_attachments(storage_path)").like("title", "[e2e]%");
  const paths = (data ?? []).flatMap((g) => g.guide_attachments.map((a) => a.storage_path));
  if (paths.length) await sb.storage.from("attachments").remove(paths);
  if (data?.length) await sb.from("guides").delete().in("id", data.map((g) => g.id));
  await sb.auth.signOut({ scope: "local" });
});

test("create, edit, verify, attach, delete and restore a guide", async ({ page }) => {
  // Create
  await page.goto("/guides/new");
  await page.getByRole("button", { name: "Save guide" }).click();
  await expect(page.getByText("Give the guide a title so you can find it later.")).toBeVisible();
  await expect(page.getByText("Add at least one fix step.")).toBeVisible();

  await page.getByLabel("Title").fill(`${RUN} Report template missing after upgrade`);
  await pick(page, "Product", "Accounting");
  await page.getByLabel("Module").fill("Printing");
  await page.getByLabel("Error message").fill("Report template not found");
  await page.getByLabel("Fix steps").fill("1. Export the template\n2. Import it again");
  await page.getByLabel("Tags").fill("printing, e2e");
  await page.getByRole("button", { name: "Save guide" }).click();
  await expect(page).toHaveURL(/\/guides\/G-\d+$/);
  const code = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Report template missing after upgrade");
  await expect(page.getByText("Export the template")).toBeVisible();
  await expect(page.getByText("Guide created")).toBeVisible();

  // Duplicate warning on a new guide with a near-identical title
  await page.goto("/guides/new");
  await page.getByLabel("Title").fill(`${RUN} Report template missing after upgrade!`);
  await expect(page.getByText("Similar guides already exist")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: new RegExp(code) })).toBeVisible();

  // Edit
  await page.goto(`/guides/${code}/edit`);
  await page.getByLabel("Cause").fill("Template file not copied during upgrade");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(new RegExp(`/guides/${code}$`));
  await expect(page.getByText("Template file not copied during upgrade")).toBeVisible();
  await expect(page.getByText("Edited cause")).toBeVisible();

  // Verify
  await page.getByRole("button", { name: "Mark verified" }).click();
  await expect(page.getByRole("button", { name: "Mark unverified" })).toBeVisible();
  // The toast says the same words, so check the edit history in the sidebar.
  await expect(page.locator("aside").getByText("Marked as verified")).toBeVisible();

  // Attach a small PNG, then reject a wrong file type
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "e2e-shot.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Open e2e-shot.png" }).first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByText("this file type isn't supported")).toBeVisible();

  // Pin an official help-centre article from Search, see it on the guide, then unpin it
  await page.goto("/search?q=bank%20reconciliation");
  await page.getByRole("button", { name: /^Pin “/ }).first().click();
  await page.getByLabel("Find a guide").fill(code);
  await page.getByRole("button", { name: new RegExp(code) }).click();
  await expect(page.getByText(`Pinned to ${code}`)).toBeVisible();
  await page.goto(`/guides/${code}`);
  const pinned = page.locator("aside section", { has: page.getByText("Pinned official sources") });
  await expect(pinned.locator('a[href^="https://help.accounting.autocountcloud.com/"]')).toBeVisible();
  await pinned.getByRole("button", { name: /^Unpin/ }).click();
  await expect(pinned.getByText("None yet.")).toBeVisible();

  // Delete → bin → restore
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Move to bin" }).click();
  await expect(page).toHaveURL(/\/guides$/);
  await page.goto(`/guides/${code}`);
  await expect(page.getByText("That page or guide doesn’t exist")).toBeVisible();

  await page.goto("/settings");
  const row = page.getByRole("listitem").filter({ hasText: code });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(`${code} restored`)).toBeVisible();
  await page.goto(`/guides/${code}`);
  await expect(page.getByText("Restored from the bin")).toBeVisible();
});

test("import guides from a CSV file", async ({ page }) => {
  await page.goto("/guides/import");
  const csv = [
    "Client,Issue,Software,Solution",
    // Titles differ clearly; near-identical titles would (correctly) be flagged as possible duplicates.
    `Secret Client Sdn Bhd,"${RUN} Bank feed import stops at 50 lines",Accounting,"Step A; Step B"`,
    `,"${RUN} Payslip emails bounce for staff with Gmail",Payroll,"Step C"`,
    `,,POS,"no title"`,
  ].join("\n");
  await page.locator("#import-file").setInputFiles({ name: "e2e-import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Next: match columns" }).click();
  await expect(page.getByRole("combobox", { name: "Save column Client as" })).toHaveText(/Skip this column/);
  await page.getByRole("button", { name: "Next: review rows" }).click();
  await expect(page.getByText("2 ready")).toBeVisible();
  await expect(page.getByText(/1 with problem/)).toBeVisible();
  await page.getByRole("button", { name: "Import 2 guides" }).click();
  await expect(page.getByRole("heading", { name: "2 guides imported" })).toBeVisible();

  await page.goto(`/guides`);
  await page.getByLabel("Filter guides").fill("Bank feed import stops");
  await page.getByRole("link", { name: /Bank feed import stops/ }).click();
  await expect(page.getByText("Step B")).toBeVisible();
  await expect(page.getByText("Imported from e2e-import.csv")).toBeVisible();
  await expect(page.getByText("Secret Client")).toHaveCount(0);
});
