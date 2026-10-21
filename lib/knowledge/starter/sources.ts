import type { Source } from "@/lib/knowledge/model";

/** Source links used by the starter articles (checked 21 Oct 2026). */

const help = (path: string, label: string): Source => ({ label: `AutoCount Cloud help: ${label}`, url: `https://help.accounting.autocountcloud.com/support/solutions/articles/${path}` });
const coach = (path: string, label: string): Source => ({ label: `AccountingCoach: ${label}`, url: `https://www.accountingcoach.com/${path}` });

export const SRC = {
  // AutoCount Cloud Accounting help centre
  chartOfAccount: help("69000386527-chart-of-account", "Chart of Account"),
  accountType: help("69000386585-account-type", "Account Type"),
  journalEntry: help("69000393909-journal-entry", "Journal Entry"),
  journalType: help("69000386700-journal-type", "Journal Type"),
  journalOfTransaction: help("69000393953-journal-of-transaction", "Journal of Transaction"),
  openingBalance: help("69000401070-opening-balance", "Opening Balance"),
  stockOpeningBalance: help("69000401071-stock-opening-balance", "Stock Opening Balance"),
  resetOpeningBalance: help("69000803272-how-to-reset-opening-balance-to-zero", "How to reset opening balance to zero"),
  unlockOpeningBalance: help("69000826528-how-to-unlock-opening-balance-for-editing", "How to unlock Opening Balance for editing"),
  periodLock: help("69000870672-how-to-manage-period-lock-after-closing-accounts", "How to manage period lock after closing accounts"),
  retainedEarning: help("69000826529-how-to-create-retained-earning-account", "How to create Retained Earning account"),
  invoice: help("69000389786-invoice", "Invoice"),
  invoicePaymentVsReceipt: help("69000845028-payment-amount-in-invoice-vs-cash-book-receipt-voucher", "Payment Amount in Invoice vs Cash Book Receipt Voucher"),
  creditNote: help("69000389802-credit-note", "Credit Note"),
  returnAndRefund: help("69000833658-how-to-perform-customer-goods-return-and-refund-to-customers", "How to perform customer goods return and refund"),
  knockOffEntry: help("69000393938-knock-off-entry", "Knock Off Entry"),
  knockOffDetail: help("69000842316-how-to-find-out-knock-off-detail-of-an-invoice", "How to find out knock off detail of an Invoice"),
  customerDeposit: help("69000794711-how-to-key-in-deposit-received-from-customer-before-item-is-delivered-invoice-is-issued", "How to key in deposit received from customer"),
  contra: help("69000794708-how-to-perform-contra-offset-customer-and-supplier-outstanding", "How to perform contra / offset customer and supplier outstanding"),
  debtor: help("69000386656-debtor", "Debtor"),
  debtorStatement: help("69000394019-debtor-statement", "Debtor Statement"),
  debtorAging: help("69000394001-debtor-aging", "Debtor Aging"),
  customerOutstanding: help("69000843778-how-to-check-customer-outstanding-invoice", "How to check customer outstanding invoice"),
  creditor: help("69000386685-creditor", "Creditor"),
  purchaseInvoice: help("69000390358-purchase-invoice", "Purchase Invoice"),
  purchaseReturn: help("69000390388-purchase-return", "Purchase Return"),
  creditorAging: help("69000394002-creditor-aging", "Creditor Aging"),
  creditorStatement: help("69000394048-creditor-statement", "Creditor Statement"),
  cashBookImport: help("69000884157-how-to-import-cash-book-entry-receipt-payment-voucher-via-excel", "How to import Cash Book Entry (Receipt/Payment Voucher)"),
  returnCheque: help("69000821852-how-to-key-in-return-cheque-rchq-in-cloud-accounting", "How to key in return cheque (RCHQ)"),
  // AccountingCoach (general accounting)
  debitsCredits: coach("debits-and-credits/explanation", "Debits and Credits"),
  chartOfAccounts: coach("chart-of-accounts/explanation", "Chart of Accounts"),
  bookkeeping: coach("bookkeeping/explanation", "Bookkeeping"),
  adjustingEntries: coach("adjusting-entries/explanation", "Adjusting Entries"),
  receivables: coach("accounts-receivable-and-bad-debts-expense/explanation", "Accounts Receivable and Bad Debts"),
  agingReceivables: coach("blog/aging-accounts-receivable-bad-debts", "Aging of accounts receivable"),
  reconcilingAccount: coach("blog/reconciling-account", "What is meant by reconciling an account?"),
} satisfies Record<string, Source>;
