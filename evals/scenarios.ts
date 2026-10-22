import type { AccountType } from "@/lib/accountant/core/answer";

/**
 * The live quality check for the Accountant chat: 10 common scenarios from the design
 * (docs/superpowers/specs/2026-10-22-accountant-chat-design.md). Each expected line must appear in the answer's
 * entries with this account type, side and amount (account names may differ). Correct these as you see fit.
 */
export type ExpectedLine = { type: AccountType; side: "dr" | "cr"; amount: number };

export interface EvalScenario {
  id: number;
  name: string;
  message: string;
  /** Must ask questions first instead of answering. */
  mustAsk?: boolean;
  /** Must say to check with the customer's accountant or auditor. */
  needsAccountant?: boolean;
  lines?: ExpectedLine[];
}

const dr = (type: AccountType, amount: number): ExpectedLine => ({ type, side: "dr", amount });
const cr = (type: AccountType, amount: number): ExpectedLine => ({ type, side: "cr", amount });

export const SCENARIOS: EvalScenario[] = [
  {
    id: 1,
    name: "Old deposit never recorded, knock off last month's invoice",
    message: "A customer paid a RM5,000 deposit 2 years ago. It was never keyed in as an AR deposit in AutoCount. Now they want it set against last month's invoice of RM5,000. What should I do?",
    mustAsk: true,
  },
  {
    id: 2,
    name: "Customer short-paid because of bank charges",
    message: "Invoice RM1,000. The customer paid and we received RM990 in the bank; their bank deducted RM10 as charges. We absorb the RM10. How do we record the receipt so the invoice is fully settled?",
    lines: [dr("asset", 990), dr("expense", 10), cr("asset", 1000)],
  },
  {
    id: 3,
    name: "Customer overpaid, refund the extra",
    message: "Invoice RM2,000. The customer paid RM2,500 by bank transfer. We refunded the extra RM500 to them by bank transfer the next week. What are the entries?",
    lines: [dr("asset", 2500), cr("asset", 2500), dr("asset", 500), cr("asset", 500)],
  },
  {
    id: 4,
    name: "Credit note on a service invoice with 8% service tax",
    message: "We issued a service invoice of RM1,000 plus 8% service tax (RM80), total RM1,080. After invoicing we agreed a RM200 discount on the service. We're a registered service tax person. What credit note entry do we record?",
    lines: [dr("income", 200), dr("liability", 16), cr("asset", 216)],
  },
  {
    id: 5,
    name: "Bad debt write-off",
    message: "A customer owes RM3,000 and has closed down; we will never collect it. No allowance for doubtful debts was made earlier. How do we write it off?",
    needsAccountant: true,
    lines: [dr("expense", 3000), cr("asset", 3000)],
  },
  {
    id: 6,
    name: "Contra: customer who is also a supplier",
    message: "Company A owes us RM5,000 for sales. We owe the same Company A RM3,000 for purchases. Both sides agreed to offset. What is the contra entry?",
    lines: [dr("liability", 3000), cr("asset", 3000)],
  },
  {
    id: 7,
    name: "Supplier deposit, then the purchase invoice",
    message: "We paid a supplier a RM2,000 deposit by bank. Later the supplier's invoice of RM8,000 for goods (expensed as purchases) arrived and the deposit was applied against it. What are the entries?",
    lines: [dr("asset", 2000), cr("asset", 2000), dr("expense", 8000), cr("liability", 8000), dr("liability", 2000), cr("asset", 2000)],
  },
  {
    id: 8,
    name: "Foreign-currency receipt at a different rate",
    message: "We invoiced a customer USD1,000 when the rate was 4.40 (RM4,400). The customer paid the USD1,000 when the rate was 4.30, so RM4,300 arrived. Our base currency is RM. What is the entry for the receipt?",
    lines: [dr("asset", 4300), dr("expense", 100), cr("asset", 4400)],
  },
  {
    id: 9,
    name: "Annual insurance paid in advance",
    message: "On 1 October we paid RM12,000 by bank for a 12-month insurance policy. Our financial year ends 31 December. What entries do we make when paying and at year end?",
    lines: [dr("asset", 12000), cr("asset", 12000), dr("expense", 3000), cr("asset", 3000)],
  },
  {
    id: 10,
    name: "Electricity bill not yet received at month end",
    message: "At month end we haven't received this month's electricity bill. We estimate it at RM800. How do we record it, and what happens when the bill arrives next month?",
    lines: [dr("expense", 800), cr("liability", 800)],
  },
];
