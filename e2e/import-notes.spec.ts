import { expect, test } from "@playwright/test";
import { hasTestAccount } from "./helpers";

/** Importing Issue / Solution notes from .txt and PDF. Read-only: stops at the review step, nothing is imported. */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");

const NOTES = [
  "Issue: AutoCount Accounting - e-Invoice status Invalid, Buyer TIN is invalid",
  "Solution: Make sure the TIN is correct using the Search TIN function.",
  "",
  "Issue: AutoCount Accounting - SST on Payment credit account, what to put?",
  "Solution: Put the same account as the debit account.",
  "",
  "Issue: Printing - invoice blank",
  "Solution: Reinstall the printer driver.",
];

/** A minimal one-page PDF with one text line per entry (Helvetica), built by hand so the test needs no PDF tool. */
function makePdf(lines: string[]) {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c);
  const content = ["BT", "/F1 11 Tf", "14 TL", "50 780 Td", ...lines.flatMap((l, i) => (i ? ["T*", `(${esc(l)}) Tj`] : [`(${esc(l)}) Tj`])), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((o, i) => {
    const at = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function expectReview(page: import("@playwright/test").Page) {
  await expect(page.getByText("3 issues found")).toBeVisible();
  await page.getByRole("button", { name: "Next: match columns" }).click();
  await expect(page.getByRole("combobox", { name: "Save column Title as" })).toHaveText(/Title/);
  await expect(page.getByRole("combobox", { name: "Save column Fix steps as" })).toHaveText(/Fix steps/);
  await page.getByRole("button", { name: "Next: review rows" }).click();
  await expect(page.getByText("2 ready")).toBeVisible();
  await expect(page.getByText(/1 with problem/)).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Issue" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "e-Invoice status Invalid, Buyer TIN is invalid" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /No product/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import 2 guides" })).toBeEnabled();
}

test("a .txt file of Issue / Solution notes is split into guides for review", async ({ page }) => {
  await page.goto("/guides/import");
  await page.locator("#import-file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from(NOTES.join("\r\n")) });
  await expectReview(page);
});

test("a PDF of notes is read in the browser and split the same way", async ({ page }) => {
  await page.goto("/guides/import");
  await page.locator("#import-file").setInputFiles({ name: "notes.pdf", mimeType: "application/pdf", buffer: makePdf(NOTES.filter(Boolean)) });
  await expectReview(page);
});

test("files without notes, scanned PDFs and other file types get a clear message", async ({ page }) => {
  await page.goto("/guides/import");
  const input = page.locator("#import-file");
  await input.setInputFiles({ name: "meeting.txt", mimeType: "text/plain", buffer: Buffer.from("Agenda\nNothing to import") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No “Issue:” found in meeting.txt");
  await input.setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: makePdf([]) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("looks like a scanned PDF");
  await input.setInputFiles({ name: "notes.docx", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Use an Excel (.xlsx, .xls), CSV, PDF or text (.txt) file");
});
