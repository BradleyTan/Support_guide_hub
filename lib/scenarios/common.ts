import type { AnalysisResult } from "@/lib/analysis-schema";
import type { AutoCountStep } from "@/lib/types";
import { ScenarioInputError, type Field, type Values } from "@/lib/scenarios/types";
import { toSen } from "@/lib/scenarios/money";

/** Every AutoCount menu path here is unconfirmed; the UI shows "Needs verification" on each. */
export function step(document: string, where: string, fields: string[]): AutoCountStep {
  return { document, menuPath: `${where} (menu path to confirm)`, verified: false, fields };
}

export const GENERAL_SOURCE = { label: "General accounting knowledge (MFRS / MPERS). Confirm judgement calls with your accountant.", kind: "general" as const, ref: "" };

type ResultInput = Omit<AnalysisResult, "sources" | "needsVerification"> & { needsVerification?: string[] };

/** Fills the parts every scenario shares: the general-knowledge source and the menu-path reminder. */
export function result(r: ResultInput): AnalysisResult {
  const unverifiedSteps = r.steps.filter((s) => !s.verified).length;
  return {
    ...r,
    needsVerification: [...(unverifiedSteps ? [`The AutoCount menu path${unverifiedSteps > 1 ? "s" : ""} in step 4`] : []), ...(r.needsVerification ?? [])],
    sources: [GENERAL_SOURCE],
  };
}

// Value readers (inputs are validated before build() runs; these just convert units).
export const money = (v: Values, k: string) => toSen(Number(v[k]));
export const num = (v: Values, k: string) => Number(v[k]);
export const text = (v: Values, k: string) => String(v[k] ?? "").trim();

export function check(cond: boolean, field: string, message: string): asserts cond {
  if (!cond) throw new ScenarioInputError(field, message);
}

// Field builders keep scenario definitions short.
export const f = {
  money: (key: string, label: string, def: number, help?: string): Field => ({ key, label, kind: "money", default: def, help }),
  foreign: (key: string, label: string, def: number, help?: string): Field => ({ key, label, kind: "foreign", default: def, help }),
  rate: (key: string, label: string, def: number, help?: string): Field => ({ key, label, kind: "rate", default: def, help }),
  percent: (key: string, label: string, def: number, help?: string): Field => ({ key, label, kind: "percent", default: def, help }),
  number: (key: string, label: string, def: number, max: number, help?: string): Field => ({ key, label, kind: "number", default: def, max, help }),
  date: (key: string, label: string, def: string): Field => ({ key, label, kind: "date", default: def }),
  text: (key: string, label: string, def: string, help?: string): Field => ({ key, label, kind: "text", default: def, help }),
  choice: (key: string, label: string, def: string, options: { value: string; label: string }[]): Field => ({ key, label, kind: "choice", default: def, options }),
};

export const currencyField = f.text("currency", "Currency code", "USD", "e.g. USD, SGD, CNY");
