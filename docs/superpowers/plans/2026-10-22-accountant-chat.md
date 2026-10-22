# Accountant chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private **Accountant chat** page. It answers customer accounting scenarios with AutoCount steps, via Groq's free tier. Code checks guard the journal entries and menu paths. Personal data is masked before it leaves the app. Chats are saved, and a good answer can become a guide.

**Architecture:**
- **Pure "core" modules** in `lib/accountant/core/` (answer contract, masking, checks, prompt) are shared by the Next app and a new Supabase Edge Function. `npm run sync:core` copies them into `supabase/functions/_shared/accountant-core/`, and a unit test fails if the copies drift.
- **The browser** masks the user's text, calls the Edge Function directly (Netlify free functions time out at about 10s), unmasks the answer and saves the turn through a server action.
- **The Edge Function** gathers sources as the signed-in user, masks them, calls Groq once with a JSON schema (plus an optional earlier browser-search call), and runs the checks before replying.

**Tech Stack:**
- Next.js 16 App Router. Read `node_modules/next/dist/docs/` before route code. Use `PageProps<"/route">`, and run `npx next typegen` after adding routes.
- React 19, Tailwind v4, shadcn/ui on Base UI (`ButtonLink`, `DialogClose render`), sonner, Zod 4.
- Supabase: Postgres + RLS, Edge Functions (Deno), deployed via the Supabase MCP.
- Vitest; Playwright (import `test`/`expect` from `e2e/fixtures.ts`).
- Groq OpenAI-compatible API: `https://api.groq.com/openai/v1/chat/completions`.

**Spec:** `docs/superpowers/specs/2026-10-22-accountant-chat-design.md`

## Global Constraints

- **Free only.**
  - Groq free tier; default model `openai/gpt-oss-120b`, changeable in Settings.
  - Do not use `groq/compound` (shut down 21 Sep 2026).
  - Web search (`browser_search` tool) is **off by default**.
- **Keys and secrets.** `GROQ_API_KEY` lives only as a Supabase Edge Function secret, set by the user. Never in the browser, Netlify, the repo or chat. Never read `.env.local`.
- **Masking.** Nothing unmasked reaches Groq. Automatic rules: IC numbers, bank account numbers, phone numbers, emails, and company names ending in Sdn Bhd / Sdn. Bhd. / Bhd / Berhad / Enterprise / Trading / PLT. The user can hide any extra text. The same rules run on guide/Knowledge text in the Edge Function.
- **Placeholders** have the exact form `[COMPANY 1]`, `[IC 1]`, `[BANK 1]`, `[PHONE 1]`, `[EMAIL 1]`, `[HIDDEN 1]`. They are numbered per chat and reused through `mask_map`.
- **Entries.** Debits must equal credits to the sen, and amounts must be > 0. `accountType ∈ asset | liability | equity | income | expense`. An entry that fails is labelled exactly `Didn't balance — not sent to the customer`.
- **Menu paths.** A path reaches the customer only if a **checked** source of the right platform contains it:
  - verified guide (`platform` desktop | cloud | both);
  - Knowledge article with `steps_verified` (its `desktop_steps`/`cloud_steps`);
  - AutoCount help-centre page (always Cloud).
  
  Web sources never confirm a path. An unconfirmed path is replaced in the customer reply by exactly: `I'll confirm the exact menu and get back to you.` In "For you", a path from an unverified guide is shown as `From an unverified guide — check it`.
- **Clarifying questions.** When the model says facts are missing, show at most 5 questions and nothing else: no entries, no customer reply.
- **Labels.** Every answer shows `Check before relying`. The Copy button reads `Copy for the customer`. It is shown only after the user ticks `I've checked the entry and steps` on that answer.
- **Help-centre page fetches** obey robots.txt: only `/support/solutions/articles/*`, never `/support/search`, with the user agent from `refresh-official`.
- **Rate limits.** On a Groq 429, show `Groq's free limit is busy — try again in N seconds` (N from `retry-after`, default 60). The user's typed message is never lost.
- **English only.** The AI is used only on this page.
- **Approval gates** (stop and ask the user, then continue):
  - applying migration 0012 (Task 3);
  - deploying `ask-accountant` (Task 5);
  - redeploying `purge-bin` (Task 8).
  
  The user sets the Groq secret, Zero Data Retention and the web-search check. The user pushes to GitHub.
