import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CORE = "lib/accountant/core";
const COPY = "supabase/functions/_shared/accountant-core";

describe("accountant core copy for the Edge Function", () => {
  it("each core file is byte-identical in the Edge Function copy (run npm run sync:core)", () => {
    const files = readdirSync(CORE).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      // Compare with line endings normalised: git may check files out with CRLF on Windows.
      const a = readFileSync(`${CORE}/${f}`, "utf8").replace(/\r\n/g, "\n");
      const b = readFileSync(`${COPY}/${f}`, "utf8").replace(/\r\n/g, "\n");
      expect(b, f).toBe(a);
    }
    expect(readdirSync(COPY).filter((f) => f.endsWith(".ts")).sort()).toEqual(files.sort());
  });
});
