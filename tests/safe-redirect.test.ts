import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext", () => {
  it("allows paths inside the app", () => {
    expect(safeNext("/reset-password")).toBe("/reset-password");
    expect(safeNext("/guides?product=AutoCount%20POS")).toBe("/guides?product=AutoCount%20POS");
  });

  it("blocks redirects to other sites", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
  });

  it("falls back for missing or non-string values", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined, "/login")).toBe("/login");
  });
});
