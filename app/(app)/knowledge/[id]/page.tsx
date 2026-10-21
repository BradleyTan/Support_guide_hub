import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView, type RelatedLink } from "@/components/knowledge/article-view";
import { getArticle, getArticles } from "@/lib/data";
import { hasNewerVersion } from "@/lib/knowledge/model";
import { STARTER_ARTICLES } from "@/lib/knowledge/starter";

export async function generateMetadata({ params }: PageProps<"/knowledge/[id]">): Promise<Metadata> {
  const article = await getArticle((await params).id);
  return { title: article?.title ?? "Knowledge hub" };
}

export default async function ArticlePage({ params }: PageProps<"/knowledge/[id]">) {
  const { id } = await params;
  const [article, all] = await Promise.all([getArticle(id), getArticles()]);
  if (!article) notFound();
  // Related topics link to your copy when you have it; otherwise they show the starter title as "not added yet".
  const related: RelatedLink[] = article.related.flatMap((slug): RelatedLink[] => {
    const mine = all.find((a) => a.starterSlug === slug);
    if (mine) return [{ title: mine.title, id: mine.id }];
    const starter = STARTER_ARTICLES.find((s) => s.slug === slug);
    return starter ? [{ title: starter.title, id: null }] : [];
  });
  return <ArticleView article={article} related={related} newerAvailable={hasNewerVersion(article, STARTER_ARTICLES)} />;
}
