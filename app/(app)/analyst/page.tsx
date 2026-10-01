import type { Metadata } from "next";
import { AnalystView } from "@/components/analyst/analyst-view";
import { getAnalyses } from "@/lib/data";
import { getScenario, SCENARIOS } from "@/lib/scenarios";

export const metadata: Metadata = { title: "Accounting analyst" };

export default async function AnalystPage({ searchParams }: PageProps<"/analyst">) {
  const { scenario, analysis, manual } = await searchParams;
  const analyses = await getAnalyses();
  const initial =
    typeof analysis === "string" && analyses.some((a) => a.id === analysis)
      ? ({ kind: "history", code: analysis } as const)
      : manual
        ? ({ kind: "manual" } as const)
        : ({ kind: "scenario", id: typeof scenario === "string" && getScenario(scenario) ? scenario : SCENARIOS[0].id } as const);
  return <AnalystView analyses={analyses} initial={initial} />;
}