- **Every task:**
  - `npx tsc --noEmit` and `npx eslint .` clean;
  - never run Prettier;
  - commit via `git commit -F <file>`, with the message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Write e2e** (`E2E_ALLOW_WRITES=1`) is run by the user. Signed-in tests never run against the live site.

## Review Focus

1. **A Cloud-only source must not confirm a Desktop step, and vice versa.** "both" guides confirm either. Task 2 test `cloud source never confirms a desktop path`.
2. **Same value, same placeholder, every time.** The same IC or company typed twice, or again in a follow-up, maps to the same placeholder. An overlapping hidden selection (the user hides text inside an auto-masked span) does not produce nested or broken placeholders. Task 1 tests `reuses placeholders across turns` and `manual hide inside an auto span keeps one placeholder`.
3. **Malformed model output does not crash the page or save garbage.** This covers invalid JSON, a missing field, or a string amount like `"1,000.00"`. The turn shows a retryable error, and the user's text is kept. Task 2 test `parseAnswer rejects string amounts`, and Task 7 e2e `bad answer keeps the message`.
4. **Placeholders the model invented or mangled** (`[COMPANY 9]`, `[company 1]`, `COMPANY 1`) never reach the customer reply. Task 2 test `customer reply with unknown placeholder is flagged`.
5. **Rounding.** Amounts like 0.1 + 0.2 and three-decimal amounts must be checked in sen, as integers. Task 2 test `balances in sen not floats`.

---

### Task 1: Core — answer contract and masking

**Files:**
- Create: `lib/accountant/core/answer.ts`, `lib/accountant/core/mask.ts`
- Modify: `tsconfig.json` (add `"allowImportingTsExtensions": true`; core files import each other as `./answer.ts` so Deno and Next both resolve them)
- Test: `tests/accountant-answer.test.ts`, `tests/accountant-mask.test.ts`

**Interfaces:**
- Produces, in `answer.ts` (imports only `zod`):
  - `ACCOUNT_TYPES = ["asset","liability","equity","income","expense"] as const`
  - `SOURCE_KINDS = ["my-guide","knowledge","official","web"] as const`
  - `type Platform = "desktop" | "cloud" | "both"`
  - `interface Source { id: string; kind: SourceKind; title: string; url: string; platform: Platform | null; checked: boolean; text: string }`. `text` is the masked body used for path matching. It is never sent to the browser in full.
  - `modelAnswerSchema` (Zod): what Groq must return.
    ```
    { needsMoreInfo: boolean,
      questions: string[] (≤5),
      summary: string,
      assumptions: string[],
      entries: { date: string | null, description: string, lines: { account: string, accountType: AccountType, dr: number | null, cr: number | null }[] (≥2) }[],
      steps: { platform: "desktop" | "cloud", text: string, menuPath: string | null, sourceIds: string[] }[],
      customerMessage: string,
      needsAccountant: string | null,
      doubts: string[] }
    ```
  - `modelAnswerJsonSchema`: the same schema as a plain JSON-Schema object, for Groq `response_format: { type: "json_schema", json_schema: { name: "answer", strict: true, schema } }`.
  - `parseAnswer(raw: string): { ok: true; answer: ModelAnswer } | { ok: false; error: string }`
  - `interface CheckedAnswer { answer: ModelAnswer; entryResults: { balanced: boolean; problem: string | null }[]; steps: CheckedStep[]; customerReply: string | null; sources: Omit<Source,"text">[]; flags: string[] }`
  - `interface CheckedStep extends ModelStep { status: "confirmed" | "unverified-source" | "not-confirmed" }`
