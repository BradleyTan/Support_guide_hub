# Support Desk for AutoCount

A personal guidelines tool for an AutoCount support consultant: a searchable library of your own fixes and how-tos, unified search across official AutoCount sources, an accounting analyst (journal entries + AutoCount steps + SST / e-Invoice notes), client reply drafts and SOP export. Tickets stay in Zoho Desk.

> **Status: Phase 1 (foundation).** Login, database and your own data are live. AI features (drafting, analysis, search answers) and live official-source search arrive in later phases and are clearly labelled as previews until then.

## Set up

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key (Supabase → Project settings → API).
3. In Supabase → **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3001` (later: your Vercel URL)
   - **Redirect URLs:** add `http://localhost:3001/**` (later also `https://<your-app>.vercel.app/**`)
4. `npm run dev` and open http://localhost:3001. Create your account, confirm the email, sign in.
5. On the empty Home screen, **Load sample data** adds 10 sample guides, analyses, templates and version notes to your account (optional).

Keyboard: `Ctrl K` command palette · `/` search · `N` new guide.

Before relying on the app for real work, go through [docs/GO-LIVE.md](docs/GO-LIVE.md), which starts with setting up custom SMTP so sign-up and password-reset emails aren't blocked by Supabase's free email allowance.

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Public; Row Level Security protects the data |
| `ANTHROPIC_API_KEY` | server only | Added in Phase 2 |
| `SEARXNG_URL` | server only | Added in Phase 3 |

No secret key is used by the app. Every database call runs as the signed-in user.

## Database

- Schema: `supabase/migrations/0001_init.sql`. Every table has `user_id`, created/updated timestamps and soft delete (`deleted_at`), and Row Level Security restricts each user to their own rows.
- Files go to the private `attachments` storage bucket under `<user_id>/…`, max 10 MB.
- RLS check: run `supabase/tests/rls.sql` in the Supabase SQL editor. It uses a transaction and rolls back, and returns `RLS: all checks passed`.
- Types: `lib/supabase/database.types.ts` is generated from the schema; regenerate after each migration.

### Backups

Free Supabase projects get daily backups kept for a limited time, and free projects pause after about a week without use (resume them from the dashboard). For your own copy, **Settings → Export everything** (coming in Phase 7) downloads all guides to Excel. For a full database dump: `npx supabase db dump --db-url "<connection string>" -f backup.sql`, using the connection string from Supabase → Project settings → Database.

## Checks

```bash
npm test          # lint + type-check + unit tests + browser tests
npm run test:unit # unit tests only (Vitest)
npm run build     # production build
```

Browser tests run against a production build on port 3100. Signed-in browser tests run only when `E2E_EMAIL` and `E2E_PASSWORD` for a dedicated test account are set (Playwright reads them from `.env.local`). Tests that create, edit and delete guides (`e2e/guides.spec.ts`) also need `E2E_ALLOW_WRITES=1`; they only touch guides titled `[e2e] …` and remove them afterwards. Point them at a **test account**, not your real one. CI (`.github/workflows/ci.yml`) runs `npm test` on every push.

## Structure

| Path | What |
|---|---|
| `app/login`, `app/auth` | Sign in / create account, email confirmation |
| `app/(app)/` | One folder per screen; `actions.ts` holds server actions |
| `proxy.ts`, `lib/supabase/` | Session refresh and login redirect, Supabase clients, generated types |
| `lib/data.ts` | Server-side reads (run as the signed-in user) |
| `components/` | Shell, shared inputs and states, one folder per feature |
| `lib/mock/` | Sample data used by **Load sample data** and tests |
| `tests/`, `e2e/` | Vitest unit tests, Playwright browser tests |
