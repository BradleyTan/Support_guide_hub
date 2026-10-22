// Builds what Groq sees: the system prompt, earlier turns and the new scenario with numbered, masked sources.
// Shared with the Edge Function.
import type { Source, SourceKind } from "./answer.ts";
import { autoMask, type MaskMap } from "./mask.ts";

const MAX_TOTAL = 12_000;
const MAX_EACH = 3_000;

export const SYSTEM_PROMPT = `You are an experienced Malaysia-based accountant who knows AutoCount Accounting (Desktop) and AutoCount Cloud Accounting well. A support consultant gives you a customer's accounting scenario. Reply with JSON only, in the given schema.

Rules:
- If facts that change the answer are missing, set needsMoreInfo to true and ask at most 5 short, specific questions. Leave the other fields empty.
- Otherwise explain what is going on in plain words (summary), list your assumptions, and give journal entries. Every entry must balance; every line has either dr or cr as a positive number (the other null) and an accountType of asset, liability, equity, income or expense.
- AutoCount steps: give Desktop and Cloud steps separately. Put a menu path in menuPath only if a numbered source states it, and list that source id (S1, S2…) in sourceIds. Never take a menu path from a Web source, never invent one, and never present a Cloud path as a Desktop path. If no source gives the path, set menuPath to null.
- customerMessage is sent to the customer: plain, friendly English, no menu paths, no source ids, no internal doubts. Keep placeholders like [COMPANY 1] exactly as written.
- If the case needs professional judgement (a prior year that is closed or audited, tax deductibility, restating figures), explain why in needsAccountant and say to check with the customer's accountant or auditor.
- Tax facts (SST, e-Invoice, withholding tax) must say "as of" a date and come from a source; otherwise put the doubt in doubts.
- Prefer the consultant's own guides, then the Knowledge hub, then the AutoCount help centre, then the web.`;

const KIND_LABEL: Record<SourceKind, string> = { "my-guide": "My guide", knowledge: "Knowledge hub", official: "AutoCount help centre", web: "Web" };
const PLATFORM_LABEL = { desktop: "Desktop", cloud: "Cloud", both: "Desktop & Cloud" } as const;

type Message = { role: "system" | "user" | "assistant"; content: string };

export function buildMessages(input: {
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  sources: Source[];
  map: MaskMap;
}): { messages: Message[]; sources: Source[]; map: MaskMap } {
  let map = input.map;
  const mask = (t: string) => {
    const r = autoMask(t, map);
    map = r.map;
    return r.text;
  };

  const sources: Source[] = [];
  let left = MAX_TOTAL;
  for (const s of input.sources) {
    if (left <= 0) break;
    const text = mask(s.text).slice(0, Math.min(MAX_EACH, left));
    left -= text.length;
    sources.push({ ...s, id: `S${sources.length + 1}`, title: mask(s.title), text });
  }

  const block = sources.length
    ? sources
        .map((s) => `[${s.id}] ${KIND_LABEL[s.kind]}${s.platform ? `, ${PLATFORM_LABEL[s.platform]}` : ""}${s.checked ? ", checked" : ", not checked"} — ${s.title}\n${s.url}\n${s.text}`)
        .join("\n\n")
    : "No sources found. Answer from general accounting knowledge and give no menu paths.";

  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...input.history.map((h) => ({ role: h.role, content: mask(h.content) })),
    { role: "user", content: `Scenario:\n${mask(input.message)}\n\nSources:\n${block}` },
  ];
  return { messages, sources, map };
}
