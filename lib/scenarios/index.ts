import { z } from "zod";
import type { AnalysisResult } from "@/lib/analysis-schema";
import { journalTotals } from "@/lib/guide-utils";
import type { Field, Scenario, ScenarioOutput, Values } from "@/lib/scenarios/types";
import { ScenarioInputError } from "@/lib/scenarios/types";
import { salesScenarios } from "@/lib/scenarios/sales";
import { purchaseScenarios } from "@/lib/scenarios/purchases";
import { foreignScenarios } from "@/lib/scenarios/foreign";
import { periodEndScenarios } from "@/lib/scenarios/period-end";
import { payrollBankScenarios } from "@/lib/scenarios/payroll-bank";

export { SCENARIO_CATEGORIES, ScenarioInputError } from "@/lib/scenarios/types";
export type { Field, Scenario, ScenarioOutput, Values } from "@/lib/scenarios/types";

export const SCENARIOS: Scenario[] = [...salesScenarios, ...purchaseScenarios, ...foreignScenarios, ...periodEndScenarios, ...payrollBankScenarios];

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}

export function defaultValues(s: Scenario): Values {
  return Object.fromEntries(s.fields.map((f) => [f.key, f.default]));
}

const twoDecimals = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

/** Rule for one field; amounts are capped at RM 100 billion and must have at most 2 decimals. */
function fieldSchema(f: Field) {
  switch (f.kind) {
    case "money":
    case "foreign":
      return z.coerce.number({ error: `${f.label}: enter a number.` }).min(0, `${f.label} can't be negative.`).max(1e11, `${f.label} is too large.`).refine(twoDecimals, `${f.label}: use at most 2 decimal places.`);
    case "rate":
      return z.coerce.number({ error: `${f.label}: enter a number.` }).gt(0, `${f.label} must be more than 0.`).max(100000, `${f.label} is too large.`);
    case "percent":
      return z.coerce.number({ error: `${f.label}: enter a number.` }).min(0, `${f.label} can't be negative.`).max(100, `${f.label} can't be more than 100.`);
    case "number":
      return z.coerce.number({ error: `${f.label}: enter a number.` }).int(`${f.label}: use a whole number.`).min(0, `${f.label} can't be negative.`).max(f.max ?? 1e9, `${f.label} is too large.`);
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${f.label}: enter a date.`);
    case "choice":
      return z.enum((f.options ?? []).map((o) => o.value) as [string, ...string[]]);
    default:
      return z.string().trim().max(100, `${f.label}: keep it under 100 characters.`);
  }
}

export type RunResult = { ok: true; output: ScenarioOutput } | { ok: false; errors: Record<string, string> };

/** Validates the inputs, builds the result, and double-checks every entry balances. Never throws. */
export function runScenario(s: Scenario, raw: Values): RunResult {
  const schema = z.object(Object.fromEntries(s.fields.map((f) => [f.key, fieldSchema(f)])));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return { ok: false, errors };
  }
  try {
    const output = s.build(parsed.data as Values);
    for (const e of output.result.entries) if (!journalTotals(e).balanced) throw new Error(`Unbalanced: ${e.description}`);
    return { ok: true, output };
  } catch (e) {
    if (e instanceof ScenarioInputError) return { ok: false, errors: { [e.field]: e.message } };
    return { ok: false, errors: { _: "These figures couldn’t be calculated. Check the amounts and rates." } };
  }
}

/** What's stored with a saved analysis so it can be reopened in the calculator. */
export interface CalculatorRecord {
  scenarioId: string;
  inputs: Values;
}

export function withCalculator(result: AnalysisResult, record: CalculatorRecord): AnalysisResult & { calculator: CalculatorRecord } {
  return { ...result, calculator: record };
}
