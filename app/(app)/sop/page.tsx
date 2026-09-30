import type { Metadata } from "next";
import { SopBuilder } from "@/components/sop/sop-builder";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "SOP builder" };

export default async function SopPage({ searchParams }: PageProps<"/sop">) {
  const { guide } = await searchParams;
  return <SopBuilder guides={await getGuides()} initialGuide={typeof guide === "string" ? guide : undefined} />;
}
