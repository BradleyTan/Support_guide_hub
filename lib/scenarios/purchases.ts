import type { Scenario } from "@/lib/scenarios/types";
import { entry, percentOf, rm } from "@/lib/scenarios/money";
import { f, money, num, check, result, step, text } from "@/lib/scenarios/common";

export const purchaseScenarios: Scenario[] = [
  {
    id: "purchase-invoice-sst",
    title: "Supplier invoice that includes SST",
    category: "Purchases & payables",
    summary: "Purchase with sales or service tax charged by the supplier. SST can't be claimed back, so it's part of the cost.",
    fields: [
      f.date("date", "Invoice date", "2026-09-10"),
      f.text("account", "Expense or asset account", "Professional fees"),
      f.money("net", "Amount before tax (RM)", 2000),
      f.percent("rate", "SST charged by the supplier (%)", 8, "0 if the supplier didn't charge SST."),
    ],
    build: (v) => {
      const net = money(v, "net");
      const rate = num(v, "rate");
      const account = text(v, "account") || "Expense";
      check(net > 0, "net", "Enter the amount before tax.");
      const tax = percentOf(net, rate);
      return {
        narrative: `Supplier invoice of ${rm(net)} plus ${rate}% SST (${rm(tax)}), charged to ${account}.`,
        confidence: "High",
        result: result({
          understanding: [`The full ${rm(net + tax)} is the cost, because SST paid on purchases isn't claimable like GST input tax.`],
          assumptions: ["Credit purchase (paid later).", "The tax is SST charged by the supplier, not an import duty or withholding tax."],
          treatment: { standard: "MFRS 102 / MFRS 116 / MPERS (cost includes non-recoverable taxes)", points: ["Non-recoverable taxes are part of the cost of the expense, stock or asset."] },
          entries: [entry(text(v, "date"), "Supplier invoice incl. SST", [{ account, dr: net + tax }, { account: "Trade creditor", cr: net + tax }])],
          steps: [step("Purchase Invoice", "Purchase › Invoice", ["Supplier and invoice number", `Account: ${account}`, "Tax code that adds the supplier's SST into the cost (per the client's setup)"])],
          tax: ["No input tax to claim under SST; don't post the tax to a recoverable tax account.", "Check if the client can claim any service tax exemption for business-to-business services (special rules apply)."],
          mistakes: ["Posting the SST to a 'tax recoverable' account that never clears."],
          verifyReports: ["Aged Creditor", "GL for the expense account"],
          needsVerification: ["Any service-tax exemption the client qualifies for on this purchase"],
        }),
      };
    },
  },
  {
    id: "supplier-payment-discount",
    title: "Pay a supplier and take an early-payment discount",
    category: "Purchases & payables",
    summary: "Settle a supplier invoice early and record the discount received.",
    fields: [f.date("date", "Payment date", "2026-09-15"), f.money("invoice", "Invoice amount (RM)", 10000), f.percent("pct", "Discount (%)", 2)],
    build: (v) => {
      const inv = money(v, "invoice");
      const pct = num(v, "pct");
      check(inv > 0, "invoice", "Enter the invoice amount.");
      check(pct < 100, "pct", "The discount must be under 100%.");
      const disc = percentOf(inv, pct);
      return {
        narrative: `Supplier invoice of ${rm(inv)} settled early with a ${pct}% discount (${rm(disc)}).`,
        confidence: "High",
        result: result({
          understanding: [`Pay ${rm(inv - disc)}; the ${rm(disc)} discount is income (or reduces the cost).`],
          assumptions: ["The discount is a settlement discount agreed with the supplier."],
          treatment: { standard: "MFRS 102 / MPERS", points: ["Settlement discounts reduce what you pay; record them as discount received (or as a reduction of the related cost if that's the company's policy)."] },
          entries: [entry(text(v, "date"), "Supplier payment with discount", [{ account: "Trade creditor", dr: inv }, { account: "Bank", cr: inv - disc }, { account: "Discount received", cr: disc }])],
          steps: [step("Supplier Payment", "A/P › Payment", [`Pay ${rm(inv - disc)}`, `Discount ${rm(disc)}`, "Knock off the full invoice"])],
          tax: ["If the supplier issues a credit note for the discount, follow its tax treatment."],
          mistakes: ["Knocking off only the cash paid, which leaves a false balance owing."],
          verifyReports: ["Aged Creditor", "Bank reconciliation"],
          needsVerification: ["Whether the company's policy is to reduce cost instead of recording discount received"],
        }),
      };
    },
  },
  {
    id: "withholding-tax",
    title: "Pay a non-resident with withholding tax",
    category: "Tax",
    summary: "Payment to a foreign service provider where part must be withheld and paid to LHDN.",
    fields: [
      f.date("date", "Invoice date", "2026-09-12"),
      f.text("account", "Expense account", "Technical services"),
      f.money("gross", "Gross amount payable (RM)", 20000),
      f.percent("rate", "Withholding tax rate (%)", 10, "Depends on the payment type and any tax treaty. Check before use."),
    ],
    build: (v) => {
      const gross = money(v, "gross");
      const rate = num(v, "rate");
      const account = text(v, "account") || "Expense";
      check(gross > 0, "gross", "Enter the gross amount.");
      const wht = percentOf(gross, rate);
      return {
        narrative: `Non-resident invoice of ${rm(gross)} with ${rate}% withholding tax (${rm(wht)}) paid to LHDN.`,
        confidence: "Medium",
        result: result({
          understanding: [`The supplier receives ${rm(gross - wht)}; ${rm(wht)} goes to LHDN on their behalf.`],
          assumptions: ["The payment is within the scope of Malaysian withholding tax.", "Amounts converted to RM already."],
          treatment: { standard: "Income Tax Act 1967 (withholding tax) / MFRS", points: ["The full gross amount is the expense.", "Withholding tax is a liability to LHDN until paid."] },
          entries: [entry(text(v, "date"), "Non-resident invoice with WHT", [{ account, dr: gross }, { account: "Trade creditor – non-resident", cr: gross - wht }, { account: "Withholding tax payable (LHDN)", cr: wht }])],
          steps: [step("Purchase Invoice and journal", "Purchase › Invoice, then G/L › Journal Entry", ["Record the gross invoice", "Move the withheld part to the WHT payable account"])],
          tax: ["Withholding tax is generally due to LHDN within one month of paying or crediting the non-resident. Late payment attracts a penalty.", "Unpaid withholding tax can make the expense non-deductible."],
          mistakes: ["Recording only the net amount as the expense.", "Missing the payment deadline to LHDN."],
          verifyReports: ["GL: withholding tax payable", "Aged Creditor"],
          needsVerification: ["The correct rate and whether a tax treaty reduces it", "The exact LHDN payment deadline for this payment type"],
        }),
      };
    },
  },
];