- Produces, in `mask.ts` (no imports):
  - `type MaskMap = Record<string, string>` (placeholder → real value)
  - `autoMask(text: string, map: MaskMap): { text: string; map: MaskMap }`. Applies the existing map's values first, then the rules. Returns the merged map.
  - `hideSelection(text: string, value: string, map: MaskMap): { text: string; map: MaskMap }`. Kind `HIDDEN`.
  - `unmask(text: string, map: MaskMap): string`
  - `PLACEHOLDER = /\[(COMPANY|IC|BANK|PHONE|EMAIL|HIDDEN) \d+\]/g`

- [ ] **Step 1: Write failing tests**

  `accountant-mask.test.ts`:
  - `masks IC, bank, phone, email, company`:
    - `"Lee Trading Sdn Bhd, IC 900101-14-5678, acct 5140 1234 5678, 012-345 6789, a@b.com"`
    - → contains `[COMPANY 1]`, `[IC 1]`, `[BANK 1]`, `[PHONE 1]`, `[EMAIL 1]`
    - → contains none of the originals.
  - `does not mask money or dates`: `"RM5,000.00 on 12/03/2024, invoice IV-00123"` is unchanged.
  - `reuses placeholders across turns`: mask "ABC Sdn Bhd", then mask "ABC Sdn Bhd paid again" with the returned map → `[COMPANY 1]` both times, and the map has 1 key.
  - `manual hide inside an auto span keeps one placeholder`.
  - `unmask round-trips`.

  `accountant-answer.test.ts`:
  - `parseAnswer accepts a fixture` (`tests/fixtures/accountant/answer-ok.json`).
  - `parseAnswer rejects string amounts` (`"dr": "1,000.00"` → ok:false).
  - `parseAnswer rejects non-JSON`.
  - `json schema and zod schema agree`: the fixture is valid under both.
- [ ] **Step 2:** `npx vitest run tests/accountant-mask.test.ts tests/accountant-answer.test.ts` → FAIL.
- [ ] **Step 3: Implement the two modules.**
  - IC: `\b\d{6}-?\d{2}-?\d{4}\b`.
  - Bank: 10–16 digits, optionally grouped by spaces or hyphens, not preceded by `RM`, and not an IC.
  - Phone: Malaysian `(\+?60|0)1\d[-\s]?\d{3,4}[-\s]?\d{4}`.
  - Company: up to 6 capitalised words before a suffix.
- [ ] **Step 4:** Tests PASS; tsc and eslint clean.
- [ ] **Step 5: Commit** `Accountant chat: answer contract and masking`.

### Task 2: Core — checks, customer reply, prompt

