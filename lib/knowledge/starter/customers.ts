import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const CUSTOMERS: StarterArticle[] = [
  {
    slug: "invoice-vs-cash-sale",
    version: 1,
    title: "Invoice vs cash sale",
    category: "Customers (AR)",
    tellCustomer:
      "Use an invoice when the customer will pay later; it shows up in what customers owe you until it's paid. Use a cash sale when the customer pays on the spot; the money goes straight to cash or bank and nothing is left owing. Both count as sales.",
    whatItIs:
      "An invoice (credit sale) posts Dr Debtor, Cr Sales, and needs a separate receipt later to clear it. A cash sale posts Dr Cash/Bank, Cr Sales in one step. AutoCount Cloud Accounting can also record a payment directly on the invoice ('Payment Amount'); the help centre explains how that differs from a separate receipt voucher.",
    example:
      "Walk-in customer pays RM 250 by card at the counter → cash sale (Dr Bank RM 250, Cr Sales RM 250).\nRegular customer on 30 days' terms buys RM 5,000 → invoice (Dr Debtor RM 5,000, Cr Sales RM 5,000), then a receipt when they pay.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Issuing an invoice for a customer who already paid, then forgetting the receipt, so the customer looks overdue in aging.",
      "Using a cash sale for a credit customer, so you can't chase them for payment.",
    ],
    related: ["receiving-payment-and-knock-off", "debtor-aging", "credit-note-and-debit-note"],
    sources: [SRC.invoice, SRC.invoicePaymentVsReceipt, SRC.receivables],
  },
  {
    slug: "credit-note-and-debit-note",
    version: 1,
    title: "Credit note and debit note",
    category: "Customers (AR)",
    tellCustomer:
      "A credit note reduces what the customer owes you, for example when goods are returned or you give an extra discount. A debit note increases what they owe, for example when you under-charged on the invoice. You issue a new document instead of changing the old invoice.",
    whatItIs:
      "Credit note: Dr Sales returns (or Sales), Cr Debtor — and for returned goods, stock comes back in. It is then knocked off against the invoice it relates to, or refunded. Debit note: Dr Debtor, Cr Sales (or another income account) for the extra charge. Both keep a clear record of why the amount changed, which matters for tax and e-Invoice.",
    example:
      "Invoice RM 2,000. The customer returns goods worth RM 300 → credit note RM 300, knocked off against the invoice, so only RM 1,700 is still owed.\nYou forgot RM 100 delivery charges → debit note RM 100, so the customer now owes RM 1,800.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Editing or deleting the original invoice after it was sent (or submitted as an e-Invoice) instead of issuing a note.",
      "Not knocking off the credit note, so both the invoice and the credit note appear open in aging.",
      "Refunding cash without first recording the credit note.",
    ],
    related: ["invoice-vs-cash-sale", "receiving-payment-and-knock-off", "e-invoice-and-tin"],
    sources: [SRC.creditNote, SRC.returnAndRefund],
  },
  {
    slug: "receiving-payment-and-knock-off",
    version: 1,
    title: "Receiving payment and knock-off",
    category: "Customers (AR)",
    tellCustomer:
      "When a customer pays, you record a receipt and then 'knock it off' against the invoice it pays for. Knock-off tells the system which invoice is now paid, so it disappears from the list of what's owed. A receipt without a knock-off shows as extra money while the invoice still looks unpaid.",
    whatItIs:
      "A receipt posts Dr Bank, Cr Debtor. Knock-off matches that receipt (or a credit note or contra) to specific invoices, fully or partly. Debtor aging and statements rely on knock-off to show which invoices are still outstanding. One receipt can pay several invoices, and one invoice can be paid by several receipts.",
    example:
      "Customer owes Invoice I-0101 RM 1,000 and I-0102 RM 500. They pay RM 1,200. Knock off RM 1,000 to I-0101 and RM 200 to I-0102. Result: I-0101 fully paid, I-0102 has RM 300 left.",
    desktopSteps: null,
    cloudSteps: "Receipt: Accounting > Cash Book Entry > New Receipt Voucher\nMatch to invoices: Accounting > Knock Off Entry",
    mistakes: [
      "Knocking off against the wrong invoice, so aging shows the wrong invoice overdue.",
      "Recording a receipt by journal entry, which can't be knocked off like a receipt.",
      "Changing a knock-off date so later transactions are removed from the knock-off.",
    ],
    related: ["invoice-vs-cash-sale", "ar-deposit", "debtor-aging", "debtor-statement", "contra"],
    sources: [SRC.knockOffEntry, SRC.knockOffDetail, SRC.customerDeposit, SRC.invoicePaymentVsReceipt],
  },
  {
    slug: "ar-deposit",
    version: 1,
    title: "Customer deposit (AR deposit)",
    category: "Customers (AR)",
    tellCustomer:
      "A deposit is money the customer pays before you've issued the invoice. Until then it isn't a sale yet; you're holding the customer's money. When the invoice is issued, the deposit is used to pay part or all of it.",
    whatItIs:
      "Accounting-wise a deposit is a liability (you owe the customer goods or a refund), not income. When the invoice is issued, the deposit is applied against it and only the balance remains owing. Desktop AutoCount Accounting has a deposit feature; AutoCount Cloud Accounting has no separate deposit document, so its help centre records the deposit as a receipt voucher and knocks it off against the invoice later. Check whether SST or e-Invoice rules require a document at the time of the deposit.",
    example:
      "1 March: customer pays a RM 2,000 deposit → recorded against the customer, not as sales.\n20 March: invoice RM 5,000 issued → apply the RM 2,000 deposit; the customer now owes RM 3,000.",
    desktopSteps: null,
    cloudSteps: "Accounting > Cash Book Entry > New Receipt Voucher (record the deposit)\nAccounting > Knock Off Entry (apply it to the invoice once issued)",
    mistakes: [
      "Recording the deposit as sales, which overstates income before anything is delivered.",
      "Forgetting to apply the deposit, so the customer shows both an unpaid invoice and unused money.",
      "Old deposits sitting unapplied for years; review them and either apply, refund or clear them with the accountant's advice.",
    ],
    related: ["receiving-payment-and-knock-off", "invoice-vs-cash-sale", "debtor-statement"],
    sources: [SRC.customerDeposit, SRC.knockOffEntry],
  },
  {
    slug: "contra",
    version: 1,
    title: "Contra (offsetting a customer and supplier)",
    category: "Customers (AR)",
    tellCustomer:
      "A contra is when a company is both your customer and your supplier, and you agree to cancel out what you owe each other instead of paying in full both ways. Only the difference is then paid. You record it so both balances go down by the same amount.",
    whatItIs:
      "A journal reduces both sides: Dr Supplier (creditor), Cr Customer (debtor) by the agreed amount. Then each side is knocked off against the invoices it settles, so both aging reports are correct. Get written agreement from the other company first.",
    example:
      "ABC Sdn Bhd owes you RM 3,000 (your invoice) and you owe ABC RM 1,800 (their invoice to you). Contra RM 1,800: Dr Creditor ABC RM 1,800, Cr Debtor ABC RM 1,800. Afterwards ABC owes you RM 1,200 and you owe ABC nothing.",
    desktopSteps: null,
    cloudSteps: "Accounting > Journal Entry (credit the customer, debit the supplier)\nAccounting > Knock Off Entry for the customer, then for the supplier",
    mistakes: [
      "Recording the journal but not knocking off, so both invoices still look unpaid.",
      "Contra-ing without the other company's agreement, so the two companies' statements don't match.",
    ],
    related: ["journal-entry", "receiving-payment-and-knock-off", "supplier-payment", "debtor-statement"],
    sources: [SRC.contra, SRC.knockOffEntry],
  },
  {
    slug: "debtor-statement",
    version: 1,
    title: "Debtor statement",
    category: "Customers (AR)",
    tellCustomer:
      "A debtor statement is a summary you send a customer showing all their invoices, payments and credit notes for a period, and the balance they still owe. It's a polite reminder and helps both sides agree on the amount. If their records differ, the statement shows where.",
    whatItIs:
      "It lists each document in date order with a running balance, usually monthly. Unlike aging, which groups amounts by how overdue they are, a statement shows the full history between you and that customer. It's usually sent at regular intervals.",
    example:
      "Statement for March 2026: Opening balance RM 1,200 → Invoice I-0110 +RM 3,000 → Receipt OR-0045 −RM 1,200 → Credit note CN-0007 −RM 200 → Closing balance RM 2,800.",
    desktopSteps: null,
    cloudSteps: "Accounting Menu > Reports > Debtor Statement",
    mistakes: [
      "Sending statements before all receipts are knocked off, so customers see payments they already made as outstanding.",
      "Choosing the wrong date range, so the opening balance looks wrong.",
    ],
    related: ["debtor-aging", "receiving-payment-and-knock-off", "ar-deposit"],
    sources: [SRC.debtorStatement, SRC.customerOutstanding],
  },
  {
    slug: "debtor-aging",
    version: 1,
    title: "Debtor aging",
    category: "Customers (AR)",
    tellCustomer:
      "Debtor aging shows how much each customer still owes you, grouped by how long it has been unpaid, for example under 30 days, 31 to 60 days and over 90 days. It helps you see who to chase first. The older the amount, the higher the risk it won't be paid.",
    whatItIs:
      "Each outstanding invoice is placed in a column by its age, counted from the invoice date or due date. The total for each customer equals what they owe. Aging only works properly if receipts and credit notes are knocked off against the right invoices. Accountants also use it at year-end to judge bad debts.",
    example:
      "Customer A: RM 1,000 (0–30 days), RM 500 (31–60 days) → total RM 1,500.\nCustomer B: RM 2,000 (over 90 days) → chase B first and check whether it's still collectable.",
    desktopSteps: null,
    cloudSteps: "Accounting Menu > Reports > Debtor Aging",
    mistakes: [
      "Receipts not knocked off, so old invoices still look overdue even though the customer paid.",
      "Comparing aging by invoice date with a customer who counts from the due date.",
      "Opening balances entered as one total, so aging can't age them properly.",
    ],
    related: ["debtor-statement", "receiving-payment-and-knock-off", "bad-debts", "opening-balance"],
    sources: [SRC.debtorAging, SRC.customerOutstanding, SRC.agingReceivables],
  },
];
