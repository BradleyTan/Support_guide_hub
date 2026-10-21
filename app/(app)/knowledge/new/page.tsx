import type { Metadata } from "next";
import { ArticleForm } from "@/components/knowledge/article-form";
import { relatedOptions } from "@/app/(app)/knowledge/related-options";

export const metadata: Metadata = { title: "New article" };

export default function NewArticlePage() {
  return <ArticleForm relatedOptions={relatedOptions(null)} />;
}
