import type { StarterArticle } from "@/lib/knowledge/model";
import { SRC } from "@/lib/knowledge/starter/sources";

export const BANK: StarterArticle[] = [
  {
    slug: "bank-reconciliation",
    version: 1,
    title: "Bank reconciliation",
    category: "Bank & cash",
    tellCustomer:
      "Bank reconciliation is checking that the bank balance in AutoCount matches your bank statement, and explaining any difference. Differences are usually cheques not yet cleared, bank charges you haven't recorded, or mistakes. Doing it every month catches errors early.",
    whatItIs:
      "You tick each transaction in AutoCount that also appears on the bank statement. What's left unticked explains the difference: cheques issued but not yet presented, deposits not yet credited by the bank, and items on the statement you haven't recorded yet (bank charges, interest, direct debits). After recording the missing items, the adjusted balances should match exactly. AutoCount Cloud Accounting can also import a bank statement (CSV or PDF) to help match.",
    example:
      "Bank statement balance on 31 March: RM 10,500. AutoCount bank balance: RM 9,950.\n• Cheque RM 600 issued 30 March, not yet presented → statement is RM 600 higher.\n• Bank charges RM 50 not yet recorded → record Dr Bank charges RM 50, Cr Bank RM 50, so AutoCount becomes RM 9,900.\nCheck: RM 10,500 − RM 600 = RM 9,900 ✓",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Reconciling only once a year, when old differences are hard to trace.",
      "Adjusting the book balance to match the statement without finding the cause.",
      "Ticking items by amount only, so two different RM 100 payments get mixed up.",
    ],
    related: ["post-dated-cheques", "petty-cash", "supplier-payment", "receiving-payment-and-knock-off"],
    sources: [SRC.importBankCsv, SRC.newBankAccount, SRC.reconcilingAccount],
  },
  {
    slug: "petty-cash",
    version: 1,
    title: "Petty cash",
    category: "Bank & cash",
    tellCustomer:
      "Petty cash is a small amount of cash kept in the office for little expenses like stamps, parking or snacks. You record each spending with its receipt and top the box back up when it runs low. The cash plus the receipts should always add up to the fixed amount.",
    whatItIs:
      "Petty cash is set up as its own cash account. A common method (the imprest system) keeps a fixed float: when topping up, you record all the receipts as expenses and withdraw exactly what was spent from the bank. At any time, cash in the box + unrecorded receipts = the float.",
    example:
      "Float RM 500. During the month RM 180 is spent (parking RM 60, stationery RM 120). Top-up: Dr Parking RM 60, Dr Stationery RM 120, Cr Bank RM 180. The box is back to RM 500.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Spending without keeping receipts, so expenses can't be supported for tax or audit.",
      "Mixing the owner's personal money with petty cash.",
      "Recording the top-up as one 'petty cash expense' instead of the real expense types.",
    ],
    related: ["bank-reconciliation", "chart-of-accounts", "journal-entry"],
    sources: [SRC.accountingBasicsQa, SRC.paymentMethod],
  },
  {
    slug: "post-dated-cheques",
    version: 1,
    title: "Post-dated cheques",
    category: "Bank & cash",
    tellCustomer:
      "A post-dated cheque has a future date on it, so it can't be banked until that date. Until then the money isn't in your bank yet, and the customer still effectively owes you. If the cheque later bounces, the payment is reversed and the customer owes the amount again.",
    whatItIs:
      "Record the receipt on (or near) the date the cheque can be banked, or track post-dated cheques separately until then, so the bank balance isn't overstated. A returned (bounced) cheque reverses the receipt: the customer's balance goes back up and the bank goes down. For suppliers it works the other way round.",
    example:
      "On 1 May a customer gives a cheque for RM 3,000 dated 31 May. On 31 May it's banked: Dr Bank RM 3,000, Cr Debtor RM 3,000. If it bounces on 3 June: Dr Debtor RM 3,000, Cr Bank RM 3,000, and you chase the customer again.",
    desktopSteps: null,
    cloudSteps: null,
    mistakes: [
      "Recording a post-dated cheque as received on the day you get it, so the bank balance is too high.",
      "Forgetting to reverse a bounced cheque, so the customer looks paid.",
    ],
    related: ["receiving-payment-and-knock-off", "bank-reconciliation", "debtor-aging"],
    sources: [SRC.returnCheque, SRC.reconcilingAccount],
  },
];
