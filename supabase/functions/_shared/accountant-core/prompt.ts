// Builds what Groq sees: the system prompt, earlier turns and the new scenario with numbered, masked sources.
// Shared with the Edge Function.
import type { Source, SourceKind } from "./answer.ts";
import { autoMask, PLACEHOLDER, type MaskMap } from "./mask.ts";

const MAX_TOTAL = 9_000; // keeps one answer well inside Groq's free 8,000 tokens a minute
const MAX_EACH = 2_500;

export const SYSTEM_PROMPT = `You are an experienced Malaysia-based accountant who knows AutoCount Accounting (Desktop) and AutoCount Cloud Accounting well. A support consultant gives you a customer's accounting scenario. Reply with JSON only, in the given schema.

Rules:
- If facts that change the answer are missing, set needsMoreInfo to true and ask at most 5 short, specific questions. Leave the other fields empty.
- Do not ask when the scenario already gives what you need, or when a reasonable, common assumption would do: answer, and list that assumption in assumptions. Questions are for facts that would change the entries.
- Otherwise explain what is going on in plain words (summary), list your assumptions, and give journal entries. Every entry must balance; every line has either dr or cr as a positive number (the other null) and an accountType of asset, liability, equity, income or expense.
- AutoCount steps: give Desktop and Cloud steps separately. Put a menu path in menuPath only if a numbered source states it, and list that source id (S1, S2…) in sourceIds. Never take a menu path from a Web source, never invent one, and never present a Cloud path as a Desktop path. If no source gives the path, set menuPath to null.
- customerMessage is sent to the customer: plain, friendly English, no menu paths, no source ids, no internal doubts. Keep placeholders like [COMPANY 1] exactly as written.
- Always ask first (needsMoreInfo) when the scenario involves money or documents from an earlier financial year and does not say how they were recorded at the time, or whether that year is closed or audited. Ask where the money went when it was banked (a receipt to the customer, a deposit, suspense, other income, or not recorded at all) before giving any entry.
- If the case needs professional judgement, explain why in needsAccountant and say to check with the customer's accountant or auditor. Always set needsAccountant for: writing off bad debts (whether it is tax-deductible depends on recovery efforts), corrections to a closed or audited year, restating figures, and tax treatment that depends on the customer's registration or circumstances.
- Tax facts (SST, e-Invoice, withholding tax) must say "as of" a date and come from a source; otherwise put the doubt in doubts.
- Prefer the consultant's own guides, then the Knowledge hub, then the AutoCount help centre, then the web.

Accounting conventions to follow:
- Money received before an invoice, or more than the customer owes, is a credit on the customer's account (or a customer deposit / advance, a liability). Refunding it reverses that: Dr the customer's account (or the deposit), Cr Bank. A refund of an overpayment is never a sales return and never touches sales.
- Price reductions, discounts or returns after invoicing go through a credit note: Dr sales (or sales returns), Dr output tax if tax was charged, Cr the customer's account.
- Deposits paid to suppliers are assets until applied against the supplier's invoice.
- A contra between a customer who is also a supplier: Dr the supplier (creditor), Cr the customer (debtor), for the smaller amount.
- Exchange differences when a foreign-currency invoice is settled are a realised exchange gain (income) or loss (expense).
- Prepayments are assets released to expense over the period they cover; accruals are liabilities for costs incurred but not yet billed, reversed when the bill arrives.
- Writing off a bad debt with no earlier allowance: Dr bad debts (expense), Cr the customer's account.`;

const KIND_LABEL: Record<SourceKind, string> = { "my-guide": "My guide", knowledge: "Knowledge hub", official: "AutoCount help centre", web: "Web" };
const PLATFORM_LABEL = { desktop: "Desktop", cloud: "Cloud", both: "Desktop & Cloud" } as const;

type Message = { role: "system" | "user" | "assistant"; content: string };

export function buildMessages(input: {
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  sources: Source[];
  map: MaskMap;
}): { messages: Message[]; sources: Source[]; map: MaskMap; replyPlaceholders: string[] } {
  let map = input.map;
  const mask = (t: string) => {
    const r = autoMask(t, map);
    map = r.map;
    return r.text;
  };

  // The customer's own words first, so the placeholders the reply may use are only those in the scenario and
  // earlier turns, never a name that came from a guide about someone else.
  const history = input.history.map((h) => ({ role: h.role, content: mask(h.content) }));
  const scenario = mask(input.message);
  const replyPlaceholders = [...new Set([...history.map((h) => h.content), scenario].join("\n").match(PLACEHOLDER) ?? [])];

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
    ...history,
    { role: "user", content: `Scenario:\n${scenario}\n\nSources:\n${block}` },
  ];
  return { messages, sources, map, replyPlaceholders };
}
