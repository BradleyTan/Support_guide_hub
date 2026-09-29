import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideDetail } from "@/components/guides/guide-detail";
import { getGuide, guides } from "@/lib/mock/guides";

export function generateStaticParams() {
  return guides.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getGuide(id)?.title ?? "Guide not found" };
}

export default async function GuidePage({ params }: PageProps<"/guides/[id]">) {
  const { id } = await params;
  const guide = getGuide(id);
  if (!guide) notFound();
  return <GuideDetail guide={guide} />;
}
