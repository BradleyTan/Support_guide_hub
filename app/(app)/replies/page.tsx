import type { Metadata } from "next";
import { ReplyGenerator } from "@/components/replies/reply-generator";
import { getAnalyses, getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Reply generator" };

export default async function RepliesPage({ searchParams }: PageProps<"/replies">) {
  const { guide, analysis } = await searchParams;
  const source = typeof analysis === "string" ? `analysis:${analysis}` : typeof guide === "string" ? `guide:${guide}` : undefined;
  const [guides, analyses] = await Promise.all([getGuides(), getAnalyses()]);
  return <ReplyGenerator guides={guides} analyses={analyses} initialSource={source} />;
}