**Files:**
- Create: `lib/accountant/core/checks.ts`, `lib/accountant/core/prompt.ts`, `scripts/sync-accountant-core.mjs`
- Modify: `package.json` (script `"sync:core": "node scripts/sync-accountant-core.mjs"`)
- Test: `tests/accountant-checks.test.ts`, `tests/accountant-prompt.test.ts`, `tests/accountant-core-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `checkEntry(e: ModelEntry): { balanced: boolean; problem: string | null }`. Works in integer sen: `Math.round(x * 100)`. Each line has exactly one of dr/cr > 0.
  - `normalizePath(p: string): string`. Lowercase, collapse spaces, `→`/`»`/`/` between words become `>`.
  - `checkStep(step: ModelStep, sources: Source[]): CheckedStep`
    - `confirmed` if any cited source with `kind !== "web"`, `checked`, a platform compatible with `step.platform`, and `normalizePath(text)` includes `normalizePath(menuPath)`.
    - `unverified-source` if the same match exists only in an unchecked guide.
    - Otherwise `not-confirmed`.
    - A step with no menuPath is `confirmed`.
  - `buildCustomerReply(a: ModelAnswer, steps: CheckedStep[], entries: {balanced:boolean}[], map: MaskMap): { reply: string | null; flags: string[] }`
    - Returns null when `needsMoreInfo`.
    - The reply is `customerMessage`, plus balanced entries in plain text (`Dr <account> RM x` / `Cr …`), plus steps grouped `AutoCount (Desktop):` / `AutoCount Cloud:`, with each non-confirmed path replaced by the fixed sentence.
    - Sentences in `customerMessage` matching `\w[\w ]*\s(>|→)\s\w` are dropped, and a flag is added.
    - Any `[...]` token not in `map`, or a case-variant placeholder, is a flag, and the reply is not offered for copying (`reply: null`, flag `Customer reply had unknown placeholders`).
  - `checkAnswer(a: ModelAnswer, sources: Source[], map: MaskMap): CheckedAnswer`
  - In `prompt.ts`:
    - `SYSTEM_PROMPT: string`
    - `buildMessages(input: { history: { role: "user" | "assistant"; content: string }[]; message: string; sources: Source[]; map: MaskMap }): { messages: { role: string; content: string }[]; sources: Source[]; map: MaskMap }`. It runs `autoMask` on every source's text with the chat map, and returns the masked sources (for `checkAnswer`) and the merged map.
    - Sources are numbered `[S1]…`, kind and platform are labelled, and the total source text is capped at 12,000 characters. Earlier sources win; each source is cut to 3,000 characters.
    - The system prompt says to:
      - act as a Malaysian accountant who knows AutoCount;
      - ask up to 5 questions when key facts are missing;
      - use only cited source ids for menu paths;
      - keep paths out of `customerMessage`;
      - set `needsAccountant` for prior-year/audited/tax-judgement cases;
      - date tax facts "as of" with a source.
- [ ] **Step 1: Write failing tests** (`accountant-checks.test.ts`):
  - `balances in sen not floats`: lines 0.1 + 0.2 Dr vs 0.3 Cr → balanced.
  - `flags unbalanced`: 100 Dr vs 90 Cr → `problem` mentions 10.00.
  - `rejects a line with both dr and cr`.
  - `cloud source never confirms a desktop path`.
  - `both-platform verified guide confirms desktop`.
  - `unverified guide gives unverified-source`.
  - `web source never confirms`.
  - `path matching ignores case, spacing and arrows`: `"Sales → Invoice"` matches source text `"go to sales > invoice"`.
  - `customer reply replaces unconfirmed path with fixed sentence`.
  - `customer reply omits unbalanced entries`.
  - `customer reply with unknown placeholder is flagged`.
  - `needsMoreInfo gives null reply`.
  
  `accountant-prompt.test.ts`:
  - `caps total source text at 12,000 chars and numbers sources S1..`
  - `never includes an unmasked value`: pass sources whose text has an IC; no message contains it, and the returned map gains `[IC n]`.

  `accountant-core-sync.test.ts`: each file in `lib/accountant/core/` is byte-identical to `supabase/functions/_shared/accountant-core/`.
- [ ] **Step 2:** Run them → FAIL.
- [ ] **Step 3: Implement.** Then run `npm run sync:core`, which copies the core files and writes no other changes.- [ ] **Step 4:** Tests PASS; tsc and eslint clean.
- [ ] **Step 5: Commit** `Accountant chat: answer checks, customer reply and prompt`.

### Task 3: Migration 0012 (approval gate)

**Files:**
- Create: `supabase/migrations/0012_accountant_chat.sql`, `supabase/tests/accountant.sql`
- Modify: `lib/supabase/database.types.ts` (regenerate via MCP `generate_typescript_types`; keep the existing `TablesUpdate` export)

**Interfaces:**
- **`guides.platform`:** `text not null default 'desktop' check (platform in ('desktop','cloud','both'))`. Backfill:
  - `cloud` where title/symptom/cause/steps/tags mention `cloud` (case-insensitive) or contain `autocountcloud.com`;
  - otherwise `desktop`.
- **`accountant_chats`:**
  - `id uuid pk`, `user_id uuid not null default auth.uid()` (fk auth.users, cascade);
  - `title text not null check (length(trim(title)) between 1 and 200)`;
  - `mask_map jsonb not null default '{}'`;
  - `fts tsvector` (trigger: title + all message content, weight A/B);
  - `created_at`, `updated_at` (trigger `set_updated_at`), `deleted_at`.
- **`accountant_messages`:**
  - `id uuid pk`, `chat_id uuid not null references accountant_chats on delete cascade`, `user_id uuid not null default auth.uid()`;
  - `role text check in ('user','assistant')`;
  - `content text not null default ''`;
  - `answer jsonb` (assistant only: an unmasked `CheckedAnswer` without source `text`);
  - `checked boolean not null default false`;
  - `created_at`.
  - Inserting a message refreshes its chat's `fts` and `updated_at`.
- **RLS:** owner policies for all four operations on both tables, `user_id = (select auth.uid())`. Messages also require their chat to be owned by the same user.
- **`user_settings`:** add `chat_model text not null default 'openai/gpt-oss-120b'` and `chat_web_search boolean not null default false`.
- **`search_accountant_chats(p_query text, p_limit int default 10) returns table (id uuid, score real)`:** security invoker, `set search_path = ''`, full text plus fuzzy title, RRF like `search_knowledge`. Excludes deleted chats. Execute is granted to `authenticated` only.

- [ ] **Step 1:** Write the SQL test `supabase/tests/accountant.sql`, in the style of `supabase/tests/knowledge.sql`:
  - user B can't see, insert into, or add messages to user A's chat;
  - search finds by message text and by a title typo;
  - `'`, `%` and empty queries don't error;
  - the backfill marks a guide containing "AutoCount Cloud" as cloud.
