import type { Metadata } from "next";
import { GuideList } from "@/components/guides/guide-list";
import { getGuides } from "@/lib/data";

export const metadata: Metadata = { title: "Guide library" };

export default async function GuidesPage({ searchParams }: PageProps<"/guides">) {
  const { product, module, status } = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return (
    <GuideList
      guides={await getGuides()}
      initialProduct={str(product)}
      initialModule={str(module)}
      initialVerified={status === "unverified" ? "no" : status === "verified" ? "yes" : undefined}
    />
  );
}
