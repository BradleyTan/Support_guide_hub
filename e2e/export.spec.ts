import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { hasTestAccount } from "./helpers";

/** Excel exports (read-only: files are downloaded inside the test browser and checked, nothing is saved). */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");
test.skip(({ isMobile }) => isMobile, "downloads checked once, on desktop");

async function workbook(path: string) {
  return XLSX.read(await readFile(path));
}

test("the guide library exports the guides shown, in the import layout", async ({ page }) => {
  await page.goto("/guides");
  const exportButton = page.getByRole("button", { name: /^Export/ });
  test.skip(await exportButton.isDisabled(), "the test account has no guides");
  const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
  expect(download.suggestedFilename()).toMatch(/^support-desk-guides-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = await workbook((await download.path())!);
  expect(wb.SheetNames).toEqual(["Guides"]);
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Guides, { header: 1 });
  expect(rows[0].slice(0, 4)).toEqual(["Title", "Product", "Version", "Module"]);
  expect(rows.length).toBeGreaterThan(1);
});

test("Settings exports everything as one workbook", async ({ page }) => {
  await page.goto("/settings");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export to Excel" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^support-desk-everything-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const wb = await workbook((await download.path())!);
  expect(wb.SheetNames).toEqual(["Guides", "Analyses", "SOPs", "Templates", "Version notes"]);
  await expect(page.getByText("Exported")).toBeVisible();
});
