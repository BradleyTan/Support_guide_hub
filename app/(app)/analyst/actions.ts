"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { getScenario, runScenario, withCalculator, type Values } from "@/lib/scenarios";
import { result as fillResult, step } from "@/lib/scenarios/common";
import { entry, toSen } from "@/lib/scenarios/money";
import { analysisResultSchema } from "@/lib/analysis-schema";
import { createGuide } from "@/app/(app)/guides/actions";
import type { Json } from "@/lib/supabase/database.types";
import type { Category } from "@/lib/types";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const codeSchema = z.string().regex(/^AN-\d{1,9}$/);

async function session() {
  const user = await getUser();
  return user ? await createClient() : null;
}

/** Saves a calculator result. The server recalculates from the inputs rather than trusting the browser's figures. */
export async function saveCalculation(scenarioId: string, inputs: Values): Promise<Result<{ code: string }>> {
  const scenario = getScenario(scenarioId);
  if (!scenario) return { ok: false, error: "That scenario doesn’t exist." };
  const run = runScenario(scenario, inputs);
  if (!run.ok) return { ok: false, error: "Some inputs need attention before saving." };
  const supabase = await session();
  if (!supabase) return { ok: false, error: "Your session has ended. Please sign in again." };

  const res = withCalculator(run.output.result, { scenarioId, inputs });
  const { data, error } = await supabase
    .from("analyses")
    .insert({ title: scenario.title, scenario: run.output.narrative, result: res as unknown as Json, confidence: run.output.confidence, model: "calculator" })
    .select("code")
    .single();
  if (error || !data) return { ok: false, error: "Couldn’t save. Please try again." };
  revalidatePath("/analyst");
  return { ok: true, data: { code: data.code } };
}

const manualSchema = z.object({
  title: z.string().trim().min(1, "Give the entry a title.").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date."),
  description: z.string().trim().max(300).default(""),
  notes: z.string().trim().max(4000).default(""),
  lines: z
    .array(
      z.object({
        account: z.string().trim().min(1, "Every line needs an account.").max(120),
        dr: z.number().min(0).max(1e11).default(0),
        cr: z.number().min(0).max(1e11).default(0),
      }),
    )
    .min(2, "Add at least two lines.")
    .max(50),
});

/** Saves a hand-built journal entry. Rejected unless total Dr equals total Cr. */
export async function saveManualJournal(input: unknown): Promise<Result<{ code: string }>> {
  const p = manualSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { title, date, description, notes, lines } = p.data;
  let journal;
  try {
    journal = entry(
      date,
      description || title,
      lines.map((l) => ({ account: l.account, dr: toSen(l.dr), cr: toSen(l.cr) })),
    );
  } catch {
    return { ok: false, error: "The entry doesn’t balance: total Dr must equal total Cr." };
  }
  if (!journal.lines.length) return { ok: false, error: "Enter some amounts." };
  const supabase = await session();
  if (!supabase) return { ok: false, error: "Your session has ended. Please sign in again." };

  const res = fillResult({
    understanding: notes ? [notes] : ["Journal entry built by hand."],
    assumptions: [],
    treatment: { standard: "Your own entry", points: ["Built manually; the treatment hasn’t been checked by the calculator."] },
    entries: [journal],
    steps: [step("Journal Entry", "G/L › Journal Entry", [`Date ${date}`, "Enter the lines as shown"])],
    tax: [],
    mistakes: [],
    verifyReports: ["Trial Balance"],
  });
  const { data, error } = await supabase
    .from("analyses")
    .insert({ title, scenario: description || notes || title, result: res as unknown as Json, confidence: "Medium", model: "manual" })
    .select("code")
    .single();
  if (error || !data) return { ok: false, error: "Couldn’t save. Please try again." };
  revalidatePath("/analyst");
  return { ok: true, data: { code: data.code } };
}

const CATEGORY_FOR: Record<string, Category> = {
  "Foreign currency": "Multi-currency",
  Tax: "Tax (SST / e-Invoice)",
  Stock: "Stock & Costing",
  "Period-end": "Year-end & Periods",
  Payroll: "Payroll Statutory",
  "Bank & cash": "Bank & Cash",
};

/** Turns a saved analysis into a guide (unverified), so the treatment is searchable alongside your fixes. */
export async function analysisToGuide(code: string): Promise<Result<{ code: string }>> {
  if (!codeSchema.safeParse(code).success) return { ok: false, error: "That analysis doesn’t exist." };
  const supabase = await session();
  if (!supabase) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { data: a } = await supabase.from("analyses").select("title, scenario, result").eq("code", code).is("deleted_at", null).maybeSingle();
  if (!a) return { ok: false, error: "That analysis doesn’t exist." };
  const parsed = analysisResultSchema.safeParse(a.result);
  if (!parsed.success) return { ok: false, error: "This analysis can’t be turned into a guide." };
  const r = parsed.data;
  const scenario = r.calculator ? getScenario(r.calculator.scenarioId) : undefined;
  const isPayroll = scenario?.category === "Payroll";

  const entryText = r.entries.map((e) => `Post: ${e.description}: ${e.lines.map((l) => `${l.dr ? "Dr" : "Cr"} ${l.account} ${(l.dr ?? l.cr ?? 0).toFixed(2)}`).join("; ")}`);
  const stepText = r.steps.map((s) => `${s.document} (${s.menuPath}): ${s.fields.join("; ")}`);
  const res = await createGuide({
    title: `${a.title} (${code})`.slice(0, 300),
    product: isPayroll ? "AutoCount Payroll" : "AutoCount Accounting",
    module: scenario?.category ?? "General Ledger",
    category: scenario ? (CATEGORY_FOR[scenario.category] ?? null) : null,
    symptom: a.scenario.slice(0, 4000),
    errorMessage: "",
    cause: r.treatment.points.join(" ").slice(0, 4000),
    steps: [...stepText, ...entryText, ...(r.verifyReports.length ? [`Check: ${r.verifyReports.join("; ")}`] : [])].map((s) => s.slice(0, 2000)).slice(0, 50),
    prevention: r.mistakes.join(" ").slice(0, 2000),
    tags: ["accounting", ...(scenario ? [scenario.id] : [])],
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { code: res.data.code } };
}

export async function deleteAnalysis(code: string): Promise<Result> {
  if (!codeSchema.safeParse(code).success) return { ok: false, error: "That analysis doesn’t exist." };
  const supabase = await session();
  if (!supabase) return { ok: false, error: "Your session has ended. Please sign in again." };
  const { error, count } = await supabase.from("analyses").update({ deleted_at: new Date().toISOString() }, { count: "exact" }).eq("code", code).is("deleted_at", null);
  if (error || !count) return { ok: false, error: "Couldn’t delete it. Please try again." };
  revalidatePath("/analyst");
  return { ok: true, data: undefined };
}
