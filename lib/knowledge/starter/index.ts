import type { StarterArticle } from "@/lib/knowledge/model";
import { BANK } from "@/lib/knowledge/starter/bank";
import { BASICS } from "@/lib/knowledge/starter/basics";
import { CUSTOMERS } from "@/lib/knowledge/starter/customers";
import { PERIOD_END } from "@/lib/knowledge/starter/period-end";
import { REPORTS } from "@/lib/knowledge/starter/reports";
import { STOCK } from "@/lib/knowledge/starter/stock";
import { SUPPLIERS } from "@/lib/knowledge/starter/suppliers";
import { TAX } from "@/lib/knowledge/starter/tax";

/** All starter articles, in reading order. Each category lives in its own file. */
export const STARTER_ARTICLES: StarterArticle[] = [...BASICS, ...CUSTOMERS, ...SUPPLIERS, ...BANK, ...STOCK, ...REPORTS, ...TAX, ...PERIOD_END];
