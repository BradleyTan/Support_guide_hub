import type { Metadata } from "next";
import { TemplatesView } from "@/components/library/templates-view";
import { getTemplates } from "@/lib/data";

export const metadata: Metadata = { title: "Templates & snippets" };

export default async function TemplatesPage() {
  return <TemplatesView templates={await getTemplates()} />;
}
