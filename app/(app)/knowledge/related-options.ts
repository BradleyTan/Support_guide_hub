import { STARTER_ARTICLES } from "@/lib/knowledge/starter";

/** Topics an article can link to: every starter topic except the article itself. */
export function relatedOptions(ownSlug: string | null) {
  return STARTER_ARTICLES.filter((s) => s.slug !== ownSlug).map(({ slug, title }) => ({ slug, title }));
}
