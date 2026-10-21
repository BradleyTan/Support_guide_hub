import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/components/knowledge/article-form";
import { getArticle } from "@/lib/data";
import { relatedOptions } from "@/app/(app)/knowledge/related-options";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditArticlePage({ params }: PageProps<"/knowledge/[id]/edit">) {
  const article = await getArticle((await params).id);
  if (!article) notFound();
  return <ArticleForm article={article} relatedOptions={relatedOptions(article.starterSlug)} />;
}
