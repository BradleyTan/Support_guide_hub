# Team sharing — design

Date: 29 Oct 2026. Status: draft, awaiting the user's approval.

## Intent

The app has been private to one person: the user, an AutoCount support consultant. They now want to share it with their **support colleagues**. Colleagues will mainly **search the guides** and **use the Accountant chat**. Nobody gets in without the user's approval.

Today every row belongs to its creator (`user_id = auth.uid()` RLS on every table). A colleague who signed in would see an empty app. This project turns the app into **one team workspace with one owner**.

## Goals

1. Colleagues sign up themselves, then **wait for the owner's approval**. Until approved, they see nothing and can do nothing.
2. The owner hears about each sign-up **by email** and approves or rejects it on a **Team** page.
3. Once approved, everyone shares one library:
   - guides (with attachments, revisions and pins);
   - Knowledge hub articles;
   - saved analyses;
   - SOPs;
   - reply templates and snippets;
   - Insights, which count the whole team's searches and guide opens.
4. **Anyone approved** can **add and edit** shared items.
5. **Only the owner** can:
   - delete items, restore them from the bin, or empty the bin;
   - set the trust marks: guide **Verified**, Knowledge **Reviewed** and **Steps checked**;
   - see the Team page and approve, reject or remove people;
   - change team-wide settings (chatbot model, web-search switch) and use **Export everything**.
6. When anyone other than the owner edits a **Verified** guide, it goes back to **Unverified** automatically. The same applies to a Knowledge article's steps: if a member changes them, they go back to unchecked.
7. Edit history shows **who** changed what.
8. **Accountant chats stay private to each person.**
9. The owner can **remove** someone's access at any time, and it takes effect at once.

## Non-goals

- More than one owner or admin. Deferred; the design shouldn't block it later.
- Several teams or workspaces.
- Per-item permissions (for example "private guide").
- In-app notifications. Email to the owner is enough.
- Notifying the colleague by email when they're approved. The owner tells them; the Waiting page says "you'll be able to use the app once approved — refresh this page".
- Paid email or auth services.

## Anti-goals (a failure even if it "works")

- A waiting, rejected or removed person can read **any** data: guides, chats, attachments, official index, search, functions. This must be enforced by the database and the Edge Functions, not just hidden on screen.
- Removing a person **deletes** their guides or edits. Today `user_id` references `auth.users` with `on delete cascade`, which would do exactly that if their auth account were deleted.
- A member sees another person's Accountant chats.
- A member can verify, delete, or change team settings by calling the API directly, around the hidden buttons.
- The chatbot trusts a menu path from a guide a member changed after the owner verified it.
- Anything that costs money.

## Decided with the user

- Colleagues **sign up**, and the owner **approves** them.
- The owner is **emailed** on each new sign-up.
- Members can **add and edit** guides; **only the owner verifies and deletes**.
- **Everything is shared:** guides, Knowledge hub, analyses, SOPs, templates, Insights.
- Chats stay private. Proposed by me; the user didn't object.

## How it works

### People and status

- A new table `team_members`: `user_id` (pk, references auth.users), `email`, `display_name`, `role` (`owner` | `member`), `status` (`pending` | `approved` | `rejected` | `removed`), `created_at`, `decided_at`.
- **Owner:** the user's existing login (bradleytan119@gmail.com) is inserted as `owner` / `approved`. The e2e test account is inserted as `member` / `approved`.
- **New sign-ups:** a trigger on `auth.users` (or on email confirmation) inserts `pending`. Re-enable "Allow new users to sign up" in Supabase; email confirmation stays on.
- **Helper functions** (security definer, `search_path = ''`, `stable`): `is_member()` (approved, any role) and `is_owner()`. RLS policies use these.

### Data rules (RLS)

**Shared tables:** `guides`, `guide_attachments`, `guide_revisions`, `pins`, `knowledge_articles`, `analyses`, `analysis_messages`, `sops`, `templates`, `guide_events`, `search_log`.
- **select / insert / update:** `is_member()`. Inserts still stamp `user_id` as the creator.
- **delete:** `is_owner()`.
- **Soft delete and restore** (setting or clearing `deleted_at`): owner only. Enforce with a trigger that rejects a non-owner changing `deleted_at`, since RLS can't see which column changed.

**Trust marks:** a trigger on `guides` rejects a non-owner changing `verified`. The same trigger sets `verified = false` when a non-owner changes the content columns. A matching trigger on `knowledge_articles` covers `reviewed` and `steps_verified`.

**Who changed what:**
- Add `updated_by uuid` to guides, articles, SOPs and templates, set by a trigger.
- `guide_revisions` records the editor.
- The guide page and article page show the person's display name.

**Private tables:** `accountant_chats` and `accountant_messages` stay `user_id = auth.uid()`, and also require `is_member()`.

**`user_settings`:**
- Becomes **one team row**: the owner's row, read by everyone who is a member, and updated by the owner only.
- `ask-accountant` reads the owner's row instead of the caller's.
- Chat model and web search apply team-wide.

