import { expect, test } from "./fixtures";
import { createClient } from "@supabase/supabase-js";
import { allowWrites, hasTestAccount } from "./helpers";

test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

test.describe("read-only", () => {
  test("the USD deposit scenario shows five balanced entries", async ({ page }) => {
    await page.goto("/analyst?scenario=usd-deposit-sst-partial");
    await expect(page.getByRole("heading", { name: /Foreign deposit/ })).toBeVisible();
    await expect(page.getByText("Dr = Cr")).toHaveCount(5);
    await expect(page.getByText("Does not balance")).toHaveCount(0);
    await expect(page.getByText("Needs verification").first()).toBeVisible();
  });

  test("changing a figure recalculates, and bad input explains itself", async ({ page }) => {
    await page.goto("/analyst?scenario=service-tax-invoice");
    await expect(page.getByRole("cell", { name: "21,600.00" }).first()).toBeVisible();
    await page.getByLabel("Service amount before tax (RM)").fill("1000");
    await expect(page.getByRole("cell", { name: "1,080.00" }).first()).toBeVisible();
    await page.getByLabel("Service tax rate (%)").fill("150");
    await expect(page.getByText(/can't be more than 100/)).toBeVisible();
    await expect(page.getByText("Fix the highlighted figures to see the entries.")).toBeVisible();
  });

  test("picking scenarios from the list and filtering", async ({ page }) => {
    await page.goto("/analyst");
    await page.getByLabel("Filter list").fill("payroll");
    await page.getByRole("button", { name: /Monthly payroll journal/ }).click();
    await expect(page).toHaveURL(/scenario=payroll-journal/);
    await expect(page.getByRole("cell", { name: "Salaries payable (net pay)" })).toBeVisible();
  });

  test("your own entry can't be saved until it balances", async ({ page }) => {
    await page.goto("/analyst?manual=1");
    await page.getByLabel("Title").fill("Balance check");
    await page.getByLabel("Line 1 account").fill("Rental deposit");
    await page.getByLabel("Line 1 debit").fill("3000");
    await page.getByLabel("Line 2 account").fill("Bank");
    await page.getByLabel("Line 2 credit").fill("2999.99");
    await expect(page.getByText("Out of balance by RM 0.01")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to history" })).toBeDisabled();
    await page.getByLabel("Line 2 credit").fill("3000");
    await expect(page.getByRole("status").filter({ hasText: "Dr = Cr" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save to history" })).toBeEnabled();
  });
});

test.describe("saving (writes data)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "write tests run once, on desktop");
  test.skip(!allowWrites, "Set E2E_ALLOW_WRITES=1 to run tests that save data");

  const created: string[] = []; // analysis codes made by this run, removed afterwards

  test.afterAll(async () => {
    if (!allowWrites) return;
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    if (created.length) await sb.from("analyses").delete().in("code", created);
    await sb.from("analyses").delete().like("title", "[e2e]%");
    await sb.from("guides").delete().like("title", "[e2e]%");
    await sb.auth.signOut({ scope: "local" });
  });

  test("save a calculation to history and reopen it in the calculator", async ({ page }) => {
    await page.goto("/analyst?scenario=depreciation");
    await page.getByLabel("Asset").fill("[e2e] laptop");
    await page.getByRole("button", { name: "Save to history" }).click();
    const toast = page.getByText(/^Saved as AN-\d+$/);
    await expect(toast).toBeVisible();
    const code = (await toast.textContent())!.replace("Saved as ", "");
    created.push(code);

    await page.getByRole("tab", { name: /History/ }).click();
    await page.getByRole("button", { name: new RegExp(code) }).click();
    await expect(page).toHaveURL(new RegExp(`analysis=${code}`));
    await page.getByRole("button", { name: "Open in calculator" }).click();
    await expect(page.getByLabel("Asset")).toHaveValue("[e2e] laptop");
  });

  test("build your own entry, turn it into a guide, then delete the analysis", async ({ page }) => {
    await page.goto("/analyst?manual=1");
    await page.getByLabel("Title").fill(`[e2e] ${Date.now()} reclassify deposit`);
    await page.getByLabel("Line 1 account").fill("Rental deposit");
    await page.getByLabel("Line 1 debit").fill("3000");
    await page.getByLabel("Line 2 account").fill("Bank");
    await page.getByLabel("Line 2 credit").fill("3000");
    await page.getByRole("button", { name: "Save to history" }).click();
    await expect(page).toHaveURL(/analysis=AN-\d+/);
    const code = new URL(page.url()).searchParams.get("analysis")!;
    created.push(code);

    await page.getByRole("button", { name: "Save as guide" }).click();
    await expect(page).toHaveURL(/\/guides\/G-\d+$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(code);
    await expect(page.getByText(/Dr Rental deposit 3000\.00/)).toBeVisible();

    await page.goto(`/analyst?analysis=${code}`);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`${code} deleted`)).toBeVisible();
  });
});