- [ ] **Step 2: STOP — ask the user to approve applying migration 0012.** Then apply via MCP `apply_migration`, run the SQL test via `execute_sql` (expect `accountant: all checks passed`), and run `get_advisors` (security): no new warnings.
- [ ] **Step 3:** Regenerate the types; tsc clean.
- [ ] **Step 4: Commit** `Accountant chat: chats, messages and guide platform (migration 0012)`.

### Task 4: Guide platform in the app

**Files:**
- Modify:
  - `lib/types.ts` (`PLATFORMS = ["desktop","cloud","both"] as const`, `PLATFORM_LABELS = { desktop: "Desktop", cloud: "Cloud", both: "Desktop & Cloud" }`, `Guide.platform`);
  - `lib/guide-schema.ts` (`platform: z.enum(PLATFORMS).default("desktop")` in input, row and `guideToInput`);
  - `lib/data.ts` (map the column);
  - `components/guides/guide-form.tsx` (a select labelled `Platform` after Product);
  - `components/guides/guide-detail.tsx` (a badge);
  - `lib/import.ts` (an optional `Platform` column accepting Desktop/Cloud/Both, case-insensitive; blank = desktop);
  - `lib/export.ts` (a `Platform` column right after Product);
  - `lib/mock/guides.ts`.
- Test: `tests/export.test.ts`, `tests/import.test.ts` (or wherever import mapping is tested), `e2e/guides.spec.ts`

**Interfaces:**
- Produces: `Guide.platform: Platform` and `GuideInput.platform`, used by Task 5 (source platform) and Task 7 (prefill).

