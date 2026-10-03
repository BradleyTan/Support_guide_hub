/**
 * Domain types for the AutoCount Support Desk (a guidelines tool; tickets live in Zoho Desk).
 * These are the contract for the Phase 1 database schema (one table per top-level type).
 */

export const PRODUCTS = [
  "AutoCount Accounting",
  "AutoCount Payroll",
  "AutoCount POS",
  "AutoCount Account Book",
] as const;
export type Product = (typeof PRODUCTS)[number];

export const CATEGORIES = [
  "Installation & Database",
  "Bank & Cash",
  "Tax (SST / e-Invoice)",
  "Payroll Statutory",
  "Stock & Costing",
  "Sync & Integration",
  "Printing & Reports",
  "Year-end & Periods",
  "Multi-currency",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "pdf" | "sql";
  sizeKb: number;
}

export interface Revision {
  at: string; // ISO datetime
  summary: string;
}

/** A reusable troubleshooting or how-to guideline. */
export interface Guide {
  id: string; // e.g. "G-1051"
  dbId?: string; // database uuid (used for attachment storage paths)
  deletedAt?: string;
  title: string;
  product: Product;
  version: string; // versions it applies to, e.g. "2.1, 2.2"
  module: string;
  category: Category | null;
  symptom: string;
  errorMessage?: string;
  cause?: string;
  steps: string[];
  prevention?: string;
  tags: string[];
  /** true once you've confirmed the fix works; false = still needs verification. */
  verified: boolean;
  uses: number; // times opened or used in a reply
  attachments: Attachment[];
  pins?: Pin[];
  createdAt: string;
  updatedAt: string;
  revisions: Revision[];
}

/** An official AutoCount page saved to a guide from Search. */
export interface Pin {
  id: string;
  title: string;
  url: string;
  site: string;
}

export type Confidence = "High" | "Medium" | "Low";

export interface JournalLine {
  account: string;
  dr?: number;
  cr?: number;
}

export interface JournalEntry {
  date: string;
  description: string;
  lines: JournalLine[];
}

export interface AutoCountStep {
  document: string;
  menuPath: string;
  verified: boolean; // false => show "Needs verification"
  fields: string[];
}

export interface AnalysisSource {
  label: string;
  kind: "my-guide" | "official" | "general";
  ref: string; // guide id or URL
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  images?: string[];
}

export interface Analysis {
  id: string;
  title: string;
  scenario: string;
  createdAt: string;
  understanding: string[];
  assumptions: string[];
  treatment: { standard: string; points: string[] };
  entries: JournalEntry[];
  steps: AutoCountStep[];
  tax: string[];
  mistakes: string[];
  verifyReports: string[];
  confidence: Confidence;
  needsVerification: string[];
  judgementNote?: string;
  sources: AnalysisSource[];
  chat: ChatMessage[];
  /** Present when made with the scenario calculator: lets it reopen with the same inputs. */
  calculator?: { scenarioId: string; inputs: Record<string, string | number> };
}

export interface OfficialResult {
  title: string;
  url: string;
  snippet: string;
  site: string;
  cachedAt: string;
}

export type TemplateKind = "Reply" | "SQL" | "Checklist";

export interface Template {
  id: string;
  kind: TemplateKind;
  title: string;
  body: string;
  tags: string[];
  uses: number;
}
