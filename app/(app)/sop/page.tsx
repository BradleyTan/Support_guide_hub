import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SopList } from "@/components/sop/sop-list";
import { getGuides, getSops } from "@/lib/data";

export const metadata: Metadata = { title: "SOP builder" };

export default async function SopPage({ searchParams }: PageProps<"/sop">) {
  const { guide } = await searchParams;
  // Older links (/sop?guide=G-1001) start a new SOP from that guide.
  if (typeof guide === "string") redirect(`/sop/new?guide=${encodeURIComponent(guide)}`);
  const [sops, guides] = await Promise.all([getSops(), getGuides()]);
  return <SopList sops={sops} guides={guides} />;
}