- [ ] **Step 1:** Update tests:
  - The export round-trip still re-imports every field, including platform. Adjust the `mapping.slice(...)` skip indexes for the new column.
  - The import maps a `Platform` header and rejects `Mobile` with a clear message.
  - e2e: the guide form shows `Platform` and saves `Cloud`. This is a write test, so skip it unless `E2E_ALLOW_WRITES`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npx vitest run` all PASS; tsc and eslint clean.
- [ ] **Step 5: Commit** `Guides: Desktop / Cloud / Both platform field`.

### Task 5: Edge Function `ask-accountant` (approval gate to deploy)

**Files:**
- Create: `supabase/functions/ask-accountant/index.ts`, `supabase/functions/ask-accountant/deno.json` (imports: `"zod": "npm:zod@4.6.5"`)
- Test: `tests/accountant-sources.test.ts` (pure helpers only, see below)
- Create: `lib/accountant/core/sources.ts` (synced like the other core files)

**Interfaces:**
- **Request** `POST`, `Authorization: Bearer <user access token>`, body `{ message: string (masked, ≤4,000 chars), history: {role, content}[] (masked, last 6 turns), mask: MaskMap }`.
  - The map is needed so source masking reuses placeholders. It contains real values, but goes only to our own function, which never forwards it.
- **Response 200:** `{ checked: CheckedAnswer (masked), mask: MaskMap (merged) }`.
- **Errors:**
  - 400 `{ error }`;
  - 401 `Sign in required`;
  - 429 `{ error: "rate_limited", retryAfter: number }`;
  - 502 `{ error: "bad_answer" }` when `parseAnswer` fails twice (one retry);
  - 503 `{ error: "not_configured" }` when `GROQ_API_KEY` is missing.
- **In `sources.ts`:**
  - `toGuideSource(row): Source`. Kind `my-guide`; checked = `verified`; platform = row platform; text = title + steps + cause.
  - `toKnowledgeSource(row): Source[]`. Two sources: desktop (text = `desktop_steps`) and cloud (text = `cloud_steps`). Checked = `steps_verified`. Plus the explanation text on the first.
  - `toOfficialSource(page, bodyText): Source`. Kind `official`, platform `cloud`, checked true.
  - `htmlToText(html: string): string`. Strips tags/scripts and keeps `>` in breadcrumbs.
  - `isFetchableArticle(url: string): boolean`. Uses the `ARTICLE` regex from `refresh-official`.
- **Flow:**
  1. Verify the user (as in `embed`). Create a client with the user's JWT so RLS applies.
  2. Read `user_settings` for model and web.
  3. `search_guides` (top 4, then load rows), `search_knowledge` (top 3) and `search_official_pages` (top 3). For those, fetch page text, 8s timeout each, in parallel, skipping failures.
  4. If web is on and there are fewer than 2 checked sources: one Groq call with `tools: [{type:"browser_search"}]` and `reasoning_effort: "low"`. Its text becomes one `web` source.
  5. Call `buildMessages`, then Groq with `response_format` json_schema, `reasoning_effort: "medium"`, `max_completion_tokens: 2500`.
  6. Run `parseAnswer`, retrying once on failure, then `checkAnswer`. Return the result.
  
  Pass a Groq 429 through with `retry-after`.

- [ ] **Step 1: Write failing tests** for `sources.ts`:
  - `knowledge article gives separate desktop and cloud sources`;
  - `official source is cloud and checked`;
  - `htmlToText keeps breadcrumb arrows and drops scripts`;
  - `isFetchableArticle rejects /support/search`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `sources.ts`, run `npm run sync:core`, then write `index.ts`.
- [ ] **Step 4:** Tests PASS; tsc and eslint clean; `deno check` is not available, so review the imports by eye: every core import ends in `.ts`.
- [ ] **Step 5: Commit** `Accountant chat: ask-accountant Edge Function`.
- [ ] **Step 6: STOP — ask the user to approve deploying `ask-accountant`.**
  - Deploy via MCP `deploy_edge_function` with `verify_jwt: false` (the function checks the user itself), including the `_shared/accountant-core/*` files and `deno.json`.
  - Smoke test: an unsigned POST returns 401.
  - Tell the user to add the `GROQ_API_KEY` secret. Until then a signed-in call returns 503.

### Task 6: Server data and actions

**Files:**
- Create: `app/(app)/chat/actions.ts`
- Modify: `lib/data.ts`
- Test: `tests/accountant-data.test.ts` (pure mappers), e2e in Task 7

**Interfaces:**
- **In `lib/data.ts`:**
  - `getChats(): Promise<{ id; title; updatedAt; checkedCount; answerCount }[]>`. Not deleted; newest first.
  - `getChat(id): Promise<{ id; title; mask: MaskMap; messages: ChatMessage[] } | null>`
  - `getDeletedChats()`
  - `answersToday(): Promise<number>`. Assistant messages since midnight Malaysia time.
  - `getChatMessage(id)`, for the guide prefill.
  - `type ChatMessage = { id; role; content; answer: CheckedAnswer | null; checked: boolean; createdAt }`
- **In `actions.ts`** (Zod-validated; `revalidatePath("/chat")`):
  - `saveTurn(input: { chatId: string | null; userText: string; answer: CheckedAnswer; mask: MaskMap }): Promise<{ chatId: string; assistantMessageId: string } | { error: string }>`
    - Creates the chat when `chatId` is null. The title is the first 80 characters of userText.
    - Inserts both messages and updates `mask_map`.
    - The answer is stored unmasked: the client unmasks it before calling.
  - `setAnswerChecked(messageId, checked)`
  - `renameChat(id, title)`
  - `deleteChat(id)`, a soft delete
  - `restoreChat(id)`
  - `answerToGuideInput(answer: CheckedAnswer): Partial<GuideInput>`. A pure function in `lib/accountant/to-guide.ts`:
    - title from summary (≤300);
    - symptom = the user's scenario;
    - cause = summary;
    - steps = confirmed steps' text, with menu paths;
    - prevention = "";
    - tags `["accountant-chat"]`;
    - platform = desktop if only desktop steps, cloud if only cloud, else both;
    - the balanced entries appended to cause as `Journal: Dr … / Cr …`.
- [ ] **Step 1:** Tests for `answerToGuideInput`:
  - `only confirmed steps become guide steps`;
  - `platform both when steps for both`.
- [ ] **Step 2–4:** FAIL → implement → PASS; tsc and eslint clean.
- [ ] **Step 5: Commit** `Accountant chat: data and actions`.

### Task 7: Accountant chat page

**Files:**
- Create:
  - `app/(app)/chat/page.tsx` (list plus empty state)
  - `app/(app)/chat/[id]/page.tsx`
  - `components/chat/chat-view.tsx`
  - `components/chat/composer.tsx` (textarea, `Preview what's sent`, and the mask preview with `Hide selected text`)
  - `components/chat/answer-view.tsx`
  - `components/chat/chat-list.tsx`
  - `lib/accountant/client.ts` (`askAccountant(...)`, which calls `supabaseBrowser().functions.invoke("ask-accountant", …)` and maps errors to the fixed messages)
- Modify:
  - `components/shell/nav.ts` (`Accountant chat`, icon `MessagesSquare`, after Knowledge hub, in `notOnPhoneTabs`)
  - `app/(app)/guides/new/page.tsx` (`?fromChat=<messageId>` → `getChatMessage` → `answerToGuideInput` → `GuideForm prefill`)
  - `components/guides/guide-form.tsx` (the `prefillTitle` prop becomes `prefill?: Partial<GuideInput>`; update its callers)
  - `e2e/smoke.spec.ts` (route `/chat`)
- Test: `e2e/chat.spec.ts`. Stub `**/functions/v1/ask-accountant` with `page.route` and fixtures from `tests/fixtures/accountant/`.

**Behaviour:**
- **Send flow:** text → `Preview what's sent` shows the masked text, and the user may hide more → `Send`.
  - While waiting, show `Thinking…` and disable Send. The typed text stays in the box until the answer is saved.
