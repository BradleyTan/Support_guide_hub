import type { Metadata } from "next";
import { SopBuilder } from "@/components/sop/sop-builder";

export const metadata: Metadata = { title: "SOP builder" };

export default async function SopPage({ searchParams }: PageProps<"/sop">) {
  const { guide } = await searchParams;
  return <SopBuilder initialGuide={typeof guide === "string" ? guide : undefined} />;
}
