# Support Desk for AutoCount

A personal guidelines tool for an AutoCount support consultant: a searchable library of your own fixes and how-tos, search across your guides and AutoCount's official help centres, plus reply and SOP helpers. Tickets stay in Zoho Desk.

Everything runs on free tiers and open-source libraries: no paid services, and nothing to run on your PC. AI features are **off** by choice; nothing is sent to an AI service.

> **Status: Phase 6 (writing tools).** Login, guide library, search, the scenario calculator, Insights, replies, SOPs, templates and version notes are live. Exports, hosting and deployment come in Phase 7.

## Replies, SOPs, templates and version notes (no AI)

- **Reply generator:** choose a guide or analysis, a reply template (or the standard reply), the client’s name and the channel (Zoho Desk email or WhatsApp). Placeholders such as `{contact}`, `{title}`, `{cause}`, `{steps}`, `{prevention}`, and for analyses `{entries}` and `{treatment}`, are filled in; a line whose placeholders have nothing to fill is left out. WhatsApp puts headings in *bold*. Edit the draft, then copy it. English only. AutoCount menu paths from analyses are never put in a reply, because they aren’t confirmed.
- **Templates & snippets:** create, edit, delete and copy Reply, SQL and Checklist templates. “Used n×” counts copies and replies.
- **SOP builder:** start from a guide (its steps, product, version and module), edit, reorder, add a screenshot from the guide under any step and list end checks. Saved as SOP-1, SOP-2 … (table `sops`). **Print / Save as PDF** opens a clean page for the browser’s Save as PDF; screenshot links last 10 minutes.
- **Versions & releases:** your own notes (known issue, fix, note) per product and version, linked to guides; linked notes show on the guide page.

## Importing guides

**Guide library → Import** accepts Excel/CSV (a heading row; you match the columns), and **PDF or .txt notes** written like this, several per file:

```
Issue: AutoCount Accounting - e-Invoice status Invalid, Buyer TIN is invalid
Solution: Check the TIN with the Search TIN function. …
```

