import type { Metadata } from "next";
import { AnalystView } from "@/components/analyst/analyst-view";

export const metadata: Metadata = { title: "Accounting analyst" };

export default function AnalystPage() {
  return <AnalystView />;
}
