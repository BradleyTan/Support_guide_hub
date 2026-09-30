# Go-live checklist

Work through this before relying on the app for real client work (Phase 7). Items marked **You** are done by you in a dashboard; the rest are done in the code with your approval.

## Email (Supabase Auth)

- [ ] **You:** set up custom SMTP in Supabase → **Authentication → Emails → SMTP Settings**, using one of:
  - **Gmail** with an App password (needs 2-step verification on the Google account), or
  - **Resend** (free plan), or
  - **Brevo** (free plan).

  Why: the built-in sender allows only a few emails per hour for the whole project, so sign-up confirmations and password resets get blocked ("Too many emails sent…"). With custom SMTP the limit starts at 30/hour and can be raised under Authentication → Rate Limits.
- [ ] Send yourself a test: sign up a throwaway address and use **Forgot password?** once, confirm both emails arrive and the links work.

## Supabase URL settings

- [ ] **You:** Authentication → URL Configuration → set **Site URL** to the live Vercel address.
- [ ] **You:** add `https://<your-app>.vercel.app/**` to **Redirect URLs** (keep `http://localhost:3001/**` for local use).

## Hosting (must stay free)

- [ ] Choose free hosting that allows work use. Vercel's free Hobby plan is for personal, non-commercial projects; alternatives to compare in Phase 7: Cloudflare, Netlify, or running the app on your own PC. Decide before deploying.

## Deploy

- [ ] Environment variables set on the host: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (add `ANTHROPIC_API_KEY` only if AI is turned on later).
- [ ] Official help-centre index is refreshing: Settings shows ~600+ articles and a recent “last refreshed” date (Supabase jobs `official-pages-sync` daily, `official-pages-details` every 2 minutes).
- [ ] GitHub repo connected, CI green, repository variables set for the two public Supabase values.

## Security and data

- [ ] Supabase security advisor shows no issues; `supabase/tests/rls.sql` returns “RLS: all checks passed”.
- [ ] Optional, **You:** Authentication → Settings (Password security) → turn on **Leaked password protection** (blocks passwords found in known data leaks). The Supabase security advisor flags it while it's off; it may need a paid plan.
- [ ] Signed-in browser tests use a **separate test account**, not your main one.
- [ ] Know how to back up: Settings → Export everything, and the `supabase db dump` command in the README.
- [ ] Free-plan pause: the project pauses after about 7 days without use; resume it from the Supabase dashboard (or upgrade if that becomes a problem).
