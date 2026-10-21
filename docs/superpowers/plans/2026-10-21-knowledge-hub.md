# Knowledge hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private, editable library of ~38 plain-English accounting articles, each opening with a copyable "Tell the customer" explanation, findable from its own page, Search and the Ctrl K palette.

**Architecture:** Starter content lives as typed data in `lib/knowledge/starter/` (reviewable in git). A new RLS table `knowledge_articles` holds the user's copies (added only when they tick them) and their own articles. Server actions validate with Zod; a security-invoker SQL function searches articles by words and similar spelling.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before writing route code), React 19, TypeScript, Tailwind v4, shadcn/ui on Base UI (`ButtonLink` for links), Zod 4, Supabase (Postgres + RLS, pg_trgm), Vitest, Playwright (`e2e/fixtures.ts` — import `test`/`expect` from there).

**Spec:** `docs/superpowers/specs/2026-10-21-knowledge-hub-design.md`

## Global Constraints

- Private to one user: every row has `user_id uuid not null default auth.uid()`, RLS `user_id = (select auth.uid())`, soft delete via `deleted_at`.
- No AI at run time; nothing sent to an AI service. Free services only.
- Every AutoCount menu path is shown with **Needs verification** until the user confirms it. Desktop and Cloud paths are separate; a Cloud path is never shown as the Desktop path. A missing path shows exactly: `Not found in a source yet — add it once checked`.
- Sources: honour robots.txt; never use the help centres' `/support/search`; do not work around the wiki's 403. Write in our own words; link, don't copy. Tax facts carry an "as of" date.
- Starter articles are added only for the slugs the user ticks; never overwrite user edits.
- Approval gates (stop and ask the user, then continue): applying the migration (Task 2), redeploying `purge-bin` (Task 9). Pushing to GitHub is the user's step.
- English only; accounting topics only (no Payroll).
- Every task: `npx tsc --noEmit`, `npx eslint .` clean; never run Prettier; commit messages via `git commit -F <file>` ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A starter article the user deleted (in the bin, or already purged) must not come back unless the user ticks it in Add starter articles — Task 3 test `missingStarters excludes binned slugs`, Task 7 e2e.
2. An edited starter article must never be offered "Newer version available" — Task 3 test `hasNewerVersion is false once edited`.
3. A missing Desktop or Cloud path renders the fixed "Not found…" line, not an empty box — Task 6 e2e.
4. Long titles/explanations and phone width (390px) cause no sideways scrolling — smoke route `/knowledge` + Task 6 e2e on phone.
5. Odd search input (`'`, `%`, empty, 1 character) returns no error and no crash — Task 2 SQL test, Task 8 e2e.

---

### Task 1: Article model and pure helpers

**Files:**
- Create: `lib/knowledge/model.ts`
- Test: `tests/knowledge-model.test.ts`

**Interfaces:**
- Produces:
  - `KNOWLEDGE_CATEGORIES = ["Basics", "Customers (AR)", "Suppliers (AP)", "Bank & cash", "Stock", "Reports", "Tax", "Period-end"] as const`; `type KnowledgeCategory`.
  - `type Source = { label: string; url: string }`.
  - `interface StarterArticle { slug: string; version: number; title: string; category: KnowledgeCategory; tellCustomer: string; whatItIs: string; example: string; desktopSteps: string | null; cloudSteps: string | null; mistakes: string[]; related: string[]; sources: Source[] }`.
  - `interface KnowledgeArticle extends Omit<StarterArticle, "slug" | "version"> { id: string; starterSlug: string | null; starterVersion: number | null; edited: boolean; reviewed: boolean; stepsVerified: boolean; updatedAt: string; deletedAt?: string }`.
  - `articleInputSchema` (Zod): title 1–200, category enum, tellCustomer 1–1000, whatItIs ≤4000, example ≤4000, desktopSteps/cloudSteps string ≤2000 or null (empty string → null), mistakes ≤20 items ≤500, related ≤10 slugs, sources ≤10 `{label 1–200, url https only}`. `type ArticleInput`.
  - `missingStarters(all: StarterArticle[], existingSlugs: string[]): StarterArticle[]` — `existingSlugs` includes binned rows.
  - `hasNewerVersion(a: Pick<KnowledgeArticle, "starterSlug" | "starterVersion" | "edited">, starters: StarterArticle[]): boolean`.
  - `NOT_FOUND_STEPS = "Not found in a source yet — add it once checked"`.

