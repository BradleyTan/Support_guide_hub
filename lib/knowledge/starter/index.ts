import type { StarterArticle } from "@/lib/knowledge/model";
import { BASICS } from "@/lib/knowledge/starter/basics";
import { CUSTOMERS } from "@/lib/knowledge/starter/customers";
import { SUPPLIERS } from "@/lib/knowledge/starter/suppliers";

/** All starter articles, in reading order. Each category lives in its own file. */
export const STARTER_ARTICLES: StarterArticle[] = [...BASICS, ...CUSTOMERS, ...SUPPLIERS];
