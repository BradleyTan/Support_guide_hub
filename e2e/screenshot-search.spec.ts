import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { hasTestAccount } from "./helpers";

/** Search by screenshot. Read-only: the image is drawn in the test browser, read there, and nothing is saved. */
test.skip(!hasTestAccount, "Set E2E_EMAIL and E2E_PASSWORD to run signed-in tests");
test.skip(({ isMobile }) => isMobile, "screenshot reading checked once, on desktop");

const ERROR_TEXT = "Posting date is out of range";
const READ_TIMEOUT = 90_000;

/** A PNG of black text on white, like a cropped error dialog, as base64. */
function drawScreenshot(page: Page, text: string) {
  return page.evaluate((t) => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.font = "40px Arial, sans-serif";
    ctx.fillText(t, 30, 95);
    return canvas.toDataURL("image/png").split(",")[1];
  }, text);
}

test("a chosen screenshot is read in the browser and searched, using only the app's own files", async ({ page }) => {
  test.setTimeout(READ_TIMEOUT + 30_000);
  await page.goto("/search");
  const png = await drawScreenshot(page, ERROR_TEXT);
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));
  const engine = page.waitForResponse((r) => r.url().endsWith("/ocr/eng.traineddata.gz") && r.ok());

  await page.getByLabel("Search by screenshot: choose an image").setInputFiles({ name: "error.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.getByRole("button", { name: "Search by screenshot", exact: true })).toBeDisabled();
  await engine;

  await expect(page.getByLabel("Search", { exact: true })).toHaveValue(new RegExp(ERROR_TEXT, "i"), { timeout: READ_TIMEOUT });
  await expect(page).toHaveURL(/\/search\?q=Posting/);
  await expect(page.getByRole("heading", { name: "Official AutoCount sources" })).toBeVisible();
  // The engine and its language file came from this site, not a public CDN.
  expect([...hosts].filter((h) => /jsdelivr|unpkg|tessdata|githubusercontent/.test(h))).toEqual([]);
});

test("pasting a screenshot on Home opens Search with its text", async ({ page }) => {
  test.setTimeout(READ_TIMEOUT + 30_000);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Search by screenshot", exact: true })).toBeVisible();
  const png = await drawScreenshot(page, ERROR_TEXT);
  await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const data = new DataTransfer();
    data.items.add(new File([blob], "error.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, png);
  await expect(page).toHaveURL(/\/search\?q=Posting/, { timeout: READ_TIMEOUT });
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue(new RegExp(ERROR_TEXT, "i"));
});

test("search results mark the words that matched", async ({ page }) => {
  await page.goto("/search?q=bank%20reconciliation");
  const official = page.locator("section", { has: page.getByRole("heading", { name: "Official AutoCount sources" }) });
  await expect(official.locator("mark").first()).toBeVisible();
  await expect(official.locator("mark").first()).toHaveText(/^(bank|reconcil)/i);
});

test("a screenshot fills a new guide's error message, and nothing is saved", async ({ page }) => {
  test.setTimeout(READ_TIMEOUT + 30_000);
  await page.goto("/guides/new");
  const png = await drawScreenshot(page, ERROR_TEXT);
  await page.getByLabel("Fill error message from a screenshot: choose an image").setInputFiles({ name: "error.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.getByLabel("Error message", { exact: true })).toHaveValue(new RegExp(ERROR_TEXT, "i"), { timeout: READ_TIMEOUT });
  await expect(page).toHaveURL(/\/guides\/new$/);
});

test("a file that isn't an image gets a clear message", async ({ page }) => {
  await page.goto("/search");
  await page.getByLabel("Search by screenshot: choose an image").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("Use a PNG, JPG or WEBP image.")).toBeVisible();
});
