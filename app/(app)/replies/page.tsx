import type { Metadata } from "next";
import { ReplyGenerator } from "@/components/replies/reply-generator";

export const metadata: Metadata = { title: "Reply generator" };

export default async function RepliesPage({ searchParams }: PageProps<"/replies">) {
  const { guide, analysis } = await searchParams;
  const source = typeof analysis === "string" ? `analysis:${analysis}` : typeof guide === "string" ? `guide:${guide}` : undefined;
  return <ReplyGenerator initialSource={source} />;
}
