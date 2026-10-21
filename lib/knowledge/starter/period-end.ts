import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const PERIOD_END: StarterArticle[] = [
  {
    slug: "accruals-and-prepayments",
    version: 1,
    title: "Accruals and prepayments",
    category: "Period-end",
    tellCustomer:
      "Accounts should show costs in the month they belong to, not the month you pay. An accrual records a cost you've used but not yet been billed for; a prepayment spreads a cost you paid in advance over the months it covers. This makes each month's profit accurate.",
    whatItIs:
      "Accrual: Dr Expense, Cr Accrued liabilities at month or year-end, reversed when the bill arrives. Prepayment: the payment goes to Prepayments (an asset) and is moved to expense month by month. Both are done with journal entries.",
    example:
      "December electricity of about RM 800 is billed in January → accrue at 31 December: Dr Electricity RM 800, Cr Accruals RM 800.\nAnnual insurance RM 1,200 paid in January → each month: Dr Insurance RM 100, Cr Prepayments RM 100.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Forgetting to reverse an accrual, so the expense is counted twice.",
      "Expensing a full year's payment in one month.",
    ],
    related: ["journal-entry", "year-end-closing", "profit-and-loss"],
    sources: [SRC.adjustingEntries, SRC.journalEntry],
  },
  {
    slug: "depreciation",
    version: 1,
    title: "Depreciation",
    category: "Period-end",
    tellCustomer:
      "Depreciation spreads the cost of a long-lasting item, like a computer, van or machine, over the years you use it, instead of counting it all as an expense when bought. Each month or year a portion becomes an expense. Its value in the balance sheet goes down accordingly.",
    whatItIs:
      "The asset is recorded at cost. Each period: Dr Depreciation expense, Cr Accumulated depreciation. The straight-line method spreads (cost − estimated residual value) evenly over its useful life. Tax uses its own capital allowance rules, so tax figures differ from accounting depreciation.",
    example:
      "Van RM 60,000, useful life 5 years, no residual value → RM 12,000 a year (RM 1,000 a month). After 2 years: cost RM 60,000 − accumulated depreciation RM 24,000 = net book value RM 36,000.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Expensing the asset in full when bought.",
      "Continuing to depreciate after the asset is fully depreciated or sold.",
      "Confusing accounting depreciation with tax capital allowances.",
    ],
    related: ["journal-entry", "balance-sheet", "year-end-closing"],
    sources: [SRC.adjustingEntries, SRC.journalEntry, SRC.accountingBasicsQa],
  },
  {
    slug: "bad-debts",
    version: 1,
    title: "Bad debts",
    category: "Period-end",
    tellCustomer:
      "A bad debt is money a customer owes you that you no longer expect to collect, for example because they closed down. You write it off so your accounts don't show money you won't get. It becomes an expense, and the customer's balance is cleared.",
    whatItIs:
      "Write-off: Dr Bad debts expense, Cr Debtor, then knock it off against the invoices. Many businesses first make an allowance (provision) for doubtful debts based on aging, before writing off specific accounts. If the money is later recovered, the write-off is reversed or recorded as income. Discuss with the accountant before writing off.",
    example:
      "Customer owes RM 4,500 for over a year and has stopped trading → Dr Bad debts RM 4,500, Cr Debtor RM 4,500, knocked off against the old invoices.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Writing off without knocking off, so the invoices stay open in aging.",
      "Deleting the old invoices instead of writing them off, which loses the audit trail.",
    ],
    related: ["debtor-aging", "journal-entry", "year-end-closing"],
    sources: [SRC.receivables, SRC.agingReceivables, SRC.knockOffEntry],
  },
  {
    slug: "foreign-currency-gain-loss",
    version: 1,
    title: "Foreign currency gain or loss",
    category: "Period-end",
    tellCustomer:
      "When you bill or pay in a foreign currency, the ringgit value changes with the exchange rate. The difference between the rate on the invoice and the rate when it's paid is a foreign exchange gain or loss. At month or year-end, unpaid foreign balances may also be revalued to the current rate.",
    whatItIs:
      "The invoice is recorded in ringgit at that day's rate. Realised gain/loss: the difference when payment is received or made. Unrealised gain/loss: revaluing unpaid foreign balances (debtors, creditors, foreign bank accounts) at the period-end rate. A foreign bank account's ringgit (home) balance can drift and may need adjusting.",
    example:
      "Invoice USD 1,000 at 4.40 = RM 4,400. Customer pays USD 1,000 when the rate is 4.30 = RM 4,300 → realised exchange loss RM 100: Dr Bank RM 4,300, Dr Exchange loss RM 100, Cr Debtor RM 4,400.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Using today's rate for an old invoice, so the gain or loss is wrong.",
      "Never revaluing, so foreign balances are stated at old rates.",
    ],
    related: ["receiving-payment-and-knock-off", "supplier-payment", "bank-reconciliation"],
    sources: [SRC.foreignBankHomeBalance, SRC.financialAccounting],
  },
  {
    slug: "locking-past-periods",
    version: 1,
    title: "Locking past periods",
    category: "Period-end",
    tellCustomer:
      "Locking a period stops anyone from adding, editing or deleting transactions in months that are already finished, especially after the year is closed or audited. It protects the figures you've already reported. If a change is really needed, the lock can be lifted by an authorised user.",
    whatItIs:
      "After closing a year (or month), set a period lock so documents dated in that period can't be changed. Corrections are then made in the current open period with a clear description. Combine it with access rights so only authorised users can unlock.",
    example:
      "The 2025 accounts are audited in April 2026. Lock all of 2025. A user who tries to edit an invoice dated December 2025 is stopped; any correction is posted in 2026.",
    desktopSteps: null,
    cloudSteps: "Account Book icon > Fiscal Year — manage period lock",
    mistakes: [
      "Not locking after the audit, so audited figures change later.",
      "Unlocking to fix one item and forgetting to lock again.",
    ],
    related: ["year-end-closing", "financial-year-and-periods"],
    sources: [SRC.periodLock],
  },
];
