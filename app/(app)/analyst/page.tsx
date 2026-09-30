import type { Metadata } from "next";
import { AnalystView } from "@/components/analyst/analyst-view";
import { getAnalyses } from "@/lib/data";

export const metadata: Metadata = { title: "Accounting analyst" };

export default async function AnalystPage() {
  return <AnalystView analyses={await getAnalyses()} />;
}
