import type { Metadata } from "next";
import { ReplyGenerator } from "@/components/replies/reply-generator";
import { getAnalyses, getGuides, getTemplates } from "@/lib/data";

export const metadata: Metadata = { title: "Reply generator" };

export default async function RepliesPage({ searchParams }: PageProps<"/replies">) {
  const { guide, analysis, template } = await searchParams;
  const source = typeof analysis === "string" ? `analysis:${analysis}` : typeof guide === "string" ? `guide:${guide}` : undefined;
  const [guides, analyses, templates] = await Promise.all([getGuides(), getAnalyses(), getTemplates()]);
  return <ReplyGenerator guides={guides} analyses={analyses} templates={templates} initialSource={source} initialTemplate={typeof template === "string" ? template : undefined} />;
}
