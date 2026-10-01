import type { Scenario } from "@/lib/scenarios/types";
import { entry, percentOf, rm } from "@/lib/scenarios/money";
import { f, money, num, check, result, step, text } from "@/lib/scenarios/common";

export const salesScenarios: Scenario[] = [
  {
    id: "customer-deposit",
    title: "Customer pays a deposit before the invoice",
    category: "Sales & receivables",
    summary: "Money received before goods or services are delivered: a liability, not sales.",
    fields: [f.text("customer", "Customer", "ABC Sdn Bhd"), f.date("date", "Date received", "2026-08-01"), f.money("amount", "Deposit received (RM)", 5000)],
    build: (v) => {
      const amt = money(v, "amount");
      check(amt > 0, "amount", "Enter the deposit amount.");
      return {
        narrative: `${text(v, "customer")} paid a deposit of ${rm(amt)} before any invoice was issued.`,
        confidence: "Medium",
        result: result({
          understanding: [`A deposit of ${rm(amt)} is received in advance; nothing has been delivered yet.`],
          assumptions: ["The deposit is refundable or will be applied against a later invoice.", "Paid into the company's RM bank account."],
          treatment: {
            standard: "MFRS 15 (contract liability) / MPERS Section 23",
            points: ["Revenue isn't earned until goods or services are delivered.", "Record the deposit as a liability (customer deposit / contract liability) until it is applied to the invoice or refunded."],
          },
          entries: [entry(text(v, "date"), "Deposit received", [{ account: "Bank", dr: amt }, { account: "Customer deposit (liability)", cr: amt }])],
          steps: [step("Customer deposit", "A/R › Deposit", ["Customer", `Amount ${rm(amt)}`, "Payment method: bank account", "Reference: customer's payment slip"])],
          tax: ["No sales tax on a deposit for goods; sales tax is charged on the invoice.", "Service tax is generally due when payment is received, so a deposit for a taxable service may make service tax due now."],
          mistakes: ["Recording the deposit as sales, which overstates revenue (and possibly tax).", "Leaving the deposit unapplied after the invoice is issued, so the customer shows a credit balance."],
          verifyReports: ["Balance sheet: customer deposit account", "Customer statement shows the deposit as unapplied credit"],
          needsVerification: ["Whether service tax is due on this deposit for your client's service (payment basis); check with their tax agent."],
        }),
      };
    },
  },
  {
    id: "apply-deposit",
    title: "Apply a customer deposit to the invoice",
    category: "Sales & receivables",
    summary: "Knock off an earlier deposit against the final invoice.",
    fields: [f.date("date", "Date applied", "2026-08-15"), f.money("invoice", "Invoice total incl. tax (RM)", 21600), f.money("deposit", "Deposit held (RM)", 5000)],
    build: (v) => {
      const inv = money(v, "invoice");
      const dep = money(v, "deposit");
      check(inv > 0, "invoice", "Enter the invoice total.");
      check(dep > 0, "deposit", "Enter the deposit held.");
      const applied = Math.min(inv, dep);
      const leftDep = dep - applied;
      const leftInv = inv - applied;
      return {
        narrative: `A deposit of ${rm(dep)} is applied to an invoice of ${rm(inv)}.`,
        confidence: "High",
        result: result({
          understanding: [
            `${rm(applied)} of the deposit is applied.`,
            leftInv ? `The customer still owes ${rm(leftInv)}.` : "The invoice is fully settled by the deposit.",
            ...(leftDep ? [`${rm(leftDep)} of the deposit remains for a future invoice or refund.`] : []),
          ],
          assumptions: ["The invoice was recorded separately (Dr Trade debtor, Cr Sales / tax)."],
          treatment: { standard: "MFRS 15 / MPERS Section 23", points: ["The contract liability is released against the receivable once the invoice is issued."] },
          entries: [entry(text(v, "date"), "Apply deposit to invoice", [{ account: "Customer deposit (liability)", dr: applied }, { account: "Trade debtor", cr: applied }])],
          steps: [step("Knock off deposit", "A/R › Deposit › knock off", ["Select the deposit", `Knock off ${rm(applied)} against the invoice`])],
          tax: ["No new tax entry; tax was recorded on the invoice."],
          mistakes: ["Recording a new receipt instead of knocking off, which double-counts cash."],
          verifyReports: ["Aged Debtor for the customer", "Customer deposit account balance"],
        }),
      };
    },
  },
  {
    id: "service-tax-invoice",
    title: "Invoice for a taxable service (service tax)",
    category: "Tax",
    summary: "Sales invoice for a service with service tax charged.",
    fields: [f.date("date", "Invoice date", "2026-08-15"), f.money("net", "Service amount before tax (RM)", 20000), f.percent("rate", "Service tax rate (%)", 8, "8% for most taxable services; some services are 6%. Check the current rate.")],
    build: (v) => {
      const net = money(v, "net");
      const rate = num(v, "rate");
      check(net > 0, "net", "Enter the service amount.");
      const tax = percentOf(net, rate);
      return {
        narrative: `Service invoice of ${rm(net)} plus ${rate}% service tax (${rm(tax)}), total ${rm(net + tax)}.`,
        confidence: "High",
        result: result({
          understanding: [`Revenue ${rm(net)}, service tax ${rm(tax)}, receivable ${rm(net + tax)}.`],
          assumptions: ["The company is registered for service tax and the service is taxable.", "Credit sale (customer pays later)."],
          treatment: { standard: "MFRS 15 / MPERS Section 23", points: ["Revenue excludes service tax, which is collected on behalf of the government.", "Service tax is a liability until paid to Customs."] },
          entries: [entry(text(v, "date"), "Service invoice with service tax", [{ account: "Trade debtor", dr: net + tax }, { account: "Service revenue", cr: net }, { account: "Service tax payable", cr: tax }])],
          steps: [step("Sales Invoice", "Sales › Invoice", ["Customer and date", `Line: service, ${rm(net)}`, `Tax code: service tax ${rate}% (code name per the client's setup)`])],
          tax: [
            "Service tax is generally due when payment is received, or 12 months after the invoice if still unpaid; match the SST-02 period to receipts.",
            "e-Invoice (MyInvois): issue an e-Invoice if the client is in scope for its rollout phase.",
          ],
          mistakes: ["Using a sales tax code for a service, or no tax code, so the SST-02 report misses it.", "Recording tax-inclusive amount as revenue."],
          verifyReports: ["SST-02 draft for the period", "GL: service tax payable", "Trial Balance"],
          needsVerification: ["The service tax rate for this specific service"],
        }),
      };
    },
  },
  {
    id: "sales-tax-invoice",
    title: "Invoice for taxable goods (sales tax)",
    category: "Tax",
    summary: "Sales invoice by a registered manufacturer with sales tax, plus cost of sales.",
    fields: [
      f.date("date", "Invoice date", "2026-09-01"),
      f.money("net", "Goods amount before tax (RM)", 10000),
      f.percent("rate", "Sales tax rate (%)", 10, "5% or 10% depending on the goods."),
      f.money("cost", "Cost of the goods sold (RM, 0 to skip)", 6000),
    ],
    build: (v) => {
      const net = money(v, "net");
      const cost = money(v, "cost");
      const rate = num(v, "rate");
      check(net > 0, "net", "Enter the goods amount.");
      const tax = percentOf(net, rate);
      const entries = [entry(text(v, "date"), "Sales invoice with sales tax", [{ account: "Trade debtor", dr: net + tax }, { account: "Sales", cr: net }, { account: "Sales tax payable", cr: tax }])];
      if (cost) entries.push(entry(text(v, "date"), "Cost of goods sold", [{ account: "Cost of sales", dr: cost }, { account: "Inventory", cr: cost }]));
      return {
        narrative: `Goods sold for ${rm(net)} plus ${rate}% sales tax (${rm(tax)}); cost ${rm(cost)}.`,
        confidence: "High",
        result: result({
          understanding: [`Receivable ${rm(net + tax)}, sales ${rm(net)}, sales tax ${rm(tax)}.`, ...(cost ? [`Gross profit ${rm(net - cost)}.`] : [])],
          assumptions: ["The seller is registered for sales tax and the goods are taxable.", "Perpetual stock: AutoCount posts cost of sales when the invoice is saved."],
          treatment: { standard: "MFRS 15 & MFRS 102 / MPERS Sections 13 and 23", points: ["Sales tax collected is a liability, not revenue.", "Cost of the goods moves from inventory to cost of sales when control passes."] },
          entries,
          steps: [step("Sales Invoice", "Sales › Invoice", ["Item lines with quantity and price", `Tax code: sales tax ${rate}%`, "Location the stock is issued from"])],
          tax: ["Sales tax is due on the sale (for goods) and reported in SST-02.", "Non-manufacturers generally don't charge sales tax."],
          mistakes: ["Charging sales tax when the client isn't a registered manufacturer.", "Wrong tax rate for the tariff code."],
          verifyReports: ["SST-02 draft", "Stock card for the items", "Gross profit report"],
          needsVerification: ["The sales tax rate for the goods' tariff code"],
        }),
      };
    },
  },
  {
    id: "partial-payment",
    title: "Customer pays part of an invoice",
    category: "Sales & receivables",
    summary: "Partial receipt, with optional bank charges deducted, and any overpayment held as a deposit.",
    fields: [f.date("date", "Date received", "2026-09-05"), f.money("invoice", "Amount the customer owes (RM)", 16600), f.money("received", "Amount paid by the customer (RM)", 10000), f.money("charges", "Bank charges deducted (RM)", 0)],
    build: (v) => {
      const owed = money(v, "invoice");
      const paid = money(v, "received");
      const charges = money(v, "charges");
      check(owed > 0, "invoice", "Enter the amount owed.");
      check(paid > 0, "received", "Enter the amount paid.");
      check(charges < paid, "charges", "Bank charges must be less than the amount paid.");
      const toDebtor = Math.min(paid, owed);
      const excess = paid - toDebtor;
      return {
        narrative: `Customer paid ${rm(paid)} against ${rm(owed)} owed${charges ? `, with ${rm(charges)} bank charges deducted` : ""}.`,
        confidence: "High",
        result: result({
          understanding: [
            owed > paid ? `${rm(owed - paid)} remains outstanding.` : "The invoice is fully paid.",
            ...(excess ? [`${rm(excess)} overpaid is held as a customer deposit (or refunded).`] : []),
            ...(charges ? [`The bank kept ${rm(charges)} as charges, so ${rm(paid - charges)} reached the account.`] : []),
          ],
          assumptions: ["Payment in RM into the company's bank account."],
          treatment: { standard: "MFRS 9 / MPERS Section 11", points: ["The receivable is reduced by the full amount the customer paid, including any charges the bank deducted.", "Bank charges are an expense of the company."] },
          entries: [
            entry(text(v, "date"), "Receipt from customer", [
              { account: "Bank", dr: paid - charges },
              { account: "Bank charges", dr: charges },
              { account: "Trade debtor", cr: toDebtor },
              { account: "Customer deposit (liability)", cr: excess },
            ]),
          ],
          steps: [step("Customer Payment", "A/R › Payment", [`Amount ${rm(paid)}`, "Knock off against the invoice", ...(charges ? [`Bank charges ${rm(charges)}`] : [])])],
          tax: ["For service tax (payment basis), the part received is the taxable amount for this period."],
          mistakes: ["Knocking off only the net amount received, which leaves the bank charges as a false balance owing."],
          verifyReports: ["Aged Debtor", "Bank reconciliation for the period"],
        }),
      };
    },
  },
  {
    id: "credit-note-return",
    title: "Credit note for returned goods",
    category: "Sales & receivables",
    summary: "Customer returns goods; reverse sales and tax, and put the goods back into stock.",
    fields: [f.date("date", "Credit note date", "2026-09-24"), f.money("net", "Goods value before tax (RM)", 1000), f.percent("rate", "Tax rate on the original invoice (%)", 10, "0 if no tax was charged."), f.money("cost", "Cost of goods returned to stock (RM)", 600)],
    build: (v) => {
      const net = money(v, "net");
      const cost = money(v, "cost");
      const rate = num(v, "rate");
      check(net > 0, "net", "Enter the goods value.");
      const tax = percentOf(net, rate);
      const entries = [entry(text(v, "date"), "Credit note for returned goods", [{ account: "Sales returns", dr: net }, { account: "Sales tax payable", dr: tax }, { account: "Trade debtor", cr: net + tax }])];
      if (cost) entries.push(entry(text(v, "date"), "Goods back into stock at cost", [{ account: "Inventory", dr: cost }, { account: "Cost of sales", cr: cost }]));
      return {
        narrative: `Goods worth ${rm(net)} plus ${rate}% tax returned; cost ${rm(cost)} back to stock.`,
        confidence: "High",
        result: result({
          understanding: [`The customer's balance drops by ${rm(net + tax)}.`],
          assumptions: ["The goods are resaleable and go back to stock.", "The original invoice charged tax at the rate entered."],
          treatment: { standard: "MFRS 15 / MPERS Section 23", points: ["Reverse the revenue and the tax collected.", "Return the goods to inventory at their cost."] },
          entries,
          steps: [step("Credit Note", "Sales › Credit Note", ["Link to the original invoice", "Same tax code as the invoice", "Return to the original stock location"])],
          tax: ["Reference the original invoice so the tax adjustment is supported.", "e-Invoice: issue a credit note e-Invoice referencing the original e-Invoice."],
          mistakes: ["Using a different tax code from the original invoice."],
          verifyReports: ["Stock card", "SST-02 adjustment", "Aged Debtor"],
        }),
      };
    },
  },
  {
    id: "credit-note-price",
    title: "Credit note for a price reduction (no return)",
    category: "Sales & receivables",
    summary: "Discount or price adjustment after invoicing, including the tax on it.",
    fields: [f.date("date", "Credit note date", "2026-09-26"), f.money("net", "Reduction before tax (RM)", 500), f.percent("rate", "Tax rate on the original invoice (%)", 8)],
    build: (v) => {
      const net = money(v, "net");
      const rate = num(v, "rate");
      check(net > 0, "net", "Enter the reduction.");
      const tax = percentOf(net, rate);
      return {
        narrative: `Price reduced by ${rm(net)} plus ${rate}% tax (${rm(tax)}) after invoicing.`,
        confidence: "Medium",
        result: result({
          understanding: [`The customer owes ${rm(net + tax)} less.`],
          assumptions: ["No goods are returned; it's a price adjustment."],
          treatment: { standard: "MFRS 15 / MPERS Section 23", points: ["Reduce revenue (sales returns & allowances) and the tax collected."] },
          entries: [entry(text(v, "date"), "Credit note: price reduction", [{ account: "Sales returns & allowances", dr: net }, { account: "Tax payable", dr: tax }, { account: "Trade debtor", cr: net + tax }])],
          steps: [step("Credit Note", "Sales › Credit Note", ["Link to the original invoice", "Non-stock line for the adjustment", "Same tax code as the invoice"])],
          tax: ["Check the conditions for adjusting tax already declared before reducing the tax payable."],
          mistakes: ["Reducing revenue without reducing the tax, or the reverse."],
          verifyReports: ["SST-02 adjustment", "Aged Debtor"],
          needsVerification: ["Whether the tax already declared can be adjusted for this credit note"],
        }),
      };
    },
  },
  {
    id: "deposit-refund",
    title: "Refund a customer deposit",
    category: "Sales & receivables",
    summary: "Return an unused deposit to the customer.",
    fields: [f.date("date", "Refund date", "2026-09-30"), f.money("amount", "Refund amount (RM)", 1000)],
    build: (v) => {
      const amt = money(v, "amount");
      check(amt > 0, "amount", "Enter the refund amount.");
      return {
        narrative: `${rm(amt)} of an unused deposit is refunded to the customer.`,
        confidence: "High",
        result: result({
          understanding: [`The deposit liability and the bank both fall by ${rm(amt)}.`],
          assumptions: ["The deposit was recorded as a liability when received."],
          treatment: { standard: "MFRS 15 / MPERS Section 23", points: ["Refunding settles the contract liability; no revenue is involved."] },
          entries: [entry(text(v, "date"), "Deposit refunded", [{ account: "Customer deposit (liability)", dr: amt }, { account: "Bank", cr: amt }])],
          steps: [step("Deposit refund", "A/R › Deposit › Refund", ["Select the deposit", `Refund ${rm(amt)}`, "Payment method: bank account"])],
          tax: ["If service tax was paid on the deposit, check how to recover it after a refund."],
          mistakes: ["Recording the refund as an expense."],
          verifyReports: ["Customer deposit account", "Bank reconciliation"],
        }),
      };
    },
  },
  {
    id: "contra",
    title: "Contra: set off what a customer owes against what you owe them",
    category: "Sales & receivables",
    summary: "Customer is also a supplier and both sides agree to offset balances.",
    fields: [f.text("party", "Customer / supplier", "Lim Brothers"), f.date("date", "Contra date", "2026-09-20"), f.money("ar", "They owe you (RM)", 8000), f.money("ap", "You owe them (RM)", 5000), f.money("amount", "Amount to set off (RM)", 5000)],
    build: (v) => {
      const ar = money(v, "ar");
      const ap = money(v, "ap");
      const amt = money(v, "amount");
      check(amt > 0, "amount", "Enter the amount to set off.");
      check(amt <= Math.min(ar, ap), "amount", "The amount set off can't be more than either balance.");
      const party = text(v, "party");
      return {
        narrative: `${party}: ${rm(amt)} set off between a receivable of ${rm(ar)} and a payable of ${rm(ap)}.`,
        confidence: "High",
        result: result({
          understanding: [`After the contra, ${party} owes ${rm(ar - amt)} and you owe ${rm(ap - amt)}.`],
          assumptions: ["Both parties agreed in writing.", "Same legal entity on both sides, both balances in RM."],
          treatment: { standard: "MFRS 132 offsetting / MPERS Section 11", points: ["Only offset with a written agreement; otherwise settle separately."] },
          entries: [entry(text(v, "date"), `Contra with ${party}`, [{ account: `Trade creditor – ${party}`, dr: amt }, { account: `Trade debtor – ${party}`, cr: amt }])],
          steps: [step("Contra", "A/R (or A/P) › Contra", ["Debtor and creditor account", `Amount ${rm(amt)}`, "Knock off the specific invoices on both sides"])],
          tax: ["No tax effect; the original invoices carry the tax."],
          mistakes: ["Contra without knocking off specific invoices, which leaves both aged reports wrong."],
          verifyReports: ["Aged Debtor and Aged Creditor for the party"],
        }),
      };
    },
  },
];
