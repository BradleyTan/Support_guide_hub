import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { allowWrites, hasTestAccount } from "./helpers";

/** Reply generator, templates, SOP builder and version notes (Phase 6). */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

async function needsGuides(page: Page) {
  if (await page.getByText(/Nothing to reply about yet|You need a guide first/).isVisible()) test.skip(true, "the test account has no guides");
}

test.describe("read-only", () => {
  test("a reply is built from a guide, with the client's name, for email or WhatsApp", async ({ page }) => {
    await page.goto("/replies");
    await expect(page.getByRole("heading", { level: 1, name: "Reply generator" })).toBeVisible();
    await needsGuides(page);
    const draft = page.getByLabel("Reply draft");
    await expect(draft).toHaveValue(/^Hi there,/);
    await page.getByLabel("Client’s name").fill("Ms Tan");
    await expect(draft).toHaveValue(/^Hi Ms Tan,/);
    await expect(draft).not.toHaveValue(/\{[a-z]+\}/);
    await page.getByRole("button", { name: "WhatsApp" }).click();
    await expect(page.getByText(/WhatsApp · Standard reply/)).toBeVisible();
    await draft.fill("My own wording");
    await expect(page.getByRole("button", { name: "Undo my edits" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo my edits" }).click();
    await expect(draft).toHaveValue(/^Hi Ms Tan,/);
  });

  test("a new SOP starts from the guide's steps", async ({ page }) => {
    await page.goto("/sop");
    await expect(page.getByRole("heading", { level: 1, name: "SOP builder" })).toBeVisible();
    await needsGuides(page);
    await page.getByRole("button", { name: "Create SOP" }).click();
    await expect(page).toHaveURL(/\/sop\/new\?guide=G-\d+$/);
    await expect(page.getByLabel("Title")).toHaveValue(/^SOP: /);
    await expect(page.getByLabel("Step 1", { exact: true })).not.toHaveValue("");
    await page.getByRole("button", { name: "Add step" }).click();
    await expect(page.getByRole("button", { name: /Move step 1 up/ })).toBeDisabled();
  });

  test("old SOP links from guides still work", async ({ page }) => {
    await page.goto("/sop?guide=G-99999");
    await expect(page).toHaveURL(/\/sop\/new\?guide=G-99999$/);
    await expect(page.getByText("That page or guide doesn’t exist")).toBeVisible();
  });

  test("template and version-note forms explain what's missing (nothing is saved)", async ({ page }) => {
    await page.goto("/templates");
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByRole("button", { name: "Create template" }).click();
    await expect(page.getByText("Give the template a name.")).toBeVisible();
    await page.getByRole("button", { name: "{steps}" }).click();
    await expect(page.getByLabel("Text")).toHaveValue("{steps}");
    await page.keyboard.press("Escape");

    await page.goto("/releases");
    await page.getByRole("button", { name: /^Add (a )?note$/ }).first().click();
    await page.getByRole("button", { name: "Add note" }).last().click();
    await expect(page.getByText("Choose the product.")).toBeVisible();
    await expect(page.getByText(/Enter the AutoCount version/)).toBeVisible();
  });
});

test.describe("saving (writes data)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "write tests run once, on desktop");
  test.skip(!allowWrites, "Set E2E_ALLOW_WRITES=1 to run tests that save data");

  const RUN = `[e2e] ${Date.now()}`;

  test.afterAll(async () => {
    if (!allowWrites) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    await sb.from("templates").delete().like("title", "[e2e]%");
    await sb.from("sops").delete().like("title", "%[e2e]%");
    await sb.from("release_notes").delete().like("title", "[e2e]%");
    await sb.auth.signOut({ scope: "local" });
  });

  test("create a reply template, use it in a reply, then delete it", async ({ page }) => {
    await page.goto("/templates");
    await page.getByRole("button", { name: "New template" }).click();
    await page.getByLabel("Name").fill(`${RUN} reply`);
    await page.getByLabel("Text").fill("Dear {contact},\n\nCause: {cause}\n{steps}\n\nRegards, Support");
    await page.getByRole("button", { name: "Create template" }).click();
    await expect(page.getByText("Template created")).toBeVisible();
    await page.getByRole("link", { name: "Use in a reply" }).click();
    await expect(page).toHaveURL(/\/replies\?template=/);
    await needsGuides(page);
    await page.getByLabel("Client’s name").fill("Encik Ali");
    await expect(page.getByLabel("Reply draft")).toHaveValue(/^Dear Encik Ali,[\s\S]*Regards, Support$/);

    await page.goto("/templates");
    // Plain-text match: "[e2e]" has a special meaning in a regular expression.
    await page.getByRole("button", { name: `${RUN} reply` }).click();
    await page.getByRole("button", { name: "Delete template" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(`Deleted “${RUN} reply”`)).toBeVisible();
  });

  test("save an SOP, print it, then delete it", async ({ page }) => {
    await page.goto("/sop");
    await needsGuides(page);
    await page.getByRole("button", { name: "Create SOP" }).click();
    await page.getByLabel("Title").fill(`SOP ${RUN}`);
    await page.getByLabel("Step 1", { exact: true }).fill("Open Tools > Options");
    await page.getByRole("button", { name: "Add check" }).click();
    await page.getByLabel("Check 1").fill("Invoice prints with all lines");
    await page.getByRole("button", { name: "Save SOP" }).first().click();
    await expect(page).toHaveURL(/\/sop\/SOP-\d+$/);

    await page.getByRole("link", { name: "Print / Save as PDF" }).click();
    await expect(page).toHaveURL(/\/sop\/SOP-\d+\/print$/);
    await expect(page.getByRole("heading", { level: 1, name: `SOP ${RUN}` })).toBeVisible();
    await expect(page.getByText("Open Tools > Options")).toBeVisible();
    await expect(page.getByText("Invoice prints with all lines")).toBeVisible();

    await page.getByRole("link", { name: "Back to editing" }).click();
    await page.getByRole("button", { name: "Delete SOP" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/sop$/);
  });

  test("a version note linked to a guide shows on the guide page", async ({ page }) => {
    await page.goto("/releases");
    await page.getByRole("button", { name: /^Add (a )?note$/ }).first().click();
    await page.getByLabel("Product").click();
    await page.getByRole("option", { name: "Accounting" }).click();
    await page.getByLabel("Version").fill("9.9");
    await page.getByLabel("Title").fill(`${RUN} note`);
    const firstGuide = page.getByRole("dialog").getByRole("checkbox").first();
    test.skip(!(await firstGuide.isVisible()), "the test account has no guides");
    await firstGuide.check();
    const guideCode = (await page.getByRole("dialog").locator("label", { has: firstGuide }).locator(".font-mono").textContent())!;
    await page.getByRole("button", { name: "Add note" }).last().click();
    await expect(page.getByText("Note added")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Accounting 9.9" })).toBeVisible();

    await page.goto(`/guides/${guideCode}`);
    await expect(page.getByRole("heading", { name: "Version notes" })).toBeVisible();
    await expect(page.getByText(`${RUN} note`)).toBeVisible();

    await page.goto("/releases");
    await page.getByRole("button", { name: `Delete note: ${RUN} note` }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Note deleted")).toBeVisible();
  });
});
