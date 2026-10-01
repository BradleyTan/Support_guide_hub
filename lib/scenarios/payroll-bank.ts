import type { Scenario } from "@/lib/scenarios/types";
import { entry, rm } from "@/lib/scenarios/money";
import { f, money, check, result, step, text } from "@/lib/scenarios/common";

const EXAMPLE = "Example figures only: use the amounts from your payroll run or the statutory tables.";

export const payrollBankScenarios: Scenario[] = [
  {
    id: "payroll-journal",
    title: "Monthly payroll journal (EPF, SOCSO, EIS, PCB)",
    category: "Payroll",
    summary: "Post salaries and statutory contributions from the payroll summary to the GL.",
    fields: [
      f.date("date", "Payroll month end", "2026-09-30"),
      f.money("gross", "Gross salaries (RM)", 5000),
      f.money("epfEe", "EPF – employee (RM)", 550, EXAMPLE),
      f.money("epfEr", "EPF – employer (RM)", 650, EXAMPLE),
      f.money("socsoEe", "SOCSO – employee (RM)", 24.75, EXAMPLE),
      f.money("socsoEr", "SOCSO – employer (RM)", 86.65, EXAMPLE),
      f.money("eisEe", "EIS – employee (RM)", 9.9, EXAMPLE),
      f.money("eisEr", "EIS – employer (RM)", 9.9, EXAMPLE),
      f.money("pcb", "PCB / MTD (RM)", 120, EXAMPLE),
      f.money("hrd", "HRD levy (RM, 0 if not registered)", 50),
    ],
    build: (v) => {
      const [gross, epfEe, epfEr, socsoEe, socsoEr, eisEe, eisEr, pcb, hrd] = ["gross", "epfEe", "epfEr", "socsoEe", "socsoEr", "eisEe", "eisEr", "pcb", "hrd"].map((k) => money(v, k));
      check(gross > 0, "gross", "Enter gross salaries.");
      const net = gross - epfEe - socsoEe - eisEe - pcb;
      check(net >= 0, "pcb", "Employee deductions can't be more than gross salaries.");
      return {
        narrative: `Gross salaries ${rm(gross)}; net pay ${rm(net)} after EPF, SOCSO, EIS and PCB deductions.`,
        confidence: "Medium",
        result: result({
          understanding: [`Staff are paid ${rm(net)}. The employer's cost is ${rm(gross + epfEr + socsoEr + eisEr + hrd)}.`],
          assumptions: ["Amounts come from the payroll summary for the month.", EXAMPLE],
          treatment: { standard: "MFRS 119 / MPERS Section 28 (employee benefits)", points: ["Gross salary and employer contributions are expenses.", "Employee deductions and employer contributions are liabilities until paid to EPF, PERKESO and LHDN."] },
          entries: [
            entry(text(v, "date"), "Payroll for the month", [
              { account: "Salaries and wages", dr: gross },
              { account: "EPF – employer contribution", dr: epfEr },
              { account: "SOCSO – employer contribution", dr: socsoEr },
              { account: "EIS – employer contribution", dr: eisEr },
              { account: "HRD levy", dr: hrd },
              { account: "EPF payable", cr: epfEe + epfEr },
              { account: "SOCSO payable", cr: socsoEe + socsoEr },
              { account: "EIS payable", cr: eisEe + eisEr },
              { account: "PCB payable (LHDN)", cr: pcb },
              { account: "HRD levy payable", cr: hrd },
              { account: "Salaries payable (net pay)", cr: net },
            ]),
          ],
          steps: [step("Payroll to GL", "AutoCount Payroll › post to Accounting, or G/L › Journal Entry", ["Map each payroll item to its GL account", "Post once per month"])],
          tax: ["PCB, EPF, SOCSO and EIS are generally due by the 15th of the following month; HRD levy has its own deadline. Check current rules."],
          mistakes: ["Posting net pay as the salary expense.", "Mixing up employee and employer EPF shares."],
          verifyReports: ["Payroll summary vs GL", "Statutory payable accounts clear after payment"],
          needsVerification: ["Contribution amounts and due dates against current statutory tables"],
        }),
      };
    },
  },
  {
    id: "bank-charges-interest",
    title: "Bank charges and interest from the bank statement",
    category: "Bank & cash",
    summary: "Record items the bank posted that aren't in the books yet, before reconciling.",
    fields: [f.date("date", "Statement date", "2026-09-30"), f.money("charges", "Bank charges (RM)", 25), f.money("interest", "Interest earned (RM)", 12.4)],
    build: (v) => {
      const charges = money(v, "charges");
      const interest = money(v, "interest");
      check(charges > 0 || interest > 0, "charges", "Enter bank charges, interest, or both.");
      const entries = [];
      if (charges) entries.push(entry(text(v, "date"), "Bank charges per statement", [{ account: "Bank charges", dr: charges }, { account: "Bank", cr: charges }]));
      if (interest) entries.push(entry(text(v, "date"), "Interest earned per statement", [{ account: "Bank", dr: interest }, { account: "Interest income", cr: interest }]));
      return {
        narrative: `Bank statement shows charges of ${rm(charges)} and interest of ${rm(interest)}.`,
        confidence: "High",
        result: result({
          understanding: ["These appear on the bank statement first, so record them before reconciling."],
          assumptions: ["Ordinary current account items."],
          treatment: { standard: "Accrual basis", points: ["Charges are expenses; interest is income."] },
          entries,
          steps: [step("Cash Book entries", "Cash Book › Payment / Receipt", ["One entry per statement item", "Then tick them in bank reconciliation"])],
          tax: ["Interest income is generally taxable; some bank charges may include service tax (included in the cost)."],
          mistakes: ["Recording them only in the reconciliation instead of the books."],
          verifyReports: ["Bank reconciliation statement", "GL: bank charges and interest"],
        }),
      };
    },
  },
];
