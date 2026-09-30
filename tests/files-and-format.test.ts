import { describe, expect, it } from "vitest";
import { validateFile } from "@/lib/files";
import { daysAgo, formatAmount, formatMinutes } from "@/lib/format";
import { googleFallbackUrl, OFFICIAL_SITES } from "@/lib/official-sites";

describe("validateFile", () => {
  it("accepts screenshots and PDFs under 10 MB", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp", "application/pdf"]) expect(validateFile({ name: "a", type, size: 1024 })).toBeNull();
  });

  it("rejects other file types", () => {
    expect(validateFile({ name: "notes.txt", type: "text/plain", size: 10 })).toMatch(/isn't supported/);
    expect(validateFile({ name: "x.exe", type: "application/x-msdownload", size: 10 })).toMatch(/isn't supported/);
  });

  it("rejects files over 10 MB with the actual size", () => {
    expect(validateFile({ name: "big.png", type: "image/png", size: 12 * 1048576 })).toMatch(/12\.0 MB/);
    expect(validateFile({ name: "edge.png", type: "image/png", size: 10 * 1048576 })).toBeNull();
  });
});

describe("format", () => {
  it("formats ringgit amounts with two decimals", () => {
    expect(formatAmount(23760)).toBe("23,760.00");
    expect(formatAmount(undefined)).toBe("");
  });

  it("counts whole days", () => {
    expect(daysAgo("2026-09-28T00:00:00Z", new Date("2026-09-30T12:00:00Z"))).toBe(2);
  });

  it("formats minutes", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(95)).toBe("1 h 35 min");
    expect(formatMinutes(120)).toBe("2 h");
  });
});

describe("official sites", () => {
  it("limits the Google fallback to every official site", () => {
    const url = decodeURIComponent(googleFallbackUrl("PCB bonus"));
    for (const s of OFFICIAL_SITES) expect(url).toContain(`site:${s.domain}`);
    expect(url).toContain("PCB bonus");
  });

  it("includes both AutoCount help centres", () => {
    const d = OFFICIAL_SITES.map((s) => s.domain);
    expect(d).toContain("help.accounting.autocountcloud.com");
    expect(d).toContain("help.hrms.autocountcloud.com");
  });
});
