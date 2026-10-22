import { existsSync } from "node:fs";
import { createClient, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CheckedAnswer } from "@/lib/accountant/core/answer";
import { autoMask } from "@/lib/accountant/core/mask";
import { SCENARIOS, type ExpectedLine } from "./scenarios";

/**
 * Live quality check: sends the 10 scenarios to the deployed ask-accountant function, signed in as the e2e test
 * account (E2E_EMAIL / E2E_PASSWORD in .env.local), and checks the answers. Uses about 10–20 of Groq's free daily
 * requests. Nothing is saved. Run: npm run eval:accountant
 */
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const env = (k: string) => process.env[k] ?? "";
const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "E2E_EMAIL", "E2E_PASSWORD"].filter((k) => !env(k));

const PAUSE_MS = 8_000; // stays under Groq's free 8,000 tokens a minute

/** Every expected line is found in the answer's entries (same type, side and amount), each answer line used once. */
export function containsLines(c: CheckedAnswer, expected: ExpectedLine[]): ExpectedLine[] {
  const pool = c.answer.entries.flatMap((e) => e.lines.map((l) => ({ type: l.accountType, side: l.dr !== null ? "dr" : "cr", amount: l.dr ?? l.cr ?? 0, used: false })));
  return expected.filter((x) => {
    const hit = pool.find((p) => !p.used && p.type === x.type && p.side === x.side && Math.abs(p.amount - x.amount) < 0.005);
    if (hit) hit.used = true;
    return !hit;
  });
}

/** Calls ask-accountant; when Groq's free per-minute limit is busy, waits as long as it says and tries again. */
async function askWith(sb: SupabaseClient, message: string): Promise<CheckedAnswer> {
  const masked = autoMask(message, {});
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await sb.functions.invoke<{ checked: CheckedAnswer }>("ask-accountant", { body: { message: masked.text, history: [], mask: masked.map } });
    if (!error) return data!.checked;
    const res = error instanceof FunctionsHttpError ? (error.context as Response) : null;
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, ((body?.retryAfter ?? 30) + 2) * 1000));
      continue;
    }
    throw new Error(`ask-accountant failed: ${JSON.stringify(body ?? String(error))}`);
  }
}

/** The answer's entries as short lines, shown when an expected line is missing. */
const describeEntries = (c: CheckedAnswer) =>
  c.answer.entries.map((e) => e.lines.map((l) => `${l.dr !== null ? "Dr" : "Cr"} ${l.account} (${l.accountType}) ${l.dr ?? l.cr}`).join("; ")).join(" || ");

describe.skipIf(missing.length > 0)("Accountant chat — live quality check", () => {
  let sb: SupabaseClient;

  beforeAll(async () => {
    sb = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), { auth: { persistSession: false } });
    const { error } = await sb.auth.signInWithPassword({ email: env("E2E_EMAIL"), password: env("E2E_PASSWORD") });
    if (error) throw new Error("Couldn't sign in with the test account (check E2E_EMAIL / E2E_PASSWORD).");
  });
  const ask = (message: string) => askWith(sb, message);
  afterAll(async () => {
    await sb?.auth.signOut({ scope: "local" });
  });

  for (const s of SCENARIOS) {
    it(`#${s.id} ${s.name}`, async () => {
      if (s.id > 1) await new Promise((r) => setTimeout(r, PAUSE_MS));
      const c = await ask(s.message);
      const a = c.answer;

      if (s.mustAsk) {
        expect(a.needsMoreInfo, "should ask questions first").toBe(true);
        expect(a.questions.length, "at least 2 questions").toBeGreaterThanOrEqual(2);
        return;
      }
      expect(a.needsMoreInfo, `asked instead of answering: ${a.questions.join(" | ")}`).toBe(false);
      c.entryResults.forEach((r, i) => expect(r.balanced, `entry ${i + 1}: ${r.problem}`).toBe(true));
      if (s.lines) expect(containsLines(c, s.lines), `expected lines not found. The answer gave: ${describeEntries(c)}`).toEqual([]);
      if (s.needsAccountant) expect(a.needsAccountant, "should say to check with the accountant").toBeTruthy();
      // A menu path counts as confirmed only with a non-web source behind it.
      for (const step of c.steps.filter((x) => x.status === "confirmed" && x.menuPath)) {
        const cited = c.sources.filter((src) => step.sourceIds.includes(src.id));
        expect(cited.some((src) => src.kind !== "web"), `"${step.menuPath}" confirmed without a source`).toBe(true);
      }
    });
  }
});

it.skipIf(missing.length === 0)("needs the test account in .env.local", () => {
  throw new Error(`Add ${missing.join(", ")} to .env.local to run the live quality check.`);
});
