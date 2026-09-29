import type { Analysis } from "@/lib/types";

/**
 * Sample Accounting Analyst results. Every AutoCount menu path is marked
 * verified: false until confirmed against official documentation.
 */
export const analyses: Analysis[] = [
  {
    id: "AN-205",
    title: "USD deposit → SST invoice → partial USD payment",
    scenario:
      "Customer paid a USD 1,000 deposit on 1 Aug (rate 4.45). On 15 Aug we invoiced USD 5,000 for services plus 8% service tax (rate 4.40). On 5 Sep they paid USD 2,000 (rate 4.38). Month-end rate on 30 Sep is 4.35.",
    createdAt: "2026-09-29T09:10:00Z",
    understanding: [
      "A local customer is billed in USD for a taxable service.",
      "The deposit comes before the invoice and is later applied against it.",
      "USD 2,400 is still outstanding at 30 Sep and needs month-end revaluation.",
    ],
    assumptions: [
      "Company functional currency is RM; the company is registered for service tax.",
      "Service tax rate 8% applies to this service.",
      "Rates are the ones given in the scenario (bank buying rate).",
    ],
    treatment: {
      standard: "MFRS 121 (foreign exchange), MFRS 15 (revenue), IC Interpretation 22 (advance consideration)",
      points: [
        "The deposit is a liability (contract liability / customer deposit) until the service is invoiced.",
        "Revenue and the debtor are recorded at the spot rate on the invoice date.",
        "Differences on settlement are realised forex gain or loss; the open USD balance is revalued at month-end (unrealised).",
      ],
    },
    entries: [
      {
        date: "2026-08-01",
        description: "Deposit received USD 1,000 @ 4.45",
        lines: [
          { account: "Bank – USD", dr: 4450 },
          { account: "Customer deposit (liability)", cr: 4450 },
        ],
      },
      {
        date: "2026-08-15",
        description: "Invoice USD 5,000 + 8% service tax @ 4.40",
        lines: [
          { account: "Trade debtor", dr: 23760 },
          { account: "Service revenue", cr: 22000 },
          { account: "Service tax payable", cr: 1760 },
        ],
      },
      {
        date: "2026-08-15",
        description: "Apply deposit USD 1,000 to invoice",
        lines: [
          { account: "Customer deposit (liability)", dr: 4450 },
          { account: "Trade debtor", cr: 4400 },
          { account: "Realised forex gain", cr: 50 },
        ],
      },
      {
        date: "2026-09-05",
        description: "Partial payment USD 2,000 @ 4.38",
        lines: [
          { account: "Bank – USD", dr: 8760 },
          { account: "Realised forex loss", dr: 40 },
          { account: "Trade debtor", cr: 8800 },
        ],
      },
      {
        date: "2026-09-30",
        description: "Revalue open USD 2,400 from 4.40 to 4.35",
        lines: [
          { account: "Unrealised forex loss", dr: 120 },
          { account: "Trade debtor", cr: 120 },
        ],
      },
    ],
    steps: [
      {
        document: "Deposit receipt",
        menuPath: "A/R › Deposit (path to confirm)",
        verified: false,
        fields: ["Debtor", "Currency = USD", "Rate = 4.45", "Amount = 1,000.00", "Payment method = USD bank"],
      },
      {
        document: "Sales Invoice",
        menuPath: "Sales › Invoice (path to confirm)",
        verified: false,
        fields: ["Currency = USD", "Rate = 4.40", "Line: service, USD 5,000.00", "Tax code = service tax 8% (code name per your setup)"],
      },
      {
        document: "Knock-off deposit against invoice",
        menuPath: "A/R › Deposit › Refund / Knock-off (path to confirm)",
        verified: false,
        fields: ["Select the deposit", "Knock off USD 1,000.00 against the invoice", "Check the forex gain posts to the default gain account"],
      },
      {
        document: "Debtor Payment",
        menuPath: "A/R › Payment (path to confirm)",
        verified: false,
        fields: ["Currency = USD", "Rate = 4.38", "Amount = 2,000.00", "Knock off against the invoice"],
      },
      {
        document: "Month-end revaluation",
        menuPath: "G/L › Currency revaluation (path to confirm)",
        verified: false,
        fields: ["Revaluation date = 30/09/2026", "USD rate = 4.35", "Unrealised gain/loss accounts set"],
      },
    ],
    tax: [
      "Service tax 8% on USD 5,000 = USD 400 (RM 1,760 at the invoice rate).",
      "Service tax is generally due when payment is received, or 12 months after the invoice if still unpaid. Match the SST-02 taxable period to the receipts.",
      "e-Invoice (MyInvois): a foreign-currency invoice must show the currency and the exchange rate. Check which rollout phase applies to this company.",
    ],
    mistakes: [
      "Recording the deposit as sales (overstates revenue and service tax).",
      "Knocking off the deposit in RM at the invoice rate, which hides the RM 50 difference.",
      "Forgetting month-end revaluation, so the Aged Debtor in RM does not match the GL.",
    ],
    verifyReports: ["Trial Balance: customer deposit account is nil after the knock-off", "Aged Debtor (USD and RM): USD 2,400 outstanding", "Realised / unrealised forex accounts in GL listing", "SST-02 draft for the period"],
    confidence: "Medium",
    needsVerification: [
      "All five AutoCount menu paths above",
      "Tax code name for service tax 8% in this client's setup",
      "SST payment-basis timing for this service",
    ],
    judgementNote:
      "Under IC Interpretation 22 the USD 1,000 prepaid portion can be measured at the deposit-date rate (4.45), which moves the RM 50 from forex gain into revenue. The amount is small; confirm the company's policy.",
    sources: [
      { label: "G-1042 Unrealised forex gain posted to wrong account", kind: "my-guide", ref: "G-1042" },
      { label: "AutoCount wiki: Multi-currency (sample link)", kind: "official", ref: "https://wiki.autocountsoft.com/" },
      { label: "MFRS 121 and IC Int. 22: general accounting knowledge", kind: "general", ref: "" },
    ],
    chat: [
      { role: "user", text: "What if the customer pays the remaining USD 2,400 in October at 4.30?" },
      {
        role: "assistant",
        text: "After the 30 Sep revaluation the debtor is carried at 4.35 (RM 10,440). Receiving USD 2,400 at 4.30 gives RM 10,320: Dr Bank – USD 10,320, Dr Realised forex loss 120, Cr Trade debtor 10,440. If you reverse the revaluation on 1 Oct instead, the carrying rate goes back to 4.40 and the realised loss is RM 240, with the RM 120 unrealised loss reversed. Either way, the total loss is the same.",
      },
    ],
  },
  {
    id: "AN-204",
    title: "Credit note for returned goods with 10% sales tax",
    scenario: "Customer returned goods invoiced at RM 1,000 plus 10% sales tax. The goods cost RM 600 and go back into stock.",
    createdAt: "2026-09-24T03:00:00Z",
    understanding: ["Full return of taxable goods; goods are resaleable."],
    assumptions: ["Perpetual stock; sales tax 10% was charged on the original invoice."],
    treatment: { standard: "MFRS 15", points: ["Reverse revenue and the output tax.", "Return the goods to stock at cost."] },
    entries: [
      {
        date: "2026-09-24",
        description: "Credit note RM 1,000 + 10% sales tax",
        lines: [
          { account: "Sales returns", dr: 1000 },
          { account: "Sales tax payable", dr: 100 },
          { account: "Trade debtor", cr: 1100 },
        ],
      },
      {
        date: "2026-09-24",
        description: "Goods back into stock at cost",
        lines: [
          { account: "Inventory", dr: 600 },
          { account: "Cost of sales", cr: 600 },
        ],
      },
    ],
    steps: [{ document: "Credit Note", menuPath: "Sales › Credit Note (path to confirm)", verified: false, fields: ["Link to the original invoice", "Same tax code as the invoice", "Return to the original location"] }],
    tax: ["The credit note must reference the original invoice for the sales tax adjustment.", "e-Invoice: issue a credit note e-Invoice that references the original e-Invoice."],
    mistakes: ["Using a different tax code from the original invoice."],
    verifyReports: ["Stock card for the item", "SST-02 adjustment line"],
    confidence: "High",
    needsVerification: ["Menu path for the credit note"],
    sources: [{ label: "G-1047 SST-02 service tax total does not match GL", kind: "my-guide", ref: "G-1047" }],
    chat: [],
  },
  {
    id: "AN-203",
    title: "Contra between debtor and creditor",
    scenario: "Customer Lim Brothers also supplies us. We owe them RM 5,000; they owe us RM 8,000. Both agree to set off.",
    createdAt: "2026-09-20T03:00:00Z",
    understanding: ["Offset of RM 5,000 agreed in writing by both parties."],
    assumptions: ["Same legal entity on both sides; both balances in RM."],
    treatment: { standard: "MFRS 132 (offsetting)", points: ["Set off only with a written agreement.", "RM 3,000 remains receivable."] },
    entries: [
      {
        date: "2026-09-20",
        description: "Contra RM 5,000",
        lines: [
          { account: "Trade creditor – Lim Brothers", dr: 5000 },
          { account: "Trade debtor – Lim Brothers", cr: 5000 },
        ],
      },
    ],
    steps: [{ document: "Contra", menuPath: "A/R › Contra (path to confirm)", verified: false, fields: ["Debtor and creditor account", "Amount = 5,000.00", "Knock off the specific invoices on both sides"] }],
    tax: ["No SST effect; the original invoices already carry the tax."],
    mistakes: ["Contra without knocking off specific invoices, which leaves both aged reports wrong."],
    verifyReports: ["Aged Debtor and Aged Creditor for Lim Brothers"],
    confidence: "High",
    needsVerification: ["Menu path for contra"],
    sources: [],
    chat: [],
  },
  {
    id: "AN-202",
    title: "Stock adjustment for damaged goods",
    scenario: "Stock count found 47 damaged units of item HW-220 at average cost RM 50. Write them off.",
    createdAt: "2026-09-12T03:00:00Z",
    understanding: ["Write-off of 47 units × RM 50 = RM 2,350."],
    assumptions: ["Weighted average costing; no insurance claim."],
    treatment: { standard: "MFRS 102 (inventories)", points: ["Write down to net realisable value (nil) and expense it."] },
    entries: [
      {
        date: "2026-09-12",
        description: "Write off 47 units",
        lines: [
          { account: "Stock write-off (expense)", dr: 2350 },
          { account: "Inventory", cr: 2350 },
        ],
      },
    ],
    steps: [{ document: "Stock Adjustment", menuPath: "Stock › Adjustment (path to confirm)", verified: false, fields: ["Item HW-220", "Qty = -47", "Reason = damaged"] }],
    tax: ["No SST effect for a write-off. Keep count sheets as support for tax deduction."],
    mistakes: ["Using stock issue instead of adjustment, which posts to the wrong account."],
    verifyReports: ["Stock balance report", "GL: stock write-off account"],
    confidence: "High",
    needsVerification: ["Menu path for stock adjustment"],
    sources: [{ label: "G-1045 Negative stock balance after backdated goods received", kind: "my-guide", ref: "G-1045" }],
    chat: [],
  },
  {
    id: "AN-201",
    title: "Year-end accrual for audit fee",
    scenario: "FY ends 31 Dec. Audit fee RM 12,000 for FY2026 will be billed in March 2027.",
    createdAt: "2026-09-05T03:00:00Z",
    understanding: ["The expense belongs to FY2026 even though the bill comes later."],
    assumptions: ["No SST charged by the auditor (confirm on their invoice)."],
    treatment: { standard: "MFRS 101 / Conceptual Framework (accrual basis)", points: ["Accrue at year-end and reverse on the first day of the new year."] },
    entries: [
      {
        date: "2026-12-31",
        description: "Accrue audit fee",
        lines: [
          { account: "Audit fee", dr: 12000 },
          { account: "Accrued expenses", cr: 12000 },
        ],
      },
      {
        date: "2027-01-01",
        description: "Reverse accrual",
        lines: [
          { account: "Accrued expenses", dr: 12000 },
          { account: "Audit fee", cr: 12000 },
        ],
      },
    ],
    steps: [{ document: "Journal Entry", menuPath: "G/L › Journal Entry (path to confirm)", verified: false, fields: ["Date 31/12/2026", "Auto-reverse on 01/01/2027 if available"] }],
    tax: ["Accrued audit fees are generally deductible when incurred. Check with the tax agent."],
    mistakes: ["Forgetting to reverse the accrual, which double-counts the expense in FY2027."],
    verifyReports: ["Trial Balance at 31 Dec", "Accrued expenses listing"],
    confidence: "High",
    needsVerification: ["Menu path for journal entry"],
    sources: [],
    chat: [],
  },
];

export function getAnalysis(id: string) {
  return analyses.find((a) => a.id === id);
}
