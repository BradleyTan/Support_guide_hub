import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const SUPPLIERS: StarterArticle[] = [
  {
    slug: "purchase-invoice",
    version: 1,
    title: "Purchase invoice",
    category: "Suppliers (AP)",
    tellCustomer:
      "A purchase invoice records a bill from your supplier: what you bought and how much you owe them. It increases your stock or expenses and the amount owing to that supplier. You record it when you receive the bill, then pay it later.",
    whatItIs:
      "It posts Dr Stock or Expense (and claimable tax where applicable), Cr Creditor. For stock items it also adds quantity and cost. Key in the supplier's own invoice number as reference so you can match statements and avoid recording the same bill twice. Goods returned to the supplier are recorded with a purchase return.",
    example:
      "Supplier bills RM 4,000 for stock → Dr Purchases/Stock RM 4,000, Cr Creditor RM 4,000. You now owe the supplier RM 4,000 until you pay.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Keying the same bill twice because the supplier's invoice number wasn't recorded.",
      "Using the date you keyed it instead of the supplier's invoice date.",
      "Posting an asset purchase (e.g. a laptop) to an expense account.",
    ],
    related: ["supplier-payment", "creditor-aging", "supplier-deposit"],
    sources: [SRC.purchaseInvoice, SRC.purchaseReturn, SRC.creditor],
  },
  {
    slug: "supplier-payment",
    version: 1,
    title: "Supplier payment",
    category: "Suppliers (AP)",
    tellCustomer:
      "A supplier payment records money you paid a supplier, and it's matched (knocked off) against the bills it pays. That way the system knows which bills are settled and which are still owing. It works the same way as a customer receipt, just the other direction.",
    whatItIs:
      "A payment posts Dr Creditor, Cr Bank. It is then knocked off against the purchase invoices it settles. Bank charges are recorded separately as an expense. A bounced cheque to a supplier needs its own document to reverse the payment.",
    example:
      "You owe RM 4,000 on PI-0201 and pay RM 4,000 by bank transfer → Dr Creditor RM 4,000, Cr Bank RM 4,000, knocked off against PI-0201, which is now fully paid.",
    desktopSteps: null,
    cloudSteps: "Accounting > Cash Book Entry (payment voucher)\nAccounting > Knock Off Entry to match it to the bills",
    mistakes: [
      "Paying without knocking off, so creditor aging still shows the bill as owing.",
      "Recording the payment twice: once from the bank statement and once manually.",
    ],
    related: ["purchase-invoice", "creditor-aging", "contra", "bank-reconciliation"],
    sources: [SRC.cashBookImport, SRC.knockOffEntry, SRC.returnCheque],
  },
  {
    slug: "supplier-deposit",
    version: 1,
    title: "Supplier deposit",
    category: "Suppliers (AP)",
    tellCustomer:
      "A supplier deposit is money you pay a supplier before they've sent the bill. It isn't an expense yet; it's money the supplier owes you in goods or services. When their bill arrives, the deposit is used to pay part of it.",
    whatItIs:
      "Accounting-wise it's an asset (prepayment to the supplier) until the bill arrives, then it's applied against the purchase invoice so only the balance remains owing. No AutoCount source found yet for supplier deposits, so add the steps for Desktop and Cloud once you've checked how the client's edition records them.",
    example:
      "You pay a RM 1,000 deposit for machinery parts. Later the supplier bills RM 3,000 → apply the RM 1,000 deposit; you now owe RM 2,000.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Recording the deposit as an expense immediately, which understates profit early and overstates it later.",
      "Forgetting to apply the deposit, so you pay the supplier the full bill.",
    ],
    related: ["purchase-invoice", "supplier-payment", "ar-deposit"],
    sources: [SRC.creditor, SRC.knockOffEntry],
  },
  {
    slug: "creditor-aging",
    version: 1,
    title: "Creditor aging",
    category: "Suppliers (AP)",
    tellCustomer:
      "Creditor aging shows how much you still owe each supplier, grouped by how long each bill has been unpaid. It helps you plan payments and avoid paying late. It's the supplier version of debtor aging.",
    whatItIs:
      "Each unpaid purchase invoice is placed in a column by its age. It only works properly if supplier payments and purchase returns are knocked off against the right bills. Compare it with the supplier's own statement to catch missing bills or payments.",
    example:
      "Supplier X: RM 2,000 (0–30 days) and RM 1,500 (61–90 days). Pay the RM 1,500 first to protect the relationship and credit terms.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Payments not knocked off, so bills you've paid still look overdue.",
      "Not comparing with the supplier's statement, so missing bills go unnoticed until year-end.",
    ],
    related: ["purchase-invoice", "supplier-payment", "debtor-aging"],
    sources: [SRC.creditorAging, SRC.creditorStatement],
  },
];
