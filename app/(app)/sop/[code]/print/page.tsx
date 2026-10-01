import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SopDocument } from "@/components/sop/sop-document";
import { getSop } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/sop/[code]/print">): Promise<Metadata> {
  const found = await getSop((await params).code);
  // The browser suggests the page title as the PDF file name.
  return { title: { absolute: found ? `${found.sop.id} ${found.sop.title}` : "SOP" } };
}

export default async function SopPrintPage({ params }: PageProps<"/sop/[code]/print">) {
  const found = await getSop((await params).code);
  if (!found) notFound();
  return <SopDocument sop={found.sop} images={found.images} />;
}
