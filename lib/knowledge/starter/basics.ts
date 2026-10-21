import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const BASICS: StarterArticle[] = [
  {
    slug: "debit-and-credit",
    version: 1,
    title: "Debit and credit",
    category: "Basics",
    tellCustomer:
      "Every transaction is recorded twice: once as a debit and once as a credit, and the two always add up to the same amount. Debit is simply the left side and credit the right side; neither means good or bad. That is why AutoCount won't save an entry that doesn't balance.",
    whatItIs:
      "Double entry means each transaction touches at least two accounts. As a rule of thumb:\n• Debit increases what the business owns (assets such as cash, bank, stock, customers who owe you) and its expenses.\n• Credit increases what the business owes (liabilities such as suppliers, loans, tax payable), its income and the owner's capital.\nIf total debits equal total credits, the books balance. A trial balance is the check that this is true for every account together.",
    example:
      "You sell goods for RM 1,000 on credit:\n• Dr Debtor (customer) RM 1,000 — the customer now owes you more.\n• Cr Sales RM 1,000 — your income goes up.\nWhen the customer pays by bank transfer:\n• Dr Bank RM 1,000 — money comes in.\n• Cr Debtor RM 1,000 — the customer no longer owes you.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Thinking 'credit' means money coming in, as on a bank statement. A bank statement is written from the bank's point of view, so it is the opposite of your books.",
      "Forcing an entry to balance with a 'suspense' line instead of finding the missing side.",
      "Posting both sides to the same account, which balances but changes nothing.",
    ],
    related: ["chart-of-accounts", "journal-entry", "trial-balance"],
    sources: [SRC.debitsCredits, SRC.journalEntry],
  },
  {
    slug: "chart-of-accounts",
    version: 1,
    title: "Chart of accounts",
    category: "Basics",
    tellCustomer:
      "The chart of accounts is the list of all the 'boxes' your transactions are sorted into, such as Bank, Sales, Rental and Customers. Your reports, like Profit and Loss and Balance Sheet, are built from these boxes. Keeping the list tidy makes your reports easy to read.",
    whatItIs:
      "Each account has a number, a name and a type (for example Current Asset, Current Liability, Sales, Expenses). The type decides where the account appears in the Profit and Loss or Balance Sheet. Accounts can have sub-accounts to group details, e.g. Bank → Maybank, Public Bank. Some accounts are special and used by the system, such as Retained Earnings and the customer and supplier control accounts.",
    example:
      "A small trading company might have:\n• 300-0000 Bank (Current Asset) with sub-accounts 300-1000 Maybank and 300-2000 CIMB\n• 500-0000 Sales (Sales)\n• 900-1000 Rental (Expenses)\n• 400-0000 Trade Creditors (Current Liability)\nRental paid appears under Expenses in Profit and Loss; the bank balances appear under Current Assets in the Balance Sheet.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Creating a new account for every small item, making the reports hard to read.",
      "Choosing the wrong account type, so an expense shows up in the Balance Sheet (or the other way round).",
      "Deleting or renaming special accounts such as Retained Earnings that the system relies on.",
    ],
    related: ["debit-and-credit", "opening-balance", "trial-balance", "balance-sheet", "profit-and-loss"],
    sources: [SRC.chartOfAccount, SRC.accountType, SRC.retainedEarning, SRC.chartOfAccounts],
  },
  {
    slug: "journal-entry",
    version: 1,
    title: "Journal entry",
    category: "Basics",
    tellCustomer:
      "A journal entry is a manual adjustment for things that don't come from an invoice or payment, such as depreciation, accruals or correcting a wrong posting. You choose the accounts and amounts yourself, and the debits must equal the credits. Use it carefully, because it skips the normal checks of sales and purchase documents.",
    whatItIs:
      "Most transactions are posted automatically by documents (invoice, credit note, receipt, payment). A journal entry is for everything else: month-end adjustments, accruals, prepayments, depreciation, provisions, reclassifying an amount to the correct account, or a contra between a customer and a supplier. Each line has an account, a debit or credit amount and a description.",
    example:
      "Monthly depreciation of a RM 12,000 computer over 3 years (RM 333.33 a month):\n• Dr Depreciation expense RM 333.33\n• Cr Accumulated depreciation – Computer RM 333.33",
    desktopSteps: null,
    cloudSteps: "Accounting > Journal Entry",
    mistakes: [
      "Using a journal to record a customer payment instead of a receipt, so the invoice still shows as unpaid in aging.",
      "No description, so nobody knows later why the adjustment was made.",
      "Posting to the wrong period, especially after year-end.",
    ],
    related: ["debit-and-credit", "accruals-and-prepayments", "depreciation", "contra"],
    sources: [SRC.journalEntry, SRC.contra, SRC.journalOfTransaction, SRC.adjustingEntries],
  },
  {
    slug: "financial-year-and-periods",
    version: 1,
    title: "Financial year and periods",
    category: "Basics",
    tellCustomer:
      "Your financial year is the 12-month period your accounts and tax return cover; it doesn't have to be January to December. Each year is split into monthly periods so you can see month-by-month results. Once a year is closed, its periods can be locked so old figures don't change.",
    whatItIs:
      "A company chooses its financial year end (e.g. 31 December or 30 June) and reports profit for that 12-month span. Accounting software uses the financial year to decide which transactions belong to which year, to carry the profit forward into Retained Earnings, and to let you lock periods that are finished.",
    example:
      "A company with a 30 June year end: the financial year 2026 runs from 1 July 2025 to 30 June 2026, with 12 periods (July = period 1 … June = period 12). An invoice dated 15 June 2026 belongs to financial year 2026, period 12.",
    desktopSteps: null,
    cloudSteps: "Account Book icon > Fiscal Year (this is also where period lock is managed)",
    mistakes: [
      "Setting the wrong financial year start when creating the account book, which shifts every report.",
      "Keying transactions into a year that has already been audited.",
    ],
    related: ["year-end-closing", "locking-past-periods", "opening-balance"],
    sources: [SRC.periodLock],
  },
  {
    slug: "opening-balance",
    version: 1,
    title: "Opening balance",
    category: "Basics",
    tellCustomer:
      "Opening balances are the amounts you bring in from your old system or records on the day you start using AutoCount, such as your bank balance, what customers owe you and what you owe suppliers. They make your first reports start from the right numbers. The total debits and credits of the opening balances must be equal.",
    whatItIs:
      "When a business moves to new software in the middle of its life, it enters each account's balance as at the start date instead of re-keying every old transaction. Customer and supplier balances are best entered invoice by invoice (outstanding documents) so aging and knock-off work. Stock opening needs both quantity and cost.",
    example:
      "Starting on 1 January 2026 with: Bank RM 20,000 (Dr), customers owe RM 5,000 (Dr), you owe suppliers RM 3,000 (Cr), capital RM 15,000 (Cr), retained earnings RM 7,000 (Cr). Debits RM 25,000 = Credits RM 25,000, so the opening balance is balanced.",
    desktopSteps: null,
    cloudSteps: "Account Book Setting > Opening Balance (stock: Account Book Setting > Stock Opening Balance)",
    mistakes: [
      "Entering only one total for customers, so the debtor aging can't show which invoices are still unpaid.",
      "Opening balances that don't balance, with the difference dumped into a suspense account.",
      "Using a date that overlaps transactions already keyed in the new system.",
    ],
    related: ["chart-of-accounts", "financial-year-and-periods", "trial-balance", "debtor-aging"],
    sources: [SRC.openingBalance, SRC.stockOpeningBalance, SRC.resetOpeningBalance, SRC.unlockOpeningBalance],
  },
  {
    slug: "year-end-closing",
    version: 1,
    title: "Year-end closing",
    category: "Basics",
    tellCustomer:
      "Year-end closing is finishing off the year's accounts: checking everything is recorded, making the final adjustments and moving the year's profit into Retained Earnings. After that, the year's figures shouldn't change, so you lock it. The new year then starts from the closing balances.",
    whatItIs:
      "Before closing: reconcile the bank, check customer and supplier balances, count stock, and post adjustments (accruals, prepayments, depreciation, bad debts). Income and expense accounts start from zero again in the new year; their net result moves into Retained Earnings in the Balance Sheet. Assets, liabilities and equity carry forward.",
    example:
      "Profit for 2026 is RM 50,000. After closing, the Balance Sheet on 1 January 2027 shows Retained Earnings increased by RM 50,000, while Sales and Expenses for 2027 start at RM 0.",
    desktopSteps: null,
    cloudSteps: "Account Book icon > Fiscal Year — set period lock after closing",
    mistakes: [
      "Closing before the auditor's adjustments are posted.",
      "Leaving the closed year unlocked, so someone edits an old invoice and the audited figures change.",
      "Deleting the Retained Earnings account.",
    ],
    related: ["financial-year-and-periods", "locking-past-periods", "accruals-and-prepayments", "depreciation"],
    sources: [SRC.periodLock, SRC.retainedEarning, SRC.adjustingEntries],
  },
];
