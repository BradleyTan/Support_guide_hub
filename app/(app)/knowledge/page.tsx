import type { Metadata } from "next";
import { KnowledgeList } from "@/components/knowledge/knowledge-list";
import { getArticles, getStarterSlugsInUse } from "@/lib/data";
import { missingStarters } from "@/lib/knowledge/model";
import { STARTER_ARTICLES } from "@/lib/knowledge/starter";

export const metadata: Metadata = { title: "Knowledge hub" };

export default async function KnowledgePage() {
  const [articles, slugs] = await Promise.all([getArticles(), getStarterSlugsInUse()]);
  const missing = missingStarters(STARTER_ARTICLES, slugs).map(({ slug, title, category }) => ({ slug, title, category }));
  return <KnowledgeList articles={articles} missing={missing} />;
}
