import type { AnalysisResult } from "@/lib/analysis-schema";

/**
 * A ready-to-paste prompt for a second opinion in the user's own Claude app (their Pro plan; nothing is
 * sent by this app). Client names are left out on purpose.
 */
export function claudePrompt(title: string, narrative: string, r: AnalysisResult) {
  const entries = r.entries
    .map((e) => [`${e.date} ${e.description}`, ...e.lines.map((l) => `  ${l.dr ? `Dr ${l.account} ${l.dr.toFixed(2)}` : `    Cr ${l.account} ${(l.cr ?? 0).toFixed(2)}`}`)].join("\n"))
    .join("\n\n");
  return [
    "I'm an AutoCount support consultant in Malaysia. Please review this accounting treatment for a client company (functional currency RM, MFRS or MPERS).",
    "",
    `Scenario: ${title}`,
    narrative,
    "",
    `Treatment (${r.treatment.standard}):`,
    ...r.treatment.points.map((p) => `- ${p}`),
    "",
    "Proposed journal entries (RM):",
    entries,
    "",
    "Tax notes:",
    ...r.tax.map((t) => `- ${t}`),
    "",
    "Please: (1) confirm or correct the entries, (2) point out SST / e-Invoice / withholding tax issues for Malaysia, (3) say what you're unsure about. Don't state AutoCount menu paths as fact unless you're certain.",
  ].join("\n");
}
