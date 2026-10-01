import type { AnalysisResult } from "@/lib/analysis-schema";
import type { Confidence } from "@/lib/types";

export const SCENARIO_CATEGORIES = [
  "Sales & receivables",
  "Purchases & payables",
  "Foreign currency",
  "Tax",
  "Stock",
  "Period-end",
  "Payroll",
  "Bank & cash",
] as const;
export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

export type FieldKind = "money" | "foreign" | "rate" | "percent" | "number" | "date" | "text" | "choice";

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  default: number | string;
  help?: string;
  /** For "choice" fields. */
  options?: { value: string; label: string }[];
  /** Upper bound for "number" fields (e.g. months). */
  max?: number;
}

export type Values = Record<string, number | string>;

/** Thrown by a scenario when inputs don't make sense together (e.g. payment larger than the invoice). */
export class ScenarioInputError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}

export interface ScenarioOutput {
  /** One-paragraph description of this calculation with the actual figures. */
  narrative: string;
  confidence: Confidence;
  result: AnalysisResult;
}

export interface Scenario {
  id: string;
  title: string;
  category: ScenarioCategory;
  /** What the scenario covers, shown in the picker. */
  summary: string;
  fields: Field[];
  build: (v: Values) => ScenarioOutput;
}
