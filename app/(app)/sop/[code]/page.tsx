import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SopEditor } from "@/components/sop/sop-editor";
import { getSop } from "@/lib/data";

export async function generateMetadata({ params }: PageProps<"/sop/[code]">): Promise<Metadata> {
  return { title: (await params).code };
}

export default async function SopEditPage({ params }: PageProps<"/sop/[code]">) {
  const found = await getSop((await params).code);
  if (!found) notFound();
  const { sop, images } = found;
  return (
    <SopEditor
      code={sop.id}
      initial={{ guideCode: sop.guideCode, title: sop.title, version: sop.version, purpose: sop.purpose, scope: sop.scope, steps: sop.steps, checks: sop.checks }}
      images={images}
    />
  );
}
