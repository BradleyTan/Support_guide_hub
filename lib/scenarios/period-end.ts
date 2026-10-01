import type { Scenario } from "@/lib/scenarios/types";
import { entry, percentOf, rm, roundToFiveSen } from "@/lib/scenarios/money";
import { f, money, num, check, result, step, text } from "@/lib/scenarios/common";

export const periodEndScenarios: Scenario[] = [
  {
    id: "stock-write-off",
    title: "Write off damaged or missing stock",
    category: "Stock",
    summary: "Stock take finds damaged or missing items; write them off at cost.",
    fields: [f.date("date", "Stock take date", "2026-09-12"), f.text("item", "Item", "HW-220"), f.number("qty", "Quantity written off", 47, 1_000_000), f.money("cost", "Unit cost (RM)", 50)],
    build: (v) => {
      const qty = num(v, "qty");
      const unit = money(v, "cost");
      check(qty > 0, "qty", "Enter the quantity.");
      check(unit > 0, "cost", "Enter the unit cost.");
      const total = qty * unit;
      return {
        narrative: `${qty} units of ${text(v, "item")} at ${rm(unit)} each are written off (${rm(total)}).`,
        confidence: "High",
        result: result({
          understanding: [`Inventory falls by ${rm(total)}, charged as an expense.`],
          assumptions: ["Weighted-average (or the company's) cost is used.", "No insurance claim."],
          treatment: { standard: "MFRS 102 / MPERS Section 13", points: ["Write inventory down to what it can be sold for (nil if damaged beyond sale) and expense the loss."] },
          entries: [entry(text(v, "date"), `Write off ${qty} × ${text(v, "item")}`, [{ account: "Stock write-off (expense)", dr: total }, { account: "Inventory", cr: total }])],
          steps: [step("Stock Adjustment", "Stock › Adjustment", [`Item ${text(v, "item")}`, `Quantity −${qty}`, "Reason: damaged / missing"])],
          tax: ["Keep the count sheets as support for the tax deduction. No SST effect."],
          mistakes: ["Using a stock issue instead of an adjustment, which may post to the wrong account."],
          verifyReports: ["Stock balance report", "GL: stock write-off"],
        }),
      };
    },
  },
  {
    id: "stock-surplus",
    title: "Stock take finds more stock than the system",
    category: "Stock",
    summary: "Record a stock surplus found during the count.",
    fields: [f.date("date", "Stock take date", "2026-09-12"), f.text("item", "Item", "HW-118"), f.number("qty", "Extra quantity found", 10, 1_000_000), f.money("cost", "Unit cost (RM)", 25)],
    build: (v) => {
      const qty = num(v, "qty");
      const unit = money(v, "cost");
      check(qty > 0, "qty", "Enter the quantity.");
      check(unit > 0, "cost", "Enter the unit cost.");
      const total = qty * unit;
      return {
        narrative: `${qty} extra units of ${text(v, "item")} at ${rm(unit)} are found at stock take (${rm(total)}).`,
        confidence: "High",
        result: result({
          understanding: [`Inventory rises by ${rm(total)}.`],
          assumptions: ["The surplus is genuine (not unrecorded goods received from a supplier, which need a purchase invoice instead)."],
          treatment: { standard: "MFRS 102 / MPERS Section 13", points: ["Bring the stock in at cost; the credit usually reduces cost of sales."] },
          entries: [entry(text(v, "date"), `Stock surplus ${qty} × ${text(v, "item")}`, [{ account: "Inventory", dr: total }, { account: "Stock adjustment (cost of sales)", cr: total }])],
          steps: [step("Stock Adjustment", "Stock › Adjustment", [`Item ${text(v, "item")}`, `Quantity +${qty}`, `Unit cost ${rm(unit)}`])],
          tax: ["No SST effect."],
          mistakes: ["Adjusting without first checking for unposted goods received notes."],
          verifyReports: ["Stock balance report", "Stock card"],
        }),
      };
    },
  },
  {
    id: "accrual",
    title: "Accrue an expense at period end (and reverse it)",
    category: "Period-end",
    summary: "Expense belongs to this period but the bill comes later, e.g. audit fee.",
    fields: [f.text("account", "Expense", "Audit fee"), f.money("amount", "Amount (RM)", 12000), f.date("date", "Period-end date", "2026-12-31"), f.date("reverseDate", "Reversal date (first day of next period)", "2027-01-01")],
    build: (v) => {
      const amt = money(v, "amount");
      const account = text(v, "account") || "Expense";
      check(amt > 0, "amount", "Enter the amount.");
      return {
        narrative: `${account} of ${rm(amt)} accrued at ${text(v, "date")} and reversed on ${text(v, "reverseDate")}.`,
        confidence: "High",
        result: result({
          understanding: ["The expense belongs to this period even though the bill arrives later."],
          assumptions: ["When the real bill arrives it's recorded normally; the reversal cancels the accrual."],
          treatment: { standard: "MFRS 101 / Conceptual Framework (accrual basis)", points: ["Accrue at period end; reverse on the first day of the next period."] },
          entries: [
            entry(text(v, "date"), `Accrue ${account}`, [{ account, dr: amt }, { account: "Accrued expenses", cr: amt }]),
            entry(text(v, "reverseDate"), `Reverse ${account} accrual`, [{ account: "Accrued expenses", dr: amt }, { account, cr: amt }]),
          ],
          steps: [step("Journal Entry", "G/L › Journal Entry", [`Date ${text(v, "date")}`, "Auto-reverse on the first day of next period, if available"])],
          tax: ["Accrued expenses are generally deductible when incurred; check specific rules (e.g. some provisions aren't)."],
          mistakes: ["Forgetting to reverse, which double-counts the expense next period."],
          verifyReports: ["Trial Balance at period end", "Accrued expenses listing"],
        }),
      };
    },
  },
  {
    id: "prepayment",
    title: "Prepaid expense (e.g. annual insurance) and monthly release",
    category: "Period-end",
    summary: "Pay for a year in advance and expense it month by month.",
    fields: [
      f.text("account", "Expense", "Insurance"),
      f.money("amount", "Amount paid (RM)", 2400),
      f.number("months", "Months covered", 12, 120),
      f.number("elapsed", "Months used up by period end", 3, 120),
      f.date("payDate", "Payment date", "2026-07-01"),
      f.date("date", "Period-end date", "2026-09-30"),
    ],
    build: (v) => {
      const amt = money(v, "amount");
      const months = num(v, "months");
      const used = num(v, "elapsed");
      const account = text(v, "account") || "Expense";
      check(amt > 0, "amount", "Enter the amount paid.");
      check(months >= 1, "months", "Enter the months covered.");
      check(used <= months, "elapsed", "Months used can't be more than months covered.");
      const expense = Math.round((amt * used) / months);
      const entries = [entry(text(v, "payDate"), `Pay ${account} in advance`, [{ account: `Prepaid ${account.toLowerCase()}`, dr: amt }, { account: "Bank", cr: amt }])];
      if (expense) entries.push(entry(text(v, "date"), `Release ${used} of ${months} months`, [{ account, dr: expense }, { account: `Prepaid ${account.toLowerCase()}`, cr: expense }]));
      return {
        narrative: `${rm(amt)} paid for ${months} months; ${used} months used by period end.`,
        confidence: "High",
        result: result({
          understanding: [`Expense so far ${rm(expense)}; prepayment left ${rm(amt - expense)}.`],
          assumptions: ["Straight-line over the period covered."],
          treatment: { standard: "Conceptual Framework (accrual basis)", points: ["Payment for future periods is an asset; release it to expense as the months pass."] },
          entries,
          steps: [step("Payment and journal", "Cash Book › Payment, then G/L › Journal Entry", ["Pay to the prepayment account", "Monthly (or period-end) journal to release the used part"])],
          tax: ["Deductible as the expense is recognised, generally."],
          mistakes: ["Expensing the full payment in the month paid."],
          verifyReports: ["Balance sheet: prepayments", "GL: expense account"],
        }),
      };
    },
  },
  {
    id: "depreciation",
    title: "Depreciation for the period (straight line)",
    category: "Period-end",
    summary: "Charge depreciation on a fixed asset for a number of months.",
    fields: [f.text("asset", "Asset", "Office laptop"), f.money("cost", "Cost (RM)", 6000), f.money("residual", "Residual value (RM)", 0), f.number("life", "Useful life (years)", 3, 100), f.number("months", "Months to charge", 1, 1200), f.date("date", "Period-end date", "2026-09-30")],
    build: (v) => {
      const cost = money(v, "cost");
      const residual = money(v, "residual");
      const life = num(v, "life");
      const months = num(v, "months");
      check(cost > 0, "cost", "Enter the cost.");
      check(residual < cost, "residual", "Residual value must be less than cost.");
      check(life >= 1, "life", "Enter the useful life.");
      const charge = Math.round(((cost - residual) * months) / (life * 12));
      return {
        narrative: `${text(v, "asset")}: cost ${rm(cost)}, ${life}-year life, ${months} month(s) of depreciation.`,
        confidence: "High",
        result: result({
          understanding: [`Depreciation for ${months} month(s): ${rm(charge)}.`],
          assumptions: ["Straight-line, no impairment, asset in use for the whole period."],
          treatment: { standard: "MFRS 116 / MPERS Section 17", points: ["Spread the cost less residual value over the useful life."] },
          entries: charge ? [entry(text(v, "date"), `Depreciation – ${text(v, "asset")}`, [{ account: "Depreciation expense", dr: charge }, { account: "Accumulated depreciation", cr: charge }])] : [],
          steps: [step("Journal Entry", "G/L › Journal Entry (or the fixed asset module if used)", [`Depreciation ${rm(charge)}`])],
          tax: ["Depreciation isn't tax-deductible; capital allowances are claimed instead in the tax computation."],
          mistakes: ["Deducting depreciation for tax instead of claiming capital allowances."],
          verifyReports: ["Fixed asset register vs GL", "Trial Balance"],
        }),
      };
    },
  },
  {
    id: "bad-debt",
    title: "Write off a bad debt",
    category: "Period-end",
    summary: "A customer won't pay; remove the receivable.",
    fields: [f.text("customer", "Customer", "XYZ Trading"), f.date("date", "Write-off date", "2026-09-30"), f.money("amount", "Amount written off incl. any tax (RM)", 3240)],
    build: (v) => {
      const amt = money(v, "amount");
      check(amt > 0, "amount", "Enter the amount.");
      return {
        narrative: `${rm(amt)} owed by ${text(v, "customer")} is written off as uncollectible.`,
        confidence: "Medium",
        result: result({
          understanding: [`The receivable of ${rm(amt)} is removed and expensed.`],
          assumptions: ["Recovery efforts are exhausted and documented.", "No allowance was made for this debt earlier (if it was, debit the allowance instead)."],
          treatment: { standard: "MFRS 9 / MPERS Section 11", points: ["Write off when there's no reasonable expectation of recovery."] },
          entries: [entry(text(v, "date"), `Bad debt – ${text(v, "customer")}`, [{ account: "Bad debts written off", dr: amt }, { account: "Trade debtor", cr: amt }])],
          steps: [step("Credit Note or journal", "A/R › Credit Note (bad debt) or G/L › Journal Entry", ["Knock off the outstanding invoices", "Account: bad debts written off"])],
          tax: ["If service or sales tax was already paid on this invoice, there may be bad debt relief after a waiting period; check the conditions."],
          mistakes: ["Writing off with a journal that doesn't knock off the invoices, leaving them in Aged Debtor."],
          verifyReports: ["Aged Debtor", "GL: bad debts"],
          needsVerification: ["Whether SST bad debt relief applies and its conditions"],
        }),
      };
    },
  },
  {
    id: "impairment",
    title: "Allowance for doubtful debts (impairment)",
    category: "Period-end",
    summary: "Provide for expected credit losses on receivables.",
    fields: [f.date("date", "Period-end date", "2026-12-31"), f.money("balance", "Receivables assessed (RM)", 50000), f.percent("pct", "Expected loss (%)", 4), f.money("existing", "Allowance already in the books (RM)", 1000)],
    build: (v) => {
      const bal = money(v, "balance");
      const pct = num(v, "pct");
      const existing = money(v, "existing");
      check(bal > 0, "balance", "Enter the receivables assessed.");
      const target = percentOf(bal, pct);
      const change = target - existing;
      return {
        narrative: `Expected loss ${pct}% on ${rm(bal)} = ${rm(target)}; allowance already ${rm(existing)}.`,
        confidence: "Medium",
        result: result({
          understanding: [change > 0 ? `Increase the allowance by ${rm(change)}.` : change < 0 ? `Release ${rm(-change)} of the allowance.` : "No change needed."],
          assumptions: ["The expected-loss rate comes from the company's ageing and history."],
          treatment: {
            standard: "MFRS 9 (expected credit loss) / MPERS Section 11 (incurred loss)",
            points: ["Under MFRS 9 the simplified approach uses lifetime expected losses for trade receivables.", "Under MPERS, impairment is recognised only when there's objective evidence of loss."],
          },
          judgementNote: "The loss rate is a judgement; base it on ageing and past collections and document it.",
          entries: change
            ? [
                entry(
                  text(v, "date"),
                  change > 0 ? "Increase allowance for impairment" : "Release allowance for impairment",
                  change > 0 ? [{ account: "Impairment loss on receivables", dr: change }, { account: "Allowance for impairment", cr: change }] : [{ account: "Allowance for impairment", dr: -change }, { account: "Impairment loss on receivables (reversal)", cr: -change }],
                ),
              ]
            : [],
          steps: [step("Journal Entry", "G/L › Journal Entry", [`Date ${text(v, "date")}`, "Allowance account (contra to receivables)"])],
          tax: ["General allowances are usually not tax-deductible; specific write-offs may be."],
          mistakes: ["Crediting the debtor control account directly instead of an allowance account."],
          verifyReports: ["Aged Debtor", "Balance sheet: receivables net of allowance"],
          needsVerification: ["Whether the client reports under MFRS or MPERS"],
        }),
      };
    },
  },
  {
    id: "cash-rounding",
    title: "Cash sale with 5-sen rounding",
    category: "Bank & cash",
    summary: "Round a cash bill to the nearest 5 sen and record the difference.",
    fields: [f.date("date", "Sale date", "2026-09-30"), f.money("bill", "Bill total (RM)", 10.97)],
    build: (v) => {
      const bill = money(v, "bill");
      check(bill > 0, "bill", "Enter the bill total.");
      const rounded = roundToFiveSen(bill);
      const diff = rounded - bill;
      return {
        narrative: `Cash bill of ${rm(bill)} is rounded to ${rm(rounded)}.`,
        confidence: "High",
        result: result({
          understanding: [diff ? `Rounding ${diff > 0 ? "gain" : "loss"} of ${rm(Math.abs(diff))}.` : "No rounding needed."],
          assumptions: ["Cash payment (rounding applies to the total bill paid in cash, not to card payments)."],
          treatment: { standard: "Rounding mechanism for cash payments", points: ["Sales stay at the full bill amount; the rounding difference goes to a rounding account."] },
          entries: [
            entry(text(v, "date"), "Cash sale with rounding", [
              { account: "Cash", dr: rounded },
              ...(diff < 0 ? [{ account: "Rounding adjustment", dr: -diff }] : []),
              { account: "Sales", cr: bill },
              ...(diff > 0 ? [{ account: "Rounding adjustment", cr: diff }] : []),
            ]),
          ],
          steps: [step("Cash Sale / POS", "Sales › Cash Sale (or POS)", ["Rounding account set in the options", `Bill ${rm(bill)}, received ${rm(rounded)}`])],
          tax: ["Tax is calculated on the bill before rounding."],
          mistakes: ["Rounding each line instead of the total bill."],
          verifyReports: ["GL: rounding adjustment", "Daily cash collection report"],
        }),
      };
    },
  },
];
