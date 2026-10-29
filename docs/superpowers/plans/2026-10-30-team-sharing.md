# Team Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-user app into one team workspace with one owner. Colleagues sign up, wait for approval, then share the library. The owner alone deletes, verifies and manages people. Chats stay private.

**Architecture:**
- **Database:** a `team_members` table, plus `is_member()` / `is_owner()` security-definer helpers, drive every RLS policy. Column-level rules (verify, soft delete, un-verify on a member's edit) are enforced by triggers, so the API can't bypass them.
- **App:** a membership check sends non-approved users to `/waiting`, and an owner-only `/team` page manages people.
- **Edge Functions:** they check membership, and a new `notify-owner` function emails the owner through Gmail SMTP.

**Tech Stack:**
- Next.js 16 App Router: `PageProps<"/route">`; run `npx next typegen` after adding routes.
- React 19, shadcn/ui on Base UI, Zod 4.
- Supabase: Postgres RLS, Edge Functions deployed via MCP with `import_map_path: "deno.json"` when a `deno.json` exists; pg_net + Vault as in `0009_purge_bin.sql`.
- Vitest, Playwright (import `test`/`expect` from `e2e/fixtures.ts`).

**Spec:** `docs/superpowers/specs/2026-10-29-team-sharing-design.md`

## Global Constraints

- **Owner:** the existing login `bradleytan119@gmail.com` (`0e19c3dd-c912-4d00-b702-48b8b2e01869`), role `owner`. The e2e test account (`b1e2ff14-a47f-486b-a43a-26635994a67e`) is role `member`, status `approved`, `is_test = true`. There is exactly one owner.
- **Statuses:** `pending` | `approved` | `rejected` | `removed`. Only `approved` sees or does anything. This is enforced in RLS, storage policies and Edge Functions, not only in the UI.
- **Shared tables:** `guides`, `guide_attachments`, `guide_revisions`, `pins`, `knowledge_articles`, `analyses`, `analysis_messages`, `sops`, `templates`, `guide_events`, `search_log`.
  - select / insert / update: `is_member()`.
  - delete: `is_owner()`.
  - Changing `deleted_at`: owner only.
- **Private tables:** `accountant_chats` and `accountant_messages` stay `user_id = auth.uid()` **and** `is_member()`. Each person deletes and restores their own chats.
- **Trust marks:** `guides.verified`, `knowledge_articles.reviewed` and `knowledge_articles.steps_verified` are set by the owner only.
  - A non-owner changing a guide's content sets `verified = false`.
  - A non-owner changing `desktop_steps` / `cloud_steps` sets `steps_verified = false`.
- **Removing someone:** never deletes data. Shared tables' `user_id` foreign keys become `on delete set null`, and the column becomes nullable.
- **Team-wide settings:** come from the owner's `user_settings` row. Members can read it; only the owner can update it.
- **Copy:**
  - Waiting page heading `Waiting for approval`, body `<owner name> needs to approve your account before you can use the Support Desk. Refresh this page once you've been told you're in.`
  - Rejected or removed: heading `You don't have access`.
  - Owner email subject: `New sign-up waiting: <name>`.
- **Free only.** The user sets the SMTP secrets `SMTP_USER` / `SMTP_PASS` and turns Supabase sign-ups back on.
- **Approval gates:** applying migration 0014 (Task 1), and deploying `ask-accountant`, `embed` and `notify-owner` (Task 5).
- **Every task:**
  - `npx tsc --noEmit` and `npx eslint .` clean;
  - never run Prettier;
  - Conventional Commits, no attribution lines;
  - never read `.env.local`;
  - write e2e tests are run by the user.

## Review Focus

1. **A pending, rejected or removed user calling the API directly** (Supabase JS from the browser console) gets nothing: no rows from any table, no storage file, no search results, and the chatbot answers 403. Task 1 SQL test `outsiders see and change nothing` loops over every table; Task 5 adds a 403 check in `ask-accountant`.
2. **A member bypassing hidden buttons:**
   - `update guides set verified = true`;
   - `update … set deleted_at = now()`;
   - `delete from guides`;
   - updating `user_settings`.
   
   Each is refused. Task 1 SQL test `member cannot use owner powers`.
3. **A member edits a verified guide's steps;** the chatbot must stop trusting it. Task 1 SQL test `member edit un-verifies`, plus an `ask-accountant`-side check, which needs no new code because sources read `verified`.
4. **Removing a person keeps their work:** their guides stay, with `user_id` still set or set to null. Task 1 SQL test `removal keeps shared work` updates the status to removed, and also deletes a throwaway auth user inside the rolled-back transaction.
5. **The owner can't lock themselves out.** The owner row can't be rejected, removed or demoted through the Team actions or SQL. Task 1 SQL test `owner cannot be removed`; Task 4 action test.

---

### Task 1: Migration 0014 — team membership and shared rules (approval gate)

**Files:**
- Create: `supabase/migrations/0014_team_sharing.sql`, `supabase/tests/team.sql`
- Modify: `lib/supabase/database.types.ts`
- Update the earlier SQL tests that assume per-user isolation, so they reflect team sharing: `supabase/tests/knowledge.sql`, `supabase/tests/accountant.sql`, `supabase/tests/functions.sql` and any RLS test in `supabase/tests/`.

**Interfaces (produced):**
- **`team_members`:** `user_id uuid pk references auth.users on delete cascade`, `email text`, `display_name text not null default ''`, `role text check in ('owner','member') default 'member'`, `status text check in ('pending','approved','rejected','removed') default 'pending'`, `is_test boolean not null default false`, `created_at`, `decided_at`. A partial unique index enforces exactly one `role = 'owner'`. RLS:
  - select: own row, or `is_owner()`;
  - update: `is_owner()` and not the owner row;
  - no insert or delete from the API.
- **`is_member() returns boolean`** and **`is_owner() returns boolean`:** `stable security definer set search_path = ''`. Executable by `authenticated`.
- **`owner_name() returns text`:** the owner's `display_name` or email. For the Waiting page; callable by `authenticated`, including pending users.
- **Signup trigger `handle_confirmed_user`** on `auth.users`: after insert, or after update when `email_confirmed_at` goes from null to not null, it inserts a `pending` row (taking `display_name` from `raw_user_meta_data->>'display_name'`), unless a row already exists.
- **Seed:** the owner and test-account rows (Global Constraints).
- **Policies:** replace every policy on the shared tables, the private chat tables, `official_pages`, `web_cache` and `user_settings`, as in Global Constraints. `user_settings`: select `is_member()`; insert/update `is_owner()`.
- **Storage:** on the `attachments` bucket, replace the owner-folder policies with: select and insert `is_member()`; delete `is_owner()`.
- **Triggers:**
  - `guard_owner_columns` on `guides`, `knowledge_articles`, `analyses`, `sops`, `templates`: a non-owner changing `deleted_at` raises `insufficient_privilege`.
  - On `guides` only:
    - a non-owner changing `verified` raises;
    - a non-owner changing any content column sets `verified = false`.
  - On `knowledge_articles`:
    - a non-owner changing `reviewed` or `steps_verified` raises;
    - a non-owner changing `desktop_steps` / `cloud_steps` sets `steps_verified = false`.
- **Who changed what:**
  - `updated_by uuid default auth.uid()` on guides, knowledge_articles, sops and templates, set by a before-update trigger.
  - `guide_revisions.user_id` is already the editor; keep it.
- **Foreign keys:** shared tables' `user_id` foreign keys become `on delete set null`, nullable.
- **`team_settings() returns table (chat_model text, chat_web_search boolean)`:** security definer, reads the owner's row, member-only.
- **`team_answers_today() returns int`:** security definer. Counts assistant messages since midnight Malaysia time across the team. Member-only.
- **`e2e_cleanup() returns int`:** security definer. Hard-deletes shared rows whose title starts `[e2e]` and whose `user_id` is a `team_members.is_test` user. Raises unless the caller is `is_test`.

- [ ] **Step 1: Write `supabase/tests/team.sql`** in the style of `supabase/tests/accountant.sql`: begin, fake users for an owner, a member, a pending user and a removed user, then rollback. The checks:
  - `outsiders see and change nothing`: pending and removed users get 0 rows from every shared and private table, `official_pages` and `search_guides()`; inserts are refused.
  - `members share`: the member sees and edits the owner's guide; the member's new guide is visible to the owner.
  - `member cannot use owner powers`: verify, soft-delete, restore, hard-delete, update `user_settings`, update `team_members`; each is refused.
  - `member edit un-verifies`: the owner verifies, the member changes the steps, so `verified = false`; Knowledge steps work the same way.
  - `chats stay private`: the member can't see the owner's chat, and vice versa; each can soft-delete and restore their own.
  - `removal keeps shared work`.
  - `owner cannot be removed`.
  - `signup creates pending`: insert an auth user with `email_confirmed_at`, and a `pending` row exists with its `display_name`.
  - `e2e cleanup is test-only`.
  
  The script ends `select 'team: all checks passed'`.
- [ ] **Step 2: Write the migration.** Update the older SQL test files to the new rules.
- [ ] **Step 3: STOP. Ask the user to approve applying migration 0014.**
  - Apply it.
  - Run `team.sql` and every file in `supabase/tests/` via `execute_sql`: all pass.
  - Run `get_advisors` (security): no new warnings.
  - Confirm the owner row exists, and that 34+ guides are still visible to the owner.
- [ ] **Step 4:** Patch `database.types.ts` by hand for the new table, columns and functions (keep the file's compact style). tsc clean.
- [ ] **Step 5: Commit** `feat: team membership and shared data rules (migration 0014)`.

### Task 2: Membership in the app, Waiting page, sign-up name

**Files:**
- Create: `lib/team.ts`, `app/waiting/page.tsx`, `tests/team.test.ts`
- Modify: `app/(app)/layout.tsx`, `lib/supabase/proxy.ts`, `app/login/actions.ts`, `app/login/login-form.tsx`, `e2e/smoke.spec.ts`

**Interfaces:**
- **`lib/team.ts`** (server-only):
  - `type Membership = { role: "owner" | "member"; status: "pending" | "approved" | "rejected" | "removed"; displayName: string }`;
  - `getMembership(): Promise<Membership | null>`, cached per request; reads the caller's `team_members` row;
  - `requireMember(): Promise<SupabaseClient>`, which returns `null` from actions when the caller isn't approved;
  - `requireOwner()`.
- **Pure helper** in `lib/team-rules.ts`: `canUseApp(m: Membership | null): boolean` and `isOwner(m)`.
- **App layout:** not approved means `redirect("/waiting")`.
- **`/waiting`:** shows the Global Constraints copy, `owner_name()`, and a Sign out button. A visitor who is approved is redirected to `/`.
- **The proxy** lets `/waiting` through for signed-in users.
- **Sign-up form:** adds a required `Your name` field (1–80 characters), passed as `options.data.display_name`.

- [ ] **Step 1: Tests.**
  - `tests/team.test.ts`: `canUseApp` is true only for approved; `isOwner` is true only for an approved owner.
  - e2e smoke: `/waiting` signed out redirects to `/login`; the signed-in test account is approved, so `/` still loads.
  - e2e (read-only): the sign-up form shows the `Your name` field.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS**; tsc, eslint and `npx next typegen` clean.
- [ ] **Step 5: Commit** `feat: waiting page and membership check`.

### Task 3: Owner-only actions and controls

**Files:**
- Modify the server actions:
  - `app/(app)/guides/actions.ts` (`setVerified`, delete, restore);
  - `app/(app)/knowledge/actions.ts` (`setArticleReviewed`, `setStepsVerified`, `deleteArticle`, `restoreArticle`);
  - `app/(app)/sop/actions.ts`, `app/(app)/templates/actions.ts`, `app/(app)/analyst/actions.ts` (delete and restore);
  - `app/(app)/settings/actions.ts` (`saveChatSettings`, `exportEverything`).
- Modify the views, which hide controls when `!isOwner`:
  - `components/guides/{guide-detail,guide-list}.tsx`;
  - `components/knowledge/article-view.tsx`;
  - `components/sop/sop-editor.tsx`, `components/library/templates-view.tsx`, `components/analyst/analyst-view.tsx`;
  - `components/settings/settings-view.tsx`: members see only their own Deleted chats and the Password card.
- Plumbing: `app/(app)/layout.tsx` and `components/shell/app-shell.tsx` pass `isOwner` down through a small React context, `components/shell/team-context.tsx` (`useIsOwner()`).
- Modify `lib/data.ts`: `answersToday()` calls `team_answers_today()`; the guide, SOP and article reads include the `updated_by` name.
- Guide and article pages show `Last edited by <name>`.
- Test: `e2e/team-member.spec.ts`

**Interfaces:**
- Each owner-only action starts with `const sb = await requireOwner(); if (!sb) return { ok: false, error: "Only the owner can do this." }`. The database refuses as a backstop.

- [ ] **Step 1: e2e (read-only, as the test member):**
  - a guide page has no `Mark verified` or `Delete` button;
  - Settings has no Export everything or chatbot model;
  - the Accountant chat still has Rename and Delete for its own chats.
- [ ] **Step 2: FAIL. Step 3: Implement. Step 4: PASS**; tsc and eslint clean.
- [ ] **Step 5:** Rewrite the existing write specs (`e2e/guides.spec.ts`, `knowledge.spec.ts`, `phase6.spec.ts`, `analyst` / `export` specs) that verify, delete or restore:
  - as the member, assert those controls are absent;
  - keep the create and edit coverage;
  - clean up through `supabase.rpc("e2e_cleanup")` instead of `.delete()`.
- [ ] **Step 6: Owner-only browser coverage.** In `e2e/team-owner.spec.ts`, skip unless `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD` are set. It signs in fresh (`signInFresh`-style, as the owner) and checks that verify and delete work on an `[e2e]` guide, then cleans up.
- [ ] **Step 7: Commit** `feat: owner-only verify, delete, restore and settings`.

### Task 4: Team page

**Files:**
- Create: `app/(app)/team/page.tsx`, `app/(app)/team/actions.ts`, `components/team/team-view.tsx`
- Modify: `components/shell/nav.ts`: `Team` item (icon `Users`), owner-only, hidden from members
- Test: `tests/team.test.ts` (pure helpers), `e2e/team-owner.spec.ts` (owner-gated)

**Interfaces:**
- **Actions:** `approveMember(userId)`, `rejectMember(userId)`, `removeMember(userId)`, `reapproveMember(userId)`. Each is Zod-validated as a uuid, owner-only, and refuses the owner's own row with `You can't change the owner.`. They set `status` and `decided_at`, then `revalidatePath("/team")`.
- **Pure `groupMembers(rows)`:** returns `{ pending, approved, inactive }`, each sorted. Pending is oldest first.
- **Page sections:** `Waiting for approval` (Approve / Reject), `Team` (Remove access), `Removed or rejected` (Approve again). Each row shows the name, the email and the sign-up date.
- **A member opening `/team`** gets `notFound()`.

- [ ] **Step 1: Tests:**
  - `groupMembers` sorts and groups;
  - e2e as the member: `/team` shows Not found, and the nav has no Team link;
  - owner-gated e2e: the page lists the test member under Team.
- [ ] **Step 2: FAIL. Step 3: Implement**, then `npx next typegen`. **Step 4: PASS.**
- [ ] **Step 5: Commit** `feat: team page for approving colleagues`.

### Task 5: Edge Functions (approval gate to deploy)

**Files:**
- Modify: `supabase/functions/ask-accountant/index.ts`:
  - after `getUser`, call `db.rpc("is_member")`; if false, return 403 `{ error: "not_approved" }`;
  - replace the `user_settings` read with `db.rpc("team_settings").maybeSingle()`.
- Modify: `supabase/functions/embed/index.ts`: same membership check.
- Modify: `lib/accountant/chat.ts`: `askErrorMessage(403, { error: "not_approved" })` returns `Your account is waiting for approval.`
- Create: `supabase/functions/notify-owner/index.ts`, and migration `supabase/migrations/0015_notify_owner.sql`:
  - a trigger on `team_members` insert with `status = 'pending'` calls `net.http_post` to `notify-owner` with a Vault secret header, as in `0009_purge_bin.sql`;
  - the function checks the secret, reads the owner's email with the service role, and sends one email through `SMTP_USER` / `SMTP_PASS` (Gmail, port 465, TLS), using the `denomailer` package pinned to an exact version;
  - a failed send is logged, and the response is still 200, so sign-up is never blocked.
- Test: `tests/accountant-data.test.ts` (the 403 message); a SQL check that the trigger queues a `net.http_post` request.

- [ ] **Step 1: Test the 403 message. FAIL. Implement. PASS.**
- [ ] **Step 2: Commit** `feat: membership checks in edge functions and owner sign-up email`.
- [ ] **Step 3: STOP. Ask the user to approve:**
  - applying 0015;
  - redeploying `ask-accountant` and `embed`;
  - deploying `notify-owner`.
  
  Then do each, and smoke-test that an unsigned POST still returns 401. The user adds the `SMTP_USER` / `SMTP_PASS` secrets.

### Task 6: Go-live steps, docs, full checks

**Files:**
- Modify: `docs/GO-LIVE.md`, a "Team" section:
  - add the SMTP secrets;
  - check that Site URL and redirect URLs include the live address;
  - turn on **Allow new users to sign up**;
  - test with a second email: sign up, confirm, check the owner gets the email, approve on Team, sign in.
- Modify: `README.md`: a Team section, the migrations list up to 0015, and the e2e owner variables.
- Update the project memory note.

- [ ] **Step 1:** Run `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` and `npx playwright test` (read-only). Report the counts.
- [ ] **Step 2: Commit** `docs: team sharing setup`.
- [ ] **Step 3:** Hand over to the user:
  - the setup steps;
  - the write e2e run;
  - the optional owner e2e run with `E2E_OWNER_EMAIL` / `E2E_OWNER_PASSWORD`.
