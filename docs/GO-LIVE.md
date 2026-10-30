# Go-live checklist

Work through this before relying on the app for real client work. Items marked **You** are done by you in a dashboard; the rest are done in the code with your approval.

## Email (Supabase Auth)

- [x] **You:** set up custom SMTP in Supabase → **Authentication → Emails → SMTP Settings**, using one of:
  - **Gmail** with an App password (needs 2-step verification on the Google account), or
  - **Resend** (free plan), or
  - **Brevo** (free plan).

  Why: the built-in sender allows only a few emails per hour for the whole project, so sign-up confirmations and password resets get blocked ("Too many emails sent…"). With custom SMTP the limit starts at 30/hour and can be raised under Authentication → Rate Limits.
- [x] Send yourself a test on the live address: use **Forgot password?** once and confirm the email arrives and its link opens the live site (not localhost).

## GitHub

- [x] Private repo created: `BradleyTan/Support_guide_hub`.
- [x] **You:** Settings → Secrets and variables → Actions → **Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public values, the same as in `.env.local`).
- [ ] Optional, **You:** **Secrets**: `E2E_EMAIL` and `E2E_PASSWORD` of the **test account** (never your main account), so CI also runs the signed-in tests. Without them CI runs the signed-out tests only.
- [x] The **CI** check on the latest commit is green (Actions tab).

## Hosting: Netlify (free plan)

Chosen because its free plan allows work use (Vercel's free plan is non-commercial only). 300 credits a month, hard cap, never charged: when credits run out the site pauses until the next month. Normal single-user use needs very few; each production deploy costs 15.

- [x] **You:** create a free Netlify account and **Add new project → Import an existing project → GitHub →** `Support_guide_hub`. Netlify reads `netlify.toml`; leave the build settings as detected.
- [x] **You:** Site configuration → **Environment variables**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (same values as above), then **Deploys → Trigger deploy**.
- [x] **You:** Site configuration → Build & deploy → **Branches and deploy contexts**: production branch `main`; turn **Branch deploys** off to save credits.
- [x] Live address: https://atc-supportguide.netlify.app (Netlify visitor access: public; the app's own sign-in protects it).

## Supabase URL settings

- [x] **You:** Authentication → URL Configuration → set **Site URL** to the live Netlify address.
- [x] **You:** add `https://<name>.netlify.app/**` to **Redirect URLs** (keep `http://localhost:3001/**` for local use).

## Checks on the live site

- [ ] Sign in, open a guide, search, save nothing; Settings shows ~600+ help-centre articles and a recent “last refreshed” date.
- [x] Browser tests against the live address pass (signed-out: 38 passed on 3 Oct 2026). Security headers added (no framing, referrer limits).

## Accountant chat (Groq, free)

- [x] **You:** create a free API key at https://console.groq.com (API Keys → Create API Key). No card needed.
- [x] **You:** Supabase → **Edge Functions → Secrets** → add `GROQ_API_KEY` with that key. Never paste it anywhere else.
- [x] **You:** Groq → **Settings → Data Controls** → turn on **Zero Data Retention**, so Groq keeps nothing you send.
- [ ] **You:** check in Groq whether **browser search** is charged on the free plan before turning on Settings → Accountant chat → “Use web search…” (off by default).
- [x] Run `npm run eval:accountant` (needs `E2E_EMAIL`/`E2E_PASSWORD` in `.env.local`) and read any failures; correct `evals/scenarios.ts` where your own treatment differs.

## Security and data

- [x] **You:** Supabase → Authentication → Sign In / Providers → **Allow new users to sign up** turned off while it was just you. To let your team in, follow the **Team** section below, which turns it on.

- [ ] Supabase security advisor shows no issues apart from the optional item below; the scripts in `supabase/tests/` all report “all checks passed”.
- [ ] Optional, **You:** Authentication → Settings (Password security) → turn on **Leaked password protection** (blocks passwords found in known data leaks). It may need a paid plan.
- [ ] Signed-in browser tests use a **separate test account**, not your main one.
- [ ] Know how to back up: **Settings → Export everything** (Excel), and the `supabase db dump` command in the README.
- [ ] Bin: items deleted more than 30 days ago are removed for good every night (job `purge-bin`). Restore anything you need before then.
- [ ] Free-plan pause: the Supabase project pauses after about 7 days without use; resume it from the Supabase dashboard (or upgrade if that becomes a problem).

## Team

Team sharing is built and deployed (migrations 0014 and 0015; Edge Functions `ask-accountant`, `embed`, `notify-owner`). Sign-ups are still off until you finish these steps.

- [ ] **You:** Supabase → **Edge Functions → Secrets** → add `SMTP_USER` (the Gmail address that sends the notice) and `SMTP_PASS` (a Gmail App password: Google Account → Security → 2-Step Verification → App passwords). Never paste them anywhere else. They are used only to email you "New sign-up waiting: <name>".
- [ ] **You:** Supabase → **Authentication → URL Configuration**: **Site URL** is `https://atc-supportguide.netlify.app` and **Redirect URLs** include `https://atc-supportguide.netlify.app/auth/confirm`.
- [ ] **You:** Supabase → **Authentication → Sign In / Providers** → turn on **Allow new users to sign up** (email confirmation stays on).
- [ ] **You:** test with a second email address:
  1. Sign up with a name and confirm the email.
  2. Check that you (the owner) get "New sign-up waiting: <name>".
  3. Approve the person on **Team**.
  4. Sign in as that person: guides and the Accountant chat work, and the owner-only buttons (verify, delete, restore, settings, export) are hidden.
- [ ] To remove someone later: **Team → Remove access**. Their work stays in the library.
