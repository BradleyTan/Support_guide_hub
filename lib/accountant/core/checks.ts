// Plain-code checks on Groq's answer: entries must balance, menu paths must come from a checked source of the
// right platform, and the customer reply is built only from what passed. Shared with the Edge Function.
import type { CheckedAnswer, CheckedStep, ModelAnswer, ModelEntry, ModelStep, Source } from "./answer.ts";
import { PLACEHOLDER, type MaskMap } from "./mask.ts";

export const NOT_CONFIRMED_SENTENCE = "I'll confirm the exact menu and get back to you.";
export const UNBALANCED_LABEL = "Didn't balance — not sent to the customer";
const UNKNOWN_PLACEHOLDERS = "Customer reply had unknown placeholders";
const PATH_IN_TEXT = /\w[\w/ ]*\s(>|→)\s\w/;

const toSen = (n: number) => Math.round(n * 100);

export function formatRM(sen: number): string {
  const [whole, cents] = (Math.abs(sen) / 100).toFixed(2).split(".");
  return `${sen < 0 ? "-" : ""}RM${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

export function checkEntry(e: ModelEntry): { balanced: boolean; problem: string | null } {
  let dr = 0;
  let cr = 0;
  for (const l of e.lines) {
    const hasDr = l.dr !== null;
    const hasCr = l.cr !== null;
    if (hasDr === hasCr) return { balanced: false, problem: `"${l.account}" needs either a debit or a credit, not both or neither.` };
    const amount = (hasDr ? l.dr : l.cr) as number;
    if (!(toSen(amount) > 0)) return { balanced: false, problem: `"${l.account}" has an amount that isn't above zero.` };
    if (hasDr) dr += toSen(amount);
    else cr += toSen(amount);
  }
  if (dr !== cr) return { balanced: false, problem: `Debits ${formatRM(dr)} and credits ${formatRM(cr)} differ by ${formatRM(Math.abs(dr - cr))}.` };
  return { balanced: true, problem: null };
}

/** Lowercase, single spaces, every arrow style as " > ". "/" is kept: AutoCount menus use it (A/R, A/P). */
export function normalizePath(p: string): string {
  return p
    .toLowerCase()
    .replace(/\s*(?:→|»|›|->|>)\s*/g, " > ")
    .replace(/\s+/g, " ")
    .trim();
}

const fitsPlatform = (s: Source, step: ModelStep) => s.platform === "both" || s.platform === step.platform;

export function checkStep(step: ModelStep, sources: Source[]): CheckedStep {
  if (!step.menuPath) return { ...step, status: "confirmed" };
  const path = normalizePath(step.menuPath);
  const backing = sources.filter((s) => step.sourceIds.includes(s.id) && s.kind !== "web" && fitsPlatform(s, step) && normalizePath(s.text).includes(path));
  if (backing.some((s) => s.checked)) return { ...step, status: "confirmed" };
  if (backing.length) return { ...step, status: "unverified-source" };
  return { ...step, status: "not-confirmed" };
}

const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.trim());

export function buildCustomerReply(a: ModelAnswer, steps: CheckedStep[], entries: { balanced: boolean }[], map: MaskMap): { reply: string | null; flags: string[] } {
  if (a.needsMoreInfo) return { reply: null, flags: [] };
  const flags: string[] = [];

  const kept = sentences(a.customerMessage.replace(/\s*\[S\d+\]/g, "")).filter((s) => !PATH_IN_TEXT.test(s));
  if (kept.length < sentences(a.customerMessage).length) flags.push("Removed a menu path from the customer message");
  const parts = [kept.join(" ")];

  const good = a.entries.filter((_, i) => entries[i]?.balanced);
  if (good.length) {
    const lines = good.flatMap((e) => [
      e.description ? `${e.description}:` : "Journal entry:",
      ...e.lines.map((l) => (l.dr !== null ? `Dr ${l.account} ${formatRM(toSen(l.dr))}` : `Cr ${l.account} ${formatRM(toSen(l.cr as number))}`)),
    ]);
    parts.push(lines.join("\n"));
  }

  for (const [platform, heading] of [["desktop", "AutoCount (Desktop):"], ["cloud", "AutoCount Cloud:"]] as const) {
    const group = steps.filter((s) => s.platform === platform);
    if (!group.length) continue;
    const lines = group.map((s, i) => {
      const ok = s.status === "confirmed";
      const text = ok ? s.text : sentences(s.text).filter((x) => !PATH_IN_TEXT.test(x)).join(" ");
      const path = s.menuPath ? (ok ? ` — ${s.menuPath}` : ` ${NOT_CONFIRMED_SENTENCE}`) : "";
      return `${i + 1}. ${text}${path}`.trim();
    });
    parts.push([heading, ...lines].join("\n"));
  }

  const reply = parts.filter((p) => p.trim()).join("\n\n");
  const tokens = reply.match(/\[[^\]\n]{1,40}\]/g) ?? [];
  const known = new Set(Object.keys(map));
  if (tokens.some((t) => !known.has(t) || !new RegExp(`^${PLACEHOLDER.source}$`).test(t))) {
    flags.push(UNKNOWN_PLACEHOLDERS);
    return { reply: null, flags };
  }
  return { reply, flags };
}

export function checkAnswer(a: ModelAnswer, sources: Source[], map: MaskMap): CheckedAnswer {
  const publicSources = sources.map((s) => ({ id: s.id, kind: s.kind, title: s.title, url: s.url, platform: s.platform, checked: s.checked }));
  if (a.needsMoreInfo) {
    return { answer: { ...a, entries: [], steps: [], customerMessage: "" }, entryResults: [], steps: [], customerReply: null, sources: publicSources, flags: [] };
  }
  const entryResults = a.entries.map(checkEntry);
  const steps = a.steps.map((s) => checkStep(s, sources));
  const { reply, flags } = buildCustomerReply(a, steps, entryResults, map);
  entryResults.forEach((r, i) => !r.balanced && flags.push(`Entry ${i + 1}: ${UNBALANCED_LABEL}`));
  return { answer: a, entryResults, steps, customerReply: reply, sources: publicSources, flags };
}
