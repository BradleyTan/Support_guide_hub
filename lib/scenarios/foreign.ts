import type { Scenario } from "@/lib/scenarios/types";
import { convert, entry, fc, gainOrLoss, percentOf, rm } from "@/lib/scenarios/money";
import { currencyField, f, money, num, check, result, step, text } from "@/lib/scenarios/common";

const FX_STANDARD = "MFRS 121 / MPERS Section 30 (foreign currency)";

export const foreignScenarios: Scenario[] = [
  {
    id: "fx-receipt",
    title: "Customer pays a foreign-currency invoice (realised gain/loss)",
    category: "Foreign currency",
    summary: "Receipt in foreign currency at a different rate from the invoice.",
    fields: [currencyField, f.date("date", "Date received", "2026-09-05"), f.foreign("amount", "Amount received (foreign currency)", 2000), f.rate("invRate", "Rate on the invoice", 4.4), f.rate("payRate", "Rate on the day received", 4.38)],
    build: (v) => {
      const cur = text(v, "currency").toUpperCase() || "FX";
      const amt = money(v, "amount");
      const invRate = num(v, "invRate");
      const payRate = num(v, "payRate");
      check(amt > 0, "amount", "Enter the amount received.");
      const carrying = convert(amt, invRate);
      const bank = convert(amt, payRate);
      const diff = bank - carrying;
      return {
        narrative: `${fc(amt, cur)} received at ${payRate} against an invoice booked at ${invRate}.`,
        confidence: "High",
        result: result({
          understanding: [`The receivable was booked at ${rm(carrying)}; the bank received ${rm(bank)}.`, diff ? `Realised ${diff > 0 ? "gain" : "loss"} of ${rm(Math.abs(diff))}.` : "No exchange difference."],
          assumptions: [`Rates are RM per ${cur}.`, "No month-end revaluation was posted in between (if it was, use the revalued rate as the invoice rate)."],
          treatment: { standard: FX_STANDARD, points: ["The receivable leaves the books at the rate it was carried at.", "The difference from the rate on the day of receipt is a realised exchange gain or loss."] },
          entries: [entry(text(v, "date"), `Receipt ${fc(amt, cur)} @ ${payRate}`, [{ account: `Bank – ${cur}`, dr: bank }, { account: "Trade debtor", cr: carrying }, ...gainOrLoss(diff, "Realised exchange gain", "Realised exchange loss")])],
          steps: [step("Customer Payment", "A/R › Payment", [`Currency ${cur}`, `Rate ${payRate}`, `Amount ${fc(amt, cur)}`, "Knock off the invoice; check the gain/loss posts to the default accounts"])],
          tax: ["Realised exchange gains and losses on trade are generally taxable / deductible."],
          mistakes: ["Entering the receipt at the invoice rate, which hides the exchange difference.", "Default gain/loss accounts not set, so it posts to the wrong account."],
          verifyReports: ["Aged Debtor in foreign currency and RM", "GL: exchange gain/loss"],
        }),
      };
    },
  },
  {
    id: "fx-supplier-payment",
    title: "Pay a foreign-currency supplier invoice (realised gain/loss)",
    category: "Foreign currency",
    summary: "Payment in foreign currency at a different rate from the purchase invoice.",
    fields: [currencyField, f.date("date", "Payment date", "2026-09-18"), f.foreign("amount", "Amount paid (foreign currency)", 3000), f.rate("invRate", "Rate on the supplier invoice", 4.35), f.rate("payRate", "Rate on the day paid", 4.42)],
    build: (v) => {
      const cur = text(v, "currency").toUpperCase() || "FX";
      const amt = money(v, "amount");
      const invRate = num(v, "invRate");
      const payRate = num(v, "payRate");
      check(amt > 0, "amount", "Enter the amount paid.");
      const carrying = convert(amt, invRate);
      const bank = convert(amt, payRate);
      const diff = carrying - bank; // paying less RM than booked = gain
      return {
        narrative: `${fc(amt, cur)} paid at ${payRate} against a supplier invoice booked at ${invRate}.`,
        confidence: "High",
        result: result({
          understanding: [`The payable was booked at ${rm(carrying)}; the payment cost ${rm(bank)}.`, diff ? `Realised ${diff > 0 ? "gain" : "loss"} of ${rm(Math.abs(diff))}.` : "No exchange difference."],
          assumptions: [`Rates are RM per ${cur}.`, "No month-end revaluation was posted in between."],
          treatment: { standard: FX_STANDARD, points: ["The payable leaves the books at its carrying rate; the difference is a realised exchange gain or loss."] },
          entries: [entry(text(v, "date"), `Payment ${fc(amt, cur)} @ ${payRate}`, [{ account: "Trade creditor", dr: carrying }, { account: `Bank – ${cur}`, cr: bank }, ...gainOrLoss(diff, "Realised exchange gain", "Realised exchange loss")])],
          steps: [step("Supplier Payment", "A/P › Payment", [`Currency ${cur}`, `Rate ${payRate}`, `Amount ${fc(amt, cur)}`, "Knock off the supplier invoice"])],
          tax: ["Realised exchange differences on trade payables are generally deductible / taxable."],
          mistakes: ["Paying from an RM account but recording the rate of a foreign-currency account (or vice versa)."],
          verifyReports: ["Aged Creditor in foreign currency and RM", "GL: exchange gain/loss"],
        }),
      };
    },
  },
  {
    id: "fx-revaluation",
    title: "Month-end revaluation of a foreign-currency balance",
    category: "Foreign currency",
    summary: "Restate an open foreign-currency receivable or payable at the closing rate (unrealised).",
    fields: [
      f.choice("side", "Balance type", "debtor", [
        { value: "debtor", label: "Customer owes us (receivable)" },
        { value: "creditor", label: "We owe a supplier (payable)" },
      ]),
      currencyField,
      f.date("date", "Revaluation date", "2026-09-30"),
      f.foreign("amount", "Open balance (foreign currency)", 2400),
      f.rate("bookRate", "Rate it's currently carried at", 4.4),
      f.rate("closeRate", "Closing rate", 4.35),
    ],
    build: (v) => {
      const cur = text(v, "currency").toUpperCase() || "FX";
      const isDebtor = text(v, "side") !== "creditor";
      const amt = money(v, "amount");
      const book = convert(amt, num(v, "bookRate"));
      const close = convert(amt, num(v, "closeRate"));
      check(amt > 0, "amount", "Enter the open balance.");
      const change = close - book; // RM change in the balance
      const party = isDebtor ? "Trade debtor" : "Trade creditor";
      const gainLoss = isDebtor ? change : -change; // receivable up = gain; payable up = loss
      const lines = isDebtor
        ? change >= 0
          ? [{ account: party, dr: change }, ...gainOrLoss(gainLoss, "Unrealised exchange gain", "Unrealised exchange loss")]
          : [...gainOrLoss(gainLoss, "Unrealised exchange gain", "Unrealised exchange loss"), { account: party, cr: -change }]
        : change >= 0
          ? [...gainOrLoss(gainLoss, "Unrealised exchange gain", "Unrealised exchange loss"), { account: party, cr: change }]
          : [{ account: party, dr: -change }, ...gainOrLoss(gainLoss, "Unrealised exchange gain", "Unrealised exchange loss")];
      return {
        narrative: `${isDebtor ? "Receivable" : "Payable"} of ${fc(amt, cur)} restated from ${num(v, "bookRate")} to ${num(v, "closeRate")}.`,
        confidence: "High",
        result: result({
          understanding: [`Carried at ${rm(book)}, worth ${rm(close)} at the closing rate.`, gainLoss ? `Unrealised ${gainLoss > 0 ? "gain" : "loss"} of ${rm(Math.abs(gainLoss))}.` : "No change."],
          assumptions: ["Revaluation is reversed on the first day of the next period (common practice), or the next revaluation adjusts from the new carrying rate."],
          treatment: { standard: FX_STANDARD, points: ["Monetary items in foreign currency are translated at the closing rate at each reporting date.", "Differences go to profit or loss as unrealised exchange gain or loss."] },
          entries: change ? [entry(text(v, "date"), `Revalue ${fc(amt, cur)} to ${num(v, "closeRate")}`, lines)] : [],
          steps: [step("Currency revaluation", "G/L › Currency revaluation", [`Date ${text(v, "date")}`, `${cur} rate ${num(v, "closeRate")}`, "Unrealised gain/loss accounts set", "Reverse on the first day of next month if that's the policy"])],
          tax: ["Unrealised exchange differences are generally not taxable / deductible until realised; check the tax computation adjustments."],
          mistakes: ["Forgetting to revalue, so the RM Aged Debtor doesn't match the GL.", "Not reversing the revaluation and also revaluing again from the original rate (double count)."],
          verifyReports: ["Aged Debtor / Creditor in RM vs GL control account", "GL: unrealised exchange gain/loss"],
        }),
      };
    },
  },
  {
    id: "usd-deposit-sst-partial",
    title: "Foreign deposit → invoice with SST → partial payment → month-end",
    category: "Foreign currency",
    summary: "The full cycle: foreign-currency deposit, service invoice with service tax, deposit applied, partial payment, revaluation.",
    fields: [
      currencyField,
      f.foreign("deposit", "Deposit received (foreign)", 1000),
      f.rate("depRate", "Rate on the deposit date", 4.45),
      f.foreign("service", "Service amount before tax (foreign)", 5000),
      f.percent("taxRate", "Service tax rate (%)", 8),
      f.rate("invRate", "Rate on the invoice date", 4.4),
      f.foreign("payment", "Partial payment received (foreign)", 2000),
      f.rate("payRate", "Rate on the payment date", 4.38),
      f.rate("closeRate", "Month-end closing rate", 4.35),
      f.date("depDate", "Deposit date", "2026-08-01"),
      f.date("invDate", "Invoice date", "2026-08-15"),
      f.date("payDate", "Payment date", "2026-09-05"),
      f.date("closeDate", "Month-end date", "2026-09-30"),
    ],
    build: (v) => {
      const cur = text(v, "currency").toUpperCase() || "FX";
      const dep = money(v, "deposit");
      const svc = money(v, "service");
      const pay = money(v, "payment");
      const [depRate, invRate, payRate, closeRate, taxRate] = ["depRate", "invRate", "payRate", "closeRate", "taxRate"].map((k) => num(v, k));
      check(svc > 0, "service", "Enter the service amount.");
      const taxFc = percentOf(svc, taxRate);
      const totalFc = svc + taxFc;
      check(dep <= totalFc, "deposit", "The deposit can't be more than the invoice total.");
      check(pay <= totalFc - dep, "payment", "The payment can't be more than what's left after the deposit.");

      const depRm = convert(dep, depRate);
      const revRm = convert(svc, invRate);
      const taxRm = convert(taxFc, invRate);
      const debtorRm = revRm + taxRm;
      const depAtInv = convert(dep, invRate);
      const payAtInv = convert(pay, invRate);
      const payRm = convert(pay, payRate);
      const openFc = totalFc - dep - pay;
      const carrying = debtorRm - depAtInv - payAtInv;
      const closing = convert(openFc, closeRate);

      const entries = [];
      if (dep) entries.push(entry(text(v, "depDate"), `Deposit received ${fc(dep, cur)} @ ${depRate}`, [{ account: `Bank – ${cur}`, dr: depRm }, { account: "Customer deposit (liability)", cr: depRm }]));
      entries.push(
        entry(text(v, "invDate"), `Invoice ${fc(svc, cur)} + ${taxRate}% service tax @ ${invRate}`, [
          { account: "Trade debtor", dr: debtorRm },
          { account: "Service revenue", cr: revRm },
          { account: "Service tax payable", cr: taxRm },
        ]),
      );
      if (dep)
        entries.push(
          entry(text(v, "invDate"), `Apply deposit ${fc(dep, cur)} to the invoice`, [
            { account: "Customer deposit (liability)", dr: depRm },
            { account: "Trade debtor", cr: depAtInv },
            ...gainOrLoss(depRm - depAtInv, "Realised exchange gain", "Realised exchange loss"),
          ]),
        );
      if (pay)
        entries.push(
          entry(text(v, "payDate"), `Partial payment ${fc(pay, cur)} @ ${payRate}`, [
            { account: `Bank – ${cur}`, dr: payRm },
            { account: "Trade debtor", cr: payAtInv },
            ...gainOrLoss(payRm - payAtInv, "Realised exchange gain", "Realised exchange loss"),
          ]),
        );
      if (openFc && closing !== carrying) {
        const change = closing - carrying;
        entries.push(
          entry(
            text(v, "closeDate"),
            `Revalue open ${fc(openFc, cur)} from ${invRate} to ${closeRate}`,
            change > 0 ? [{ account: "Trade debtor", dr: change }, { account: "Unrealised exchange gain", cr: change }] : [{ account: "Unrealised exchange loss", dr: -change }, { account: "Trade debtor", cr: -change }],
          ),
        );
      }

      return {
        narrative: `${fc(dep, cur)} deposit at ${depRate}; invoice ${fc(svc, cur)} + ${taxRate}% service tax at ${invRate}; ${fc(pay, cur)} paid at ${payRate}; month-end rate ${closeRate}.`,
        confidence: "Medium",
        result: result({
          understanding: [
            `Invoice total ${fc(totalFc, cur)} (${rm(debtorRm)} at the invoice rate), of which service tax ${fc(taxFc, cur)} (${rm(taxRm)}).`,
            `After the deposit and payment, ${fc(openFc, cur)} is outstanding, carried at ${rm(closing)} after month-end revaluation.`,
          ],
          assumptions: ["The company's functional currency is RM and it is registered for service tax.", "The rates entered are the ones the company uses (e.g. bank buying rate)."],
          treatment: {
            standard: `${FX_STANDARD}, MFRS 15, IC Interpretation 22 (advance consideration)`,
            points: [
              "The deposit is a liability until the service is invoiced.",
              "Revenue and the receivable are recorded at the rate on the invoice date.",
              "Differences on applying the deposit and on payment are realised exchange gains/losses; the open balance is revalued at month-end (unrealised).",
            ],
          },
          judgementNote:
            dep && depRm !== depAtInv
              ? `Under IC Interpretation 22, the prepaid part can be measured at the deposit-date rate instead, which moves the ${rm(Math.abs(depRm - depAtInv))} difference from exchange gain/loss into revenue. Confirm the company's policy.`
              : undefined,
          entries,
          steps: [
            step("Customer deposit", "A/R › Deposit", [`Currency ${cur}`, `Rate ${depRate}`, `Amount ${fc(dep, cur)}`]),
            step("Sales Invoice", "Sales › Invoice", [`Currency ${cur}`, `Rate ${invRate}`, `Service ${fc(svc, cur)}`, `Tax code: service tax ${taxRate}%`]),
            step("Knock off deposit", "A/R › Deposit › knock off", [`Knock off ${fc(dep, cur)} against the invoice`]),
            step("Customer Payment", "A/R › Payment", [`Rate ${payRate}`, `Amount ${fc(pay, cur)}`, "Knock off against the invoice"]),
            step("Currency revaluation", "G/L › Currency revaluation", [`Rate ${closeRate}`, "Unrealised gain/loss accounts set"]),
          ],
          tax: [
            `Service tax ${fc(taxFc, cur)} = ${rm(taxRm)} at the invoice rate.`,
            "Service tax is generally due when payment is received, or 12 months after the invoice if unpaid; match the SST-02 period to receipts.",
            "e-Invoice (MyInvois): a foreign-currency invoice must show the currency and exchange rate.",
          ],
          mistakes: ["Recording the deposit as sales.", "Knocking off the deposit in RM at the invoice rate without the exchange difference.", "Skipping month-end revaluation."],
          verifyReports: ["Trial Balance: customer deposit nil after knock-off", `Aged Debtor in ${cur} and RM`, "GL: realised and unrealised exchange accounts", "SST-02 draft"],
          needsVerification: ["The service tax rate and timing for this service", "The company's policy under IC Interpretation 22"],
        }),
      };
    },
  },
];
