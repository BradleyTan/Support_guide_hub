import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { imageFromClipboard, ocrTextToQuery, QUERY_MAX, validateScreenshot } from "@/lib/ocr-text";
import { OCR_ASSETS } from "../scripts/copy-ocr-assets.mjs";

describe("ocrTextToQuery", () => {
  it("joins the lines of an error message into one search", () => {
    expect(ocrTextToQuery("Cannot connect to\n  SQL Server.\n\nLogin failed for user 'sa'.")).toBe("Cannot connect to SQL Server. Login failed for user 'sa'.");
  });

  it("drops lines that are only stray marks from icons and window borders", () => {
    expect(ocrTextToQuery("| _\nx\n© =\nPosting date is out of range\n— ||")).toBe("Posting date is out of range");
  });

  it("keeps short codes and numbers", () => {
    expect(ocrTextToQuery("Error 5023\nOK")).toBe("Error 5023 OK");
  });

  it("stops at a whole word when the screenshot holds a lot of text", () => {
    const q = ocrTextToQuery(Array.from({ length: 80 }, (_, i) => `word${i}`).join(" "));
    expect(q.length).toBeLessThanOrEqual(QUERY_MAX);
    expect(q).toMatch(/word\d+$/);
    expect(q.startsWith("word0 word1 ")).toBe(true);
  });

  it("is empty when nothing readable was found", () => {
    expect(ocrTextToQuery("")).toBe("");
    expect(ocrTextToQuery(" \n | \n -- ")).toBe("");
  });
});

describe("validateScreenshot", () => {
  it("accepts PNG, JPG and WEBP images up to 10 MB", () => {
    expect(validateScreenshot({ type: "image/png", size: 500_000 })).toBeNull();
    expect(validateScreenshot({ type: "image/jpeg", size: 10 * 1024 * 1024 })).toBeNull();
    expect(validateScreenshot({ type: "image/webp", size: 1 })).toBeNull();
  });

  it("explains other files and oversized images", () => {
    expect(validateScreenshot({ type: "application/pdf", size: 1000 })).toBe("Use a PNG, JPG or WEBP image.");
    expect(validateScreenshot({ type: "image/png", size: 10 * 1024 * 1024 + 1 })).toBe("That image is over 10 MB. Crop it to the error message and try again.");
  });
});

describe("imageFromClipboard", () => {
  const file = (type: string) => ({ type }) as File;
  const item = (kind: string, type: string) => ({ kind, type, getAsFile: () => file(type) });

  it("finds a pasted image", () => {
    expect(imageFromClipboard([item("string", "text/plain"), item("file", "image/png")])?.type).toBe("image/png");
  });

  it("leaves pasted text and other files alone", () => {
    expect(imageFromClipboard([item("string", "text/plain")])).toBeNull();
    expect(imageFromClipboard([item("file", "application/pdf")])).toBeNull();
    expect(imageFromClipboard(undefined)).toBeNull();
  });
});

describe("OCR engine files", () => {
  it("are all present in node_modules, so the copy before dev and build can't silently miss one", () => {
    for (const f of OCR_ASSETS) expect(existsSync(f), f).toBe(true);
  });
});
