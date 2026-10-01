import { z } from "zod";

/** The 7-section structured answer stored in analyses.result. Also used to validate AI output in Phase 4. */
export const analysisResultSchema = z.object({
  understanding: z.array(z.string()),
  assumptions: z.array(z.string()),
  treatment: z.object({ standard: z.string(), points: z.array(z.string()) }),
  entries: z.array(
    z.object({
      date: z.string(),
      description: z.string(),
      lines: z.array(z.object({ account: z.string(), dr: z.number().nonnegative().optional(), cr: z.number().nonnegative().optional() })).min(2),
    }),
  ),
  steps: z.array(z.object({ document: z.string(), menuPath: z.string(), verified: z.boolean(), fields: z.array(z.string()) })),
  tax: z.array(z.string()),
  mistakes: z.array(z.string()),
  verifyReports: z.array(z.string()),
  needsVerification: z.array(z.string()),
  judgementNote: z.string().optional(),
  sources: z.array(z.object({ label: z.string(), kind: z.enum(["my-guide", "official", "general"]), ref: z.string() })),
  /** Set when the result came from the scenario calculator, so it can be reopened with the same inputs. */
  calculator: z.object({ scenarioId: z.string(), inputs: z.record(z.string(), z.union([z.string(), z.number()])) }).optional(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