- [ ] **Step 1: Write failing tests** in `tests/knowledge-model.test.ts`:
  - `missingStarters excludes binned slugs`: starters a,b,c; existing ["a","c"] → returns only b.
  - `hasNewerVersion` true when starterVersion 1 < starter version 2 and edited false; false when edited true; false for own articles (starterSlug null); false when versions equal.
  - `articleInputSchema` rejects `http://` source URLs, empty title, unknown category; turns `desktopSteps: ""` into `null`.
- [ ] **Step 2:** `npx vitest run tests/knowledge-model.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `lib/knowledge/model.ts` with the interfaces above (pure, no DB/browser).
- [ ] **Step 4:** Tests PASS.
- [ ] **Step 5:** Commit `Knowledge hub: article model and helpers`.

### Task 2: Database table and search function (approval gate)

**Files:**
- Create: `supabase/migrations/0011_knowledge_articles.sql`, `supabase/tests/knowledge.sql`
- Modify: `lib/supabase/database.types.ts` (add table + function, hand-written like the others)

**Interfaces:**
- Produces: table `public.knowledge_articles` (`id uuid pk`, `user_id`, `starter_slug text null`, `starter_version int null`, `edited bool default false`, `title`, `category` (check = the 8 categories), `tell_customer`, `what_it_is default ''`, `example default ''`, `desktop_steps text null`, `cloud_steps text null`, `steps_verified bool default false`, `mistakes text[] default '{}'`, `related text[] default '{}'`, `sources jsonb default '[]'` (check array), `reviewed bool default false`, `fts tsvector` (trigger: title A, tell_customer + what_it_is B, mistakes/example C), `created_at`, `updated_at` (trigger like guides: ignores `fts`), `deleted_at`); unique index `(user_id, starter_slug) where starter_slug is not null`; RLS select/insert/update/delete for owner.
- Produces: `public.search_knowledge(p_query text, p_limit int default 10) returns table (id uuid, score real, matched_by text[])` — security invoker, `deleted_at is null`, words (`websearch_to_tsquery` english+simple) + fuzzy (`word_similarity(p_query, title) >= 0.35`, query ≥3 chars) merged by RRF (k=60), like `search_guides` in `0003`. Grant to authenticated only.

- [ ] **Step 1:** Write the migration and `supabase/tests/knowledge.sql` (rolled-back transaction, two fake users like `supabase/tests/sops.sql`): A inserts 2 articles; B sees 0 rows, can't update/delete A's, can't insert with A's user_id; duplicate `starter_slug` for A raises unique_violation; `search_knowledge('aging')` finds A's "Debtor aging" for A and nothing for B; `search_knowledge('''')`, `('%')`, `('')`, `('a')` return without error; anon has no access. Ends `select 'knowledge: all checks passed'`.
- [ ] **Step 2: STOP — ask the user to approve applying migration 0011.** Only after "yes": apply with the Supabase MCP `apply_migration` (project `wslezaavnujedvydjkae`).
- [ ] **Step 3:** Run `supabase/tests/knowledge.sql` via `execute_sql` → `knowledge: all checks passed`; `get_advisors security` → only the known leaked-password item.
- [ ] **Step 4:** Update `database.types.ts`; `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `Knowledge hub: table and search (migration 0011)`.

### Task 3: Data reads and server actions

**Files:**
- Create: `app/(app)/knowledge/actions.ts`
- Modify: `lib/data.ts`
- Test: extend `tests/knowledge-model.test.ts` with row mapping (`rowToArticle`, `starterToRow` live in `lib/knowledge/model.ts`)

**Interfaces:**
- Consumes: Task 1 types/schema; Task 2 table.
- Produces (lib/data.ts, `cache()`-wrapped like `getSops`): `getArticles(): Promise<KnowledgeArticle[]>` (not deleted, ordered category then title), `getArticle(id: string): Promise<KnowledgeArticle | null>`, `getDeletedArticles(): Promise<KnowledgeArticle[]>`, `getStarterSlugsInUse(): Promise<string[]>` (includes binned).
- Produces (actions, all `{ ok: true; data } | { ok: false; error; fieldErrors? }`, session check, revalidate `/knowledge` and `/` layout): `addStarterArticles(slugs: string[])` → `{ added: number }` (ignores unknown slugs and slugs already in use); `createArticle(input)` → `{ id }`; `updateArticle(id, input)` (sets `edited = true` when `starter_slug` not null); `setArticleReviewed(id, reviewed: boolean)`; `setStepsVerified(id, verified: boolean)`; `deleteArticle(id)`; `restoreArticle(id)`; `updateFromStarter(id)` (only when `hasNewerVersion`; replaces content, sets `starter_version`, keeps `reviewed=false`).
- Produces (model.ts): `starterToRow(s: StarterArticle): TablesInsert<"knowledge_articles">`, `rowToArticle(r): KnowledgeArticle`.

- [ ] **Step 1:** Failing tests: `starterToRow` copies every content field and sets `starter_slug`, `starter_version`, `edited false`, `reviewed false`; `rowToArticle(starterToRow(s))`-shaped row round-trips content.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement mapping, data reads and actions.
- [ ] **Step 4:** Unit tests PASS; tsc + lint clean.
- [ ] **Step 5:** Commit `Knowledge hub: data reads and actions`.

### Task 4: Starter content — Basics, Customers (AR), Suppliers (AP)

**Files:**
- Create: `lib/knowledge/starter/basics.ts`, `customers.ts`, `suppliers.ts`, `lib/knowledge/starter/index.ts` (`STARTER_ARTICLES: StarterArticle[]` = all category files)
- Test: `tests/knowledge-starter.test.ts`

**Interfaces:**
- Consumes: `StarterArticle`. Produces: `STARTER_ARTICLES`.

Topics: debit & credit, chart of accounts, journal entry, financial year & periods, opening balance, year-end closing; invoice vs cash sale, credit & debit notes, receiving payment & knock-off, AR deposit, contra, debtor statement, debtor aging; purchase invoice, supplier payment, supplier deposit, creditor aging.

- [ ] **Step 1: Write the content test** (runs over all of `STARTER_ARTICLES`, so later content tasks are covered too): unique slugs (kebab-case); `version >= 1`; `tellCustomer` 1–3 sentences and ≤ 400 chars; no field empty except steps (null allowed); every `related` slug exists; ≥1 source, all `https://`, none containing `/support/search`; `desktopSteps !== cloudSteps` when both set; any article in category "Tax" mentions "as of"; every slug listed in the spec's topic list for the categories present.
- [ ] **Step 2:** Research each topic: AutoCount Cloud help-centre article pages (Firecrawl scrape of allowed article URLs or WebFetch), AutoCount site, reputable accounting sources. Record the source URLs used.
- [ ] **Step 3:** Write the 17 articles in plain English (Malaysian context, RM examples). Menu paths only from a source; otherwise `null`.
- [ ] **Step 4:** `npx vitest run tests/knowledge-starter.test.ts` → PASS.
- [ ] **Step 5:** Commit `Knowledge hub: starter articles (basics, AR, AP)`.

### Task 5: Starter content — Bank & cash, Stock, Reports, Tax, Period-end

**Files:** Create `lib/knowledge/starter/bank.ts`, `stock.ts`, `reports.ts`, `tax.ts`, `period-end.ts`; add them to `index.ts`.

Topics: bank reconciliation, petty cash, post-dated cheques; costing methods (FIFO, weighted average), stock take & adjustment, stock valuation; trial balance, profit & loss, balance sheet, general ledger, cash flow statement; SST (sales tax vs service tax), e-Invoice & TIN, withholding tax; accruals & prepayments, depreciation, bad debts, foreign currency gain/loss, locking past periods.

- [ ] **Step 1:** Research as in Task 4 (tax facts from LHDN / Royal Malaysian Customs pages, with "as of" dates).
- [ ] **Step 2:** Write the 21 articles.
- [ ] **Step 3:** `npx vitest run tests/knowledge-starter.test.ts` → PASS (38 articles total; add assertion `STARTER_ARTICLES.length >= 36`).
- [ ] **Step 4:** Commit `Knowledge hub: starter articles (bank, stock, reports, tax, period-end)`.

### Task 6: Knowledge hub pages

**Files:**
- Create: `app/(app)/knowledge/page.tsx`, `app/(app)/knowledge/[id]/page.tsx`, `app/(app)/knowledge/[id]/edit/page.tsx`, `app/(app)/knowledge/new/page.tsx`, `components/knowledge/knowledge-list.tsx`, `components/knowledge/article-view.tsx`, `components/knowledge/article-form.tsx`, `components/knowledge/add-starters-dialog.tsx`
- Modify: `components/shell/nav.ts` (item `{ href: "/knowledge", label: "Knowledge hub", short: "Knowledge", icon: GraduationCap, notOnPhoneTabs: true }` after Insights), `e2e/smoke.spec.ts` (route `["/knowledge", /Knowledge hub/]`)
- Test: `e2e/knowledge.spec.ts`

**Interfaces:** Consumes Tasks 1–5.

Layout rules:
- **List:** `PageHeader` with "How this works", grouped by category, filter box, Reviewed / Not reviewed badges.
- **Empty state:** an **Add starter articles** button. The same button also sits in the header whenever `missingStarters(...)` is not empty.
- **Article page:** the "Tell the customer" block comes first, with a **Copy** button. Then What it is, Example, In AutoCount (Desktop and Cloud parts, each showing **Needs verification** until `stepsVerified`, or `NOT_FOUND_STEPS` when null), Common mistakes, Related (links), Sources (external links).
- **Actions:** Reviewed toggle, Steps verified toggle, Edit, Delete (bin), and a **Newer version available — Update** note when `hasNewerVersion`.
- **Add starters dialog:** checkboxes grouped by category, all ticked by default, with select all/none.

- [ ] **Step 1: Write e2e tests** (read-only unless gated):
  - read-only: `/knowledge` renders its heading;
  - read-only: on phone there is no sideways scroll;
  - writes, gated by `allowWrites`, desktop only, cleanup deletes `knowledge_articles` with `starter_slug in (...)` or title `[e2e]%` in `afterAll`:
    - add two starters via the dialog → article page shows "Tell the customer" first, Copy works (toast), Desktop part shows `Not found in a source yet — add it once checked` for an article whose `desktopSteps` is null;
    - delete one → Add starter articles no longer offers it while in the bin.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement pages and components.
- [ ] **Step 4:** `npx playwright test e2e/knowledge.spec.ts e2e/smoke.spec.ts` (read-only) PASS; screenshot desktop + phone for visual check.
- [ ] **Step 5:** Commit `Knowledge hub: pages`.

### Task 7: Bin, export and palette

**Files:**
- Modify: `components/settings/settings-view.tsx` + `app/(app)/settings/page.tsx` (Deleted articles list with Restore, like DeletedGuides), `lib/export.ts` (`knowledgeSheet(a: KnowledgeArticle[]): Sheet`, sheet name `"Knowledge hub"`), `app/(app)/settings/actions.ts` (append sheet), `app/(app)/layout.tsx` + `components/shell/app-shell.tsx` + `components/shell/command-palette.tsx` (palette group "Knowledge hub" listing article titles → `/knowledge/<id>`)
- Test: `tests/export.test.ts` (knowledgeSheet header + row), `e2e/export.spec.ts` (sheet names now `["Guides", "Analyses", "SOPs", "Templates", "Knowledge hub"]`)

- [ ] **Step 1:** Failing tests (unit + export e2e expectation).
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Tests PASS; palette opens with articles (local check script or e2e).
- [ ] **Step 4:** Commit `Knowledge hub: bin, export, palette`.

### Task 8: Search integration

**Files:**
- Modify: `app/(app)/search/actions.ts` (`searchKnowledge(query: string): Promise<{ ok: true; hits: Pick<KnowledgeArticle, "id" | "title" | "category" | "tellCustomer">[] } | { ok: false; error: string }>` calling `search_knowledge`), `app/(app)/search/page.tsx` (initial results), `components/search/search-view.tsx` (a "Knowledge hub" section above "Your guides"; hidden when empty, with no extra empty state)
- Test: `e2e/search.spec.ts` (read-only: searching `'%` shows no error alert inside main)

- [ ] **Step 1:** Failing e2e (`'%` search shows no error) and, gated by writes, Task 6's flow extended: after adding "debtor-aging", searching "aging" shows it under Knowledge hub.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Tests PASS.
- [ ] **Step 4:** Commit `Knowledge hub: search`.

### Task 9: Bin clean-up and docs (approval gate)

**Files:**
- Modify: `supabase/functions/purge-bin/index.ts` (add `"knowledge_articles"` to the table list), `README.md` (Knowledge hub section; migrations list `0011`), `docs/GO-LIVE.md` (none needed unless steps change)

- [ ] **Step 1: STOP — ask the user to approve redeploying `purge-bin`.** After "yes": deploy with `deploy_edge_function` (`verify_jwt: false`, same as now), then trigger one run via `net.http_post` as in migration 0009 and confirm status 200 with `knowledge_articles: 0`.
- [ ] **Step 2:** README update.
- [ ] **Step 3:** Full regression: `npx eslint .`, `npx tsc --noEmit`, `npx vitest run`, `npx playwright test` (read-only) all pass; signed-out live check after the user pushes.
- [ ] **Step 4:** Commit `Knowledge hub: bin clean-up and docs`. Report to the user with results, and the write-test command for them to run (`set E2E_ALLOW_WRITES=1` then `npx playwright test e2e/knowledge.spec.ts`).