- `Issue:` starts each guide (at the start of a line). The part before the first ` - ` is the product if it names one (Accounting, Payroll, POS, Account Book); the rest is the title (over 200 characters: shortened, full text kept as the symptom).
- `Solution:` becomes the fix steps: one per line, and `1. … 2. …` on one line is split too.
- Notes with no product or no solution are flagged in the review and skipped, never guessed. Every guide is checked for duplicates and imported as unverified.
- Files are read in the browser. PDFs are read with [unpdf](https://github.com/unjs/unpdf) (MIT); scanned PDFs (pictures of pages) have no text and are rejected with a message.

## Insights

- **Insights** (sidebar; under **More** on a phone) shows the last 12 weeks: guides opened, searches, searches that found none of your guides, guides added and edited, as a weekly chart with a table view.
- **Search gaps:** things you searched for at least twice where the latest search matched none of your guides, with **Write a guide** (title prefilled) or a note when a guide written since then may cover it. Home shows the top three.
- **Library health:** guides per product and verified share; guides not verified, missing a cause or fix steps, not edited for over a year, or not opened in 90 days.
- **What is logged:** opening a guide, and searches made without filters (repeats within 30 minutes count once). Both logs are private to you (RLS) and deleted after 90 days by the nightly `activity-log-cleanup` job. **Settings → Privacy → Clear search history** deletes your searches at once.
- Opening a guide no longer changes its “last updated” date; only content edits do.

## Accounting analyst (free, no AI)

- 26 worked scenarios in `lib/scenarios/` (deposits, SST invoices, partial and foreign-currency payments, revaluation, credit notes, contra, stock, accruals, prepayments, depreciation, bad debts, impairment, payroll, bank items, withholding tax, cash rounding) plus **Build your own entry**.
- All arithmetic is in sen (integers), and every entry is checked so total Dr equals total Cr, both in the browser and again on the server when saving.
- AutoCount menu paths are always shown as **Needs verification**; tax points that depend on judgement are listed under “Needs verification” too.
- Results can be saved to History, turned into a guide, printed / saved as PDF (browser print), or copied as a prompt to paste into your own Claude app (**Copy for Claude**, nothing is sent automatically).
- **Expected results for approval:** `docs/accounting-scenarios.md` lists the entries every scenario produces with its example figures. The unit tests lock these figures; if a calculation changes, the tests fail until the document is deliberately regenerated with `npx vitest run -u`.

## Set up

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key (Supabase → Project settings → API).
3. In Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3001` (later: your live address)
   - **Redirect URLs:** add `http://localhost:3001/**` (later also the live address)
4. `npm run dev` and open http://localhost:3001. Create your account, confirm the email, sign in.
5. On the empty Home screen, **Load sample data** adds 10 sample guides, analyses, templates and version notes to your account (optional).

Keyboard: `Ctrl K` command palette · `/` search · `N` new guide.

Before relying on the app for real work, go through [docs/GO-LIVE.md](docs/GO-LIVE.md), which starts with setting up custom SMTP so sign-up and password-reset emails aren't blocked by Supabase's free email allowance.

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Public; Row Level Security protects the data |
| `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_ALLOW_WRITES` | tests only | A dedicated test account (see Checks) |

No secret key is used by the app. Every database call runs as the signed-in user.

## How search works

- **Your guides:** one database function (`search_guides`) merges three kinds of match: same words (Postgres full-text), similar spelling (trigram) and similar meaning (vectors). Filters: product, module, version, tag, last updated.
- **Meaning vectors** come from Supabase's built-in `gte-small` model through the `embed` Edge Function, so guide text never leaves your Supabase project. They're made when a guide is saved or imported, and missing ones are filled in during searches.
- **Official sources:** the AutoCount Cloud Accounting and HRMS help centres are indexed from their **published sitemaps** (allowed by their robots.txt; their `/support/search` pages are disallowed and never used). The `refresh-official` Edge Function reads the sitemaps daily (Supabase `pg_cron` job `official-pages-sync`, 03:00 Malaysia time) and reads a few new/changed article pages every 2 minutes (`official-pages-details`) for titles, summaries and vectors. The AutoCount website and wiki are offered as Google searches limited to those sites.
- Official articles can be **pinned** to a guide from Search and appear on the guide page.

## Database

- Migrations in `supabase/migrations/` (0001 schema and RLS; 0002 duplicate finder and view counter; 0003 guide search; 0004–0005 official index and schedule; 0006–0007 activity log and insights; 0008 saved SOPs). Every user table has `user_id`, created/updated timestamps and soft delete (`deleted_at`); Row Level Security restricts each user to their own rows. `official_pages` is shared public information: signed-in users can read it; only the refresh function writes.
- Edge Functions in `supabase/functions/` (`embed`, `refresh-official`).
- Files go to the private `attachments` storage bucket under `<user_id>/…`, max 10 MB.
- Security checks: run the scripts in `supabase/tests/` in the Supabase SQL editor. Each uses a transaction, rolls back, and reports "all checks passed".
- Types: `lib/supabase/database.types.ts` follows the schema; update it after each migration.

### Backups

Free Supabase projects get daily backups kept for a limited time, and free projects pause after about a week without use (resume them from the dashboard). For your own copy, **Settings → Export everything** (coming in Phase 7) downloads all guides to Excel. For a full database dump: `npx supabase db dump --db-url "<connection string>" -f backup.sql`, using the connection string from Supabase → Project settings → Database.

## Checks

```bash
npm test          # lint + type-check + unit tests + browser tests
npm run test:unit # unit tests only (Vitest)
npm run build     # production build
```

Browser tests run against a production build on port 3100. Signed-in tests need `E2E_EMAIL` and `E2E_PASSWORD` for a **dedicated test account** (read from `.env.local`); they sign in once per run and reuse the session. Tests that create, edit and delete guides (`e2e/guides.spec.ts`) also need `E2E_ALLOW_WRITES=1`; they only touch guides titled `[e2e] …` and remove them afterwards. Traces and screenshots are off because they would record what's typed, including the test password. To run only the signed-out tests, set `E2E_SIGNED_IN=0`. CI (`.github/workflows/ci.yml`) runs `npm test` on every push.

## Structure

| Path | What |
|---|---|
| `app/login`, `app/auth`, `app/reset-password` | Sign in / create account, email links, password reset |
| `app/(app)/` | One folder per screen; `actions.ts` files hold server actions |
| `proxy.ts`, `lib/supabase/` | Session refresh and login redirect, Supabase clients, types |
| `lib/data.ts` | Server-side reads (run as the signed-in user) |
| `lib/embeddings.ts`, `lib/official-sites.ts`, `lib/import.ts`, `lib/import-notes.ts` | Search vectors, official-site rules, Excel/CSV import logic, PDF/.txt notes parser |
| `components/` | Shell, shared inputs and states, one folder per feature |
| `lib/mock/` | Sample data used by **Load sample data** and tests |
| `tests/`, `e2e/` | Vitest unit tests, Playwright browser tests |