- **Answer view (one card per assistant turn):**
  - `needsMoreInfo`: a numbered list under `A few questions first`.
  - Otherwise, two sections:
    - **For you:** summary, assumptions, entries (unbalanced ones in red with the fixed label), steps (Desktop and Cloud groups, each with a status badge: `Confirmed` / `From an unverified guide — check it` / `Not confirmed`), `needsAccountant` as a warning box, doubts, and sources with kind labels (`My guide` / `Knowledge hub` / `AutoCount help` / `Web`) and links.
    - **For the customer:** the reply text, the `I've checked the entry and steps` checkbox (calls `setAnswerChecked`), and then `Copy for the customer`.
  - A `Check before relying` badge on every answer.
  - `Save as guide` → `/guides/new?fromChat=<id>`.
- **Footer:** `N answers today`.
- **Phone width (390px):** no sideways scroll; long text breaks.

- [ ] **Step 1: Write the e2e tests** (read-only, stubbed):
  - `masks before sending`: type text with an IC and "Lee Trading Sdn Bhd", open the preview, and assert `[IC 1]` and `[COMPANY 1]` are shown. Assert the stub received a body without the originals.
  - `answer shows For you / For the customer and copy needs the tick`.
  - `questions-only answer shows no customer reply`.
  - `rate limit shows wait message and keeps text`.
  - `bad answer keeps the message`.
  - Write tests (gated): `chat is saved, listed, renamed, deleted and restored`; `save as guide prefills the form`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement, then run `npx next typegen`. **Step 4:** PASS at desktop and phone; tsc and eslint clean.
