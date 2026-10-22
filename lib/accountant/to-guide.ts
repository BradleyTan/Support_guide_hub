import type { CheckedAnswer } from "@/lib/accountant/core/answer";
import { formatRM } from "@/lib/accountant/core/checks";
import type { GuideInput } from "@/lib/guide-schema";
import type { Platform } from "@/lib/types";

/**
 * Prefill for "Save as guide": the scenario becomes the symptom, the explanation the cause (with the balanced
 * entries), and only confirmed steps become fix steps. The user picks the product and saves; it starts Unverified.
 */
export function answerToGuideInput(checked: CheckedAnswer, scenario: string): Partial<GuideInput> {
  const a = checked.answer;
  const firstSentence = a.summary.split(/(?<=[.!?])\s+/)[0] ?? "";
  const title = (firstSentence || scenario).replace(/\s+/g, " ").trim().slice(0, 300);

  const journal = a.entries
    .filter((_, i) => checked.entryResults[i]?.balanced)
    .map((e) => `Journal: ${e.lines.map((l) => (l.dr !== null ? `Dr ${l.account} ${formatRM(Math.round(l.dr * 100))}` : `Cr ${l.account} ${formatRM(Math.round((l.cr ?? 0) * 100))}`)).join(" / ")}`);

  const confirmed = checked.steps.filter((s) => s.status === "confirmed");
  const steps = confirmed.map((s) => (s.menuPath ? `${s.text} (${s.menuPath})` : s.text).slice(0, 2000));
  const platforms = new Set(confirmed.map((s) => s.platform));
  const platform: Platform = platforms.size === 2 ? "both" : platforms.has("cloud") ? "cloud" : "desktop";

  return {
    title,
    symptom: scenario.slice(0, 4000),
    cause: [a.summary, ...journal].join("\n\n").slice(0, 4000),
    steps: steps.length ? steps : ["Check the steps with AutoCount and add them here."],
    prevention: "",
    tags: ["accountant-chat"],
    platform,
  };
}
