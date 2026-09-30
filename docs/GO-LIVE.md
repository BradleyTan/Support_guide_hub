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

## Deploy (Vercel)

- [ ] Environment variables set in Vercel (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `SEARXNG_URL`.
- [ ] SearXNG hosted somewhere the deployed app can reach (free host chosen in Phase 7), or accept the Google-links fallback.
- [ ] GitHub repo connected, CI green, repository variables set for the two public Supabase values.

## Security and data

- [ ] Supabase security advisor shows no issues; `supabase/tests/rls.sql` returns “RLS: all checks passed”.
- [ ] Signed-in browser tests use a **separate test account**, not your main one.
- [ ] Know how to back up: Settings → Export everything, and the `supabase db dump` command in the README.
- [ ] Free-plan pause: the project pauses after about 7 days without use; resume it from the Supabase dashboard (or upgrade if that becomes a problem).
