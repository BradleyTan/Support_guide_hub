import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuideDetail } from "@/components/guides/guide-detail";
import { getGuide, getGuides } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/guides/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getGuide(id))?.title ?? "Guide not found" };
}

export default async function GuidePage({ params }: PageProps<"/guides/[id]">) {
  const { id } = await params;
  const [guide, all] = await Promise.all([getGuide(id), getGuides()]);
  if (!guide) notFound();
  return <GuideDetail guide={guide} allGuides={all} />;
}
