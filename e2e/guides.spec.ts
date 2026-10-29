import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { allowWrites, e2eCleanup } from "./helpers";

/**
 * Guide library write tests: they create and change guides (the test account is a member, so it can't verify or delete), so they only run when
 * E2E_ALLOW_WRITES=1 and a test account is set (signed in via auth.setup.ts). Everything they
 * create has a title starting with "[e2e]" and is removed afterwards through e2e_cleanup().
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
  // Uploaded files stay in storage: members can't delete storage objects, only the owner can.
  await e2eCleanup();
});

test("create, edit, attach and pin on a guide; a member has no verify, unpin or delete", async ({ page }) => {
  // Create
  await page.goto("/guides/new");
  await page.getByRole("button", { name: "Save guide" }).click();
  await expect(page.getByText("Give the guide a title so you can find it later.")).toBeVisible();
  await expect(page.getByText("Add at least one fix step.")).toBeVisible();

  await page.getByLabel("Title").fill(`${RUN} Report template missing after upgrade`);
  await pick(page, "Product", "Accounting");
  await pick(page, "Platform", "Cloud");
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
  await expect(page.getByRole("definition").filter({ hasText: /^Cloud$/ })).toBeVisible();

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

  // Verifying is owner-only: a member sees neither button, and the page says who edited it.
  await expect(page.getByRole("button", { name: "Mark verified" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark unverified" })).toHaveCount(0);
  await expect(page.getByText(/^Last edited by /)).toBeVisible();

  // Attach a small PNG, then reject a wrong file type
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "e2e-shot.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Open e2e-shot.png" }).first()).toBeVisible({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await expect(page.getByText("this file type isn't supported")).toBeVisible();

  // Pin an official help-centre article from Search and see it on the guide. Unpinning is owner-only.
  await page.goto("/search?q=bank%20reconciliation");
  await page.getByRole("button", { name: /^Pin “/ }).first().click();
  await page.getByLabel("Find a guide").fill(code);
  await page.getByRole("button", { name: new RegExp(code) }).click();
  await expect(page.getByText(`Pinned to ${code}`)).toBeVisible();
  await page.goto(`/guides/${code}`);
  const pinned = page.locator("aside section", { has: page.getByText("Pinned official sources") });
  await expect(pinned.locator('a[href^="https://help.accounting.autocountcloud.com/"]')).toBeVisible();
  await expect(pinned.getByRole("button", { name: /^Unpin/ })).toHaveCount(0);

  // Deleting, removing an attachment and the bin are owner-only too.
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove e2e-shot/ })).toHaveCount(0);
  await page.goto("/settings");
  await expect(page.getByText("Deleted guides")).toHaveCount(0);
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
