import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const REPORTS: StarterArticle[] = [
  {
    slug: "trial-balance",
    version: 1,
    title: "Trial balance",
    category: "Reports",
    tellCustomer:
      "A trial balance lists every account with its balance on a date, debits in one column and credits in the other. The two totals must be equal; if they are, the double entry is complete. It's the starting point for the Profit and Loss and Balance Sheet.",
    whatItIs:
      "It's a check and a summary, not a financial statement. Equal totals prove debits equal credits, but not that everything is in the right account: a posting to the wrong account still balances. Accountants and auditors usually ask for it first.",
    example:
      "Bank RM 9,900 Dr · Debtors RM 5,000 Dr · Rental RM 1,200 Dr · Creditors RM 3,100 Cr · Capital RM 10,000 Cr · Sales RM 3,000 Cr → Debits RM 16,100 = Credits RM 16,100.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Assuming a balanced trial balance means the accounts are correct.",
      "Running it for the wrong date, before month-end adjustments are posted.",
    ],
    related: ["debit-and-credit", "general-ledger", "profit-and-loss", "balance-sheet"],
    sources: [SRC.bookkeeping, SRC.debitsCredits],
  },
  {
    slug: "profit-and-loss",
    version: 1,
    title: "Profit and loss statement",
    category: "Reports",
    tellCustomer:
      "The profit and loss statement shows what the business earned and spent over a period, such as a month or a year, and whether it made a profit. It's income minus cost of sales minus expenses. It answers 'how did we do?' for that period.",
    whatItIs:
      "Sales − cost of sales = gross profit; gross profit − operating expenses (rent, salaries, utilities, depreciation…) = net profit before tax. It covers a period, unlike the balance sheet which is a single date. With a periodic inventory system the closing stock value affects cost of sales, so it must be up to date.",
    example:
      "Sales RM 100,000 − cost of sales RM 60,000 = gross profit RM 40,000. Expenses RM 25,000 → net profit RM 15,000.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Closing stock showing zero because the periodic stock value wasn't keyed in.",
      "Expenses posted to Balance Sheet accounts (or assets posted as expenses), distorting profit.",
    ],
    related: ["balance-sheet", "trial-balance", "stock-valuation", "accruals-and-prepayments"],
    sources: [SRC.profitAndLoss, SRC.closingStockPl, SRC.financialAccounting],
  },
  {
    slug: "balance-sheet",
    version: 1,
    title: "Balance sheet",
    category: "Reports",
    tellCustomer:
      "The balance sheet is a snapshot of what the business owns, what it owes, and the owner's share on one date. What it owns always equals what it owes plus the owner's equity, which is why it 'balances'. Banks and auditors look at it to judge the company's financial health.",
    whatItIs:
      "Assets (bank, debtors, stock, equipment) = Liabilities (creditors, loans, tax payable) + Equity (capital and retained earnings). The year's profit increases retained earnings. Unlike profit and loss, it's at a point in time, not over a period.",
    example:
      "Assets RM 120,000 = Liabilities RM 45,000 + Equity RM 75,000 (capital RM 50,000 + retained earnings RM 25,000).",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Suspense or clearing accounts left with balances at year-end.",
      "Customer deposits shown as negative debtors instead of a liability.",
      "Retained earnings that don't carry forward because the year wasn't closed properly.",
    ],
    related: ["profit-and-loss", "trial-balance", "year-end-closing", "chart-of-accounts"],
    sources: [SRC.balanceSheet, SRC.accountingEquation, SRC.financialAccounting],
  },
  {
    slug: "general-ledger",
    version: 1,
    title: "General ledger",
    category: "Reports",
    tellCustomer:
      "The general ledger is the full history of every account: each transaction that went in or out, with dates and a running balance. When a figure in a report looks wrong, the ledger shows exactly which transactions make it up. It's the detail behind the trial balance.",
    whatItIs:
      "Every posting from invoices, receipts, payments and journals ends up in the ledger account it affects. The ledger lists those postings per account, so you can trace any balance back to its documents. A report showing each transaction's double entry by journal type helps confirm how a document was posted.",
    example:
      "Ledger for 'Rental': 1 Jan RM 1,200 (PV-001) · 1 Feb RM 1,200 (PV-014) · 1 Mar RM 1,200 (PV-030) → balance RM 3,600, matching the trial balance.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Fixing a wrong balance with a journal without finding the original wrong document.",
      "Looking at the wrong date range, so the opening balance seems off.",
    ],
    related: ["trial-balance", "journal-entry", "chart-of-accounts"],
    sources: [SRC.journalOfTransaction, SRC.bookkeeping],
  },
  {
    slug: "cash-flow-statement",
    version: 1,
    title: "Cash flow statement",
    category: "Reports",
    tellCustomer:
      "The cash flow statement shows where cash came from and where it went during a period. A business can make a profit but still run short of cash, for example when customers pay late. This report shows that difference.",
    whatItIs:
      "Cash movements are grouped into operating activities (day-to-day trading), investing activities (buying or selling equipment) and financing activities (loans, capital, dividends). It starts from profit and adjusts for non-cash items (like depreciation) and changes in debtors, stock and creditors.",
    example:
      "Profit RM 15,000 + depreciation RM 3,000 − increase in debtors RM 10,000 = cash from operations RM 8,000. Buying a van RM 20,000 (investing) and a bank loan RM 15,000 (financing) → net cash +RM 3,000.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Expecting cash to equal profit.",
      "Classifying a loan repayment as an operating expense.",
    ],
    related: ["profit-and-loss", "balance-sheet", "depreciation"],
    sources: [SRC.financialAccounting, SRC.accountingBasics],
  },
];
