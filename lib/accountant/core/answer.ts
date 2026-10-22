// The contract between the ask-accountant Edge Function, Groq and the app. Shared with the Edge Function
// (copied by `npm run sync:core`), so it imports only zod.
import { z } from "zod";

export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const SOURCE_KINDS = ["my-guide", "knowledge", "official", "web"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type Platform = "desktop" | "cloud" | "both";

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  url: string;
  platform: Platform | null;
  /** Verified guide, Knowledge article with checked steps, or an AutoCount help-centre page. */
  checked: boolean;
  /** Masked body used for menu-path matching; never sent to the browser. */
  text: string;
}

const line = z.object({
  account: z.string().trim().min(1).max(200),
  accountType: z.enum(ACCOUNT_TYPES),
  dr: z.number().nullable(),
  cr: z.number().nullable(),
});

const entry = z.object({
  date: z.string().max(40).nullable(),
  description: z.string().max(500),
  lines: z.array(line).min(2).max(20),
});

const step = z.object({
  platform: z.enum(["desktop", "cloud"]),
  text: z.string().trim().min(1).max(1000),
  menuPath: z.string().trim().max(300).nullable(),
  sourceIds: z.array(z.string().max(10)).max(10),
});

/** What Groq must return. */
export const modelAnswerSchema = z.object({
  needsMoreInfo: z.boolean(),
  questions: z.array(z.string().trim().min(1).max(500)).max(5),
  summary: z.string().max(3000),
  assumptions: z.array(z.string().max(500)).max(10),
  entries: z.array(entry).max(10),
  steps: z.array(step).max(20),
  customerMessage: z.string().max(4000),
  needsAccountant: z.string().max(1000).nullable(),
  doubts: z.array(z.string().max(500)).max(10),
});

export type ModelAnswer = z.infer<typeof modelAnswerSchema>;
export type ModelEntry = ModelAnswer["entries"][number];
export type ModelStep = ModelAnswer["steps"][number];

const str = { type: "string" };
const strArray = { type: "array", items: str };
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

/** The same shape as JSON Schema, for Groq `response_format: { type: "json_schema", json_schema: { strict: true, ... } }`. */
export const modelAnswerJsonSchema = obj({
  needsMoreInfo: { type: "boolean" },
  questions: strArray,
  summary: str,
  assumptions: strArray,
  entries: {
    type: "array",
    items: obj({
      date: { type: ["string", "null"] },
      description: str,
      lines: {
        type: "array",
        items: obj({
          account: str,
          accountType: { type: "string", enum: [...ACCOUNT_TYPES] },
          dr: { type: ["number", "null"] },
          cr: { type: ["number", "null"] },
        }),
      },
    }),
  },
  steps: {
    type: "array",
    items: obj({
      platform: { type: "string", enum: ["desktop", "cloud"] },
      text: str,
      menuPath: { type: ["string", "null"] },
      sourceIds: strArray,
    }),
  },
  customerMessage: str,
  needsAccountant: { type: ["string", "null"] },
  doubts: strArray,
});

export function parseAnswer(raw: string): { ok: true; answer: ModelAnswer } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "The answer wasn't valid JSON." };
  }
  const parsed = modelAnswerSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: `The answer didn't match the expected shape: ${parsed.error.issues[0]?.path.join(".") || "root"}` };
  return { ok: true, answer: parsed.data };
}

export interface CheckedStep extends ModelStep {
  status: "confirmed" | "unverified-source" | "not-confirmed";
}

export interface CheckedAnswer {
  answer: ModelAnswer;
  entryResults: { balanced: boolean; problem: string | null }[];
  steps: CheckedStep[];
  /** Ready to send, or null when questions come first or the reply failed a check. */
  customerReply: string | null;
  sources: Omit<Source, "text">[];
  flags: string[];
}