- [ ] **Step 5: Commit** `Accountant chat: chat page`.

### Task 8: Settings, search, bin (approval gate for purge-bin)

**Files:**
- Modify:
  - `app/(app)/settings/{page,actions}.tsx` and `components/settings/settings-view.tsx`:
    - an `Accountant chat` card with a `Model` text input (validated `^[\w./-]{1,100}$`);
    - a `Use web search when my sources don't cover it` switch, with the help text `Check in your Groq account that browser search is free for you before turning this on.`;
    - a `Deleted chats` list with Restore.
  - `app/(app)/search/{actions,page}.tsx` and `components/search/search-view.tsx`: a `Chats` section after Knowledge hub, using `search_accountant_chats`.
  - `supabase/functions/purge-bin/index.ts`: add `accountant_chats` (messages cascade).
- Test: `e2e/search.spec.ts` (odd characters still fine with the Chats section); `e2e/settings.spec.ts` (card visible; switch off by default)

- [ ] **Step 1:** Tests. **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS; tsc and eslint clean.
- [ ] **Step 5: Commit** `Accountant chat: settings, search and bin`.
- [ ] **Step 6: STOP — ask the user to approve redeploying `purge-bin`.** Deploy, then run it once: 200.

### Task 9: Live quality check, docs and handover

**Files:**
- Create: `evals/accountant.eval.ts`, `evals/scenarios.ts` (the spec's 10 scenarios, with expected `{ accountType, dr?, cr? }[]` per entry, or `mustAsk: true` for #1), `vitest.eval.config.ts` (includes only `evals/`; 120s timeout per test)
- Modify: `package.json` (`"eval:accountant": "vitest run --config vitest.eval.config.ts"`), `README.md` (an Accountant chat section; migrations up to 0012), `docs/GO-LIVE.md` (Groq setup)

**Interfaces:**
- The eval loads `.env.local` like `playwright.config.ts`, signs in with `E2E_EMAIL`/`E2E_PASSWORD` via supabase-js, and calls the deployed function. It fails clearly if the env vars are missing. It never prints them.
- **Per scenario:**
  - `parseAnswer` succeeds;
  - every entry is balanced;
  - the expected (type, amount) multiset is contained in the answer's lines (account names free);
  - #1 has `needsMoreInfo` and ≥2 questions;
  - #5 has `needsAccountant`;
  - no step is `confirmed` without a non-web source.
  
  Wait 8s between scenarios to stay under 8K tokens per minute.
- **`docs/GO-LIVE.md` steps for the user:**
  1. Create a free Groq key at console.groq.com.
  2. Supabase → Edge Functions → Secrets → `GROQ_API_KEY`.
  3. Groq → Settings → Data Controls → Zero Data Retention on.
  4. Check whether browser search is charged before turning on the web switch.
  5. Run `npm run eval:accountant`.

- [ ] **Step 1:** Write the eval and scenarios. Confirm `npx vitest run` (unit) does **not** pick up `evals/`.
- [ ] **Step 2:** Docs.
- [ ] **Step 3:** Run the full checks: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, and `npx playwright test` (read-only). Report the counts.
- [ ] **Step 4: Commit** `Accountant chat: live quality check and setup docs`.
- [ ] **Step 5: Hand over to the user:**
  - their setup steps;
  - `npm run eval:accountant`;
  - the write e2e run with `set E2E_ALLOW_WRITES=1`.
