import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SopEditor } from "@/components/sop/sop-editor";
import { getGuide, getGuideImages } from "@/lib/data";
import { sopFromGuide } from "@/lib/sop";

export const metadata: Metadata = { title: "New SOP" };

export default async function NewSopPage({ searchParams }: PageProps<"/sop/new">) {
  const { guide: code } = await searchParams;
  const guide = typeof code === "string" ? await getGuide(code) : null;
  if (!guide) notFound();
  return <SopEditor initial={sopFromGuide(guide)} images={await getGuideImages(guide.id)} />;
}
