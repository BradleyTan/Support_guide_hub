# Support Desk for AutoCount

A personal guidelines tool for an AutoCount support consultant: a searchable library of your own fixes and how-tos, search across your guides and AutoCount's official help centres, plus reply and SOP helpers. Tickets stay in Zoho Desk.

Everything runs on free tiers and open-source libraries: no paid services, and nothing to run on your PC. AI features are **off** by choice; nothing is sent to an AI service.

> **Status: Phase 3 (search).** Login, guide library (save, edit, bin, attachments, Excel/CSV import) and search are live. The accounting analyst, reply generator and SOP builder show sample content until their phases.

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

- Migrations in `supabase/migrations/` (0001 schema and RLS; 0002 duplicate finder and view counter; 0003 guide search; 0004–0005 official index and schedule). Every user table has `user_id`, created/updated timestamps and soft delete (`deleted_at`); Row Level Security restricts each user to their own rows. `official_pages` is shared public information: signed-in users can read it; only the refresh function writes.
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

Browser tests run against a production build on port 3100. Signed-in tests need `E2E_EMAIL` and `E2E_PASSWORD` for a **dedicated test account** (read from `.env.local`); they sign in once per run and reuse the session. Tests that create, edit and delete guides (`e2e/guides.spec.ts`) also need `E2E_ALLOW_WRITES=1`; they only touch guides titled `[e2e] …` and remove them afterwards. Traces and screenshots are off because they would record what's typed, including the test password. CI (`.github/workflows/ci.yml`) runs `npm test` on every push.

## Structure

| Path | What |
|---|---|
| `app/login`, `app/auth`, `app/reset-password` | Sign in / create account, email links, password reset |
| `app/(app)/` | One folder per screen; `actions.ts` files hold server actions |
| `proxy.ts`, `lib/supabase/` | Session refresh and login redirect, Supabase clients, types |
| `lib/data.ts` | Server-side reads (run as the signed-in user) |
| `lib/embeddings.ts`, `lib/official-sites.ts`, `lib/import.ts` | Search vectors, official-site rules, Excel/CSV import logic |
| `components/` | Shell, shared inputs and states, one folder per feature |
| `lib/mock/` | Sample data used by **Load sample data** and tests |
| `tests/`, `e2e/` | Vitest unit tests, Playwright browser tests |