**`official_pages` and `web_cache`:** readable by `is_member()` only (today any signed-in user can read them).

**Storage (`attachments` bucket):**
- Today files sit under `<user_id>/…`, readable only by their uploader.
- New rule: read and upload for `is_member()`; delete for `is_owner()`.
- Existing paths stay as they are.

**Foreign keys:** change `user_id` references on shared tables from `on delete cascade` to `on delete set null`, keeping the column nullable. Deleting an auth account then never deletes shared work. Removing access never deletes the auth account anyway; it only sets `status = removed`.

**Database functions:** all search and insights SQL functions are security invoker, so they follow the new RLS automatically. Check each one still returns team-wide results; for example `search_gaps` and `top_guides` must not filter by `auth.uid()` in their bodies.

### Edge Functions

- **`ask-accountant`:** reject callers who aren't `is_member()` (403 `not_approved`). Read settings from the owner's row. Source search now covers the team library.
- **`embed`:** also require `is_member()`.
- **`purge-bin`:** unchanged; it uses the service role.
- **New `notify-owner`:**
  - Called by a database webhook or trigger (pg_net, with a Vault secret like `purge-bin`) when a member becomes `pending`.
  - Sends one email to the owner through the user's existing **Gmail SMTP**. The secrets `SMTP_USER` and `SMTP_PASS` (App password) are set by the user in Supabase.
  - The email gives the name, the email address and a link to `/team`.
  - Failure to send must not block the sign-up.

### Pages

- **Waiting page:** shown for anyone signed in who isn't approved.
  - Pending: "Waiting for approval from <owner name>".
  - Rejected or removed: "You don't have access".
  - Has a Sign out button.
  - The app's route guard (`proxy.ts` / layout) sends every non-approved user here. Server actions also refuse them, with the database as the backstop.
- **Team page** (`/team`, owner only):
  - Pending list with Approve / Reject.
  - Members list with Remove access, plus re-approve for removed members.
  - Each person shows their display name, email and sign-up date.
- **Sign-up:** add a "Your name" field, which is stored as `display_name`.
- **Owner-only buttons are hidden for members:**
  - Verify;
  - Delete, Restore and the bin lists;
  - Knowledge "Reviewed" and "Steps checked";
  - the team-wide Settings (model, web search) and Export everything.
- **Navigation:** the Team page appears in the menu for the owner only.

### Existing data

All current rows already belong to the owner, so they become the team library as-is. The test account's existing rows also become shared. They are the "[e2e]" test leftovers, normally already cleaned up.

## Constraints

- Free only: Supabase free, Netlify free, Groq free, Gmail SMTP.
- Shared Groq allowance: about 25–35 answers a day for the whole team. The footer count "N answers today" should count the whole team.
- Approval gates: migrations, Edge Function deploys and the Supabase auth setting change each need the user's explicit "yes". The user sets SMTP secrets and turns sign-ups back on in the dashboard.
- Never read `.env.local`; the user runs write e2e tests; never run Prettier.

## Left to the builder

- Exact trigger and policy SQL, and whether pending users are created by an `auth.users` trigger or on first sign-in.
- How the owner's Supabase dashboard sign-up switch is toggled. The user does this.
- Wording on the Waiting and Team pages.
- Test design. At minimum, SQL tests for:
  - pending, removed and member versus owner, for every table and the storage bucket;
  - the verify and soft-delete triggers.
  
  Plus e2e tests for the Waiting page and the Team page.

## My calls (the user can override)

- Chats stay private to each person.
- A member's edit to a Verified guide un-verifies it. A member's change to a Knowledge article's steps un-checks them.
- One owner only. Team-wide settings are the owner's.
- Approval emails go to the owner only. Colleagues aren't emailed when approved.
- The owner's Gmail sends the notification, through two new Supabase secrets.
- Insights count the whole team.
- The e2e test account is an approved member.
- **Sign-up confirmation emails** use the custom Gmail SMTP the user already set up for Supabase Auth (go-live, 24 Oct 2026), so colleagues do receive their confirm link. Before turning sign-ups on, check that the Site URL and redirect URLs include the live address. A person becomes `pending` only after confirming their email, so unconfirmed sign-ups never reach the owner's list or inbox.
- **Each person can delete and restore their own Accountant chats.** The owner-only delete/restore rule covers the shared tables only. Chats are private, so each person manages their own bin of chats, and the owner can't see them. The chat bin in Settings stays visible to everyone, for their own chats only.
- **Testing owner-only actions:**
  - Covered by SQL tests run in rolled-back transactions as the owner, a member, a pending user and a removed user. The Team page and the owner buttons get browser tests that run only when owner test credentials are provided (`E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`), and are skipped otherwise.
  - Existing write tests that verify, delete or restore are rewritten to check that a member *can't* do those, and to clean up through a new database function. That function deletes only rows titled "[e2e]…" created by the test account, and only the test account (marked `is_test` in `team_members`) may call it.
  - "[e2e]" rows exist in the shared library only while a test run is going, usually a minute or two.
