# Accountant chat — design

Date: 22 Oct 2026. Status: draft, awaiting the user's approval.

## Intent

The user is an AutoCount support consultant and the only user of this app. Customers bring them accounting scenarios that aren't simple "how do I" questions, for example: *"Customer received an AR deposit 2 years ago but never opened an AR deposit in AutoCount. Now they want to knock it off against last month's invoice."*

The user wants an **accountant advisor that knows AutoCount**. They type the scenario, and it:
- asks the right questions when facts are missing;
- explains what's going on;
- gives the double entry;
- gives the AutoCount steps;
- gives a reply they can copy and send to the customer.

The answer is sent to customers almost as is. So the two failures that hurt most are a **wrong journal entry** and **wrong AutoCount steps**. Everything below is shaped by that.

This is the first AI feature in the app. The app has been "no AI" until now, and the user asked for this one explicitly. It uses **Groq's free tier only**. Nothing may cost money.

## Goals

1. Answer scenario questions like an accountant, with AutoCount knowledge, at about 10 scenarios a day plus follow-ups.
2. Use the best sources first, and show which were used, with links:
   1. the user's own guides;
   2. their Knowledge hub articles;
   3. the AutoCount help centres;
   4. the web, as a last resort.
3. Ask clarifying questions instead of guessing when key facts are missing.
4. Never send a customer an unbalanced entry, or a menu path no source states.
5. Hide personal data before anything leaves the app.
6. Save chats, and let a good answer become a guide.

## Non-goals (v1)

- Screenshots or files in chats. Text only.
- Languages other than English.
- Payroll, HR or POS scenarios. Accounting only, matching the Knowledge hub. The chatbot may still answer, but the test set and prompts target accounting.
- Replacing the existing Analyst calculator. It stays as is.
- Chats in the Excel export.
- Multiple users or sharing.

## Anti-goals (a failure even if it "works")

- A customer reply containing an entry where debits don't equal credits.
- A customer reply containing a menu path that no source states, or a Cloud path presented as a Desktop path.
- A menu path taken from a general website.
- Internal notes leaking into the customer reply, such as "low confidence", placeholders like `[COMPANY 1]`, or source debates.
- Real names, IC numbers or bank numbers reaching Groq.
- Any paid plan, card on file or paid API.
- Confident answers on judgement calls. Examples: restating a prior year that has already been audited, or tax treatment that needs an accountant's sign-off. These must say to check with the customer's accountant or auditor.

## Decided with the user

- **Groq free tier.** Model `openai/gpt-oss-120b`. Free limits (Groq docs, 22 Oct 2026):
  - 30 requests a minute and 1,000 a day;
  - 8,000 tokens a minute and 200,000 a day.
  - At about 4–6K tokens per answer, that's roughly one answer a minute and 30–40 a day. The user needs about 10 a day.
- **Source order:** own guides → Knowledge hub → AutoCount help centres → web. Each source in the answer is labelled with its kind and a link.
- **Answer shape:**
  - clarifying questions, when needed;
  - a plain explanation;
  - journal entries that balance;
  - AutoCount steps, with Desktop and Cloud kept separate;
  - a ready-to-send customer reply;
  - a "check before relying" label.
- **Split view:** a "For you" part (reasoning, entries, sources, doubts) and a "For the customer" part (clean reply only).
- **Copy gate:** the "Copy for the customer" button appears only after the user ticks "I've checked the entry and steps" on that answer.
- **Masking before sending:**
  - Done automatically for IC numbers, bank account numbers, phone numbers, email addresses, and company names ending in Sdn Bhd, Berhad, Bhd, Enterprise, Trading, Sdn. Bhd. and similar.
  - The user sees a preview of exactly what Groq will receive, with placeholders like `[COMPANY 1]` and `[IC 1]`. They can select any other text, such as a person's name, and hide it too.
  - The answer is unmasked on screen, so the customer reply reads normally.
  - This runs in the browser.
- **Saved chats:**
  - private;
  - listed and searchable;
  - shown in the main search;
  - follow-ups allowed in the same chat;
  - deleting sends a chat to the bin, which the existing purge-bin auto-empties after 30 days.
- **Save as guide:** opens the normal new-guide form, prefilled from the answer. The user reviews and saves it, and it starts Unverified. Saved guides then become the top source for similar scenarios.
- **Test set:** I draft 10 common scenarios with expected entries (below). The user corrects them before they're used.

## Research findings (22 Oct 2026, Groq docs)

- **Groq Compound** (the old web-search system) was shut down on 21 Sep 2026. Don't use it.
- **Built-in `browser_search`:**
  - Supported on `openai/gpt-oss-120b`, powered by Exa.
  - Groq's docs don't say whether it's free on the free tier. **The user must check in their Groq console before it's switched on.**
  - It's not compatible with structured outputs, so it can only be a separate first step.
- **Data:**
  - By default, Groq doesn't retain inference data.
  - It may log inputs and outputs for up to 30 days, for reliability or abuse checks.
  - Zero Data Retention can be switched on in Data Controls. **The user switches this on** (setup step in the README/GO-LIVE).

## How it works

### Flow

1. The user types a scenario on the **Accountant chat** page.
2. The browser masks it and shows the preview. The user can hide more text, then presses Send.
3. The browser calls a Supabase Edge Function, `ask-accountant`, with the user's session. It doesn't go through Netlify, because Netlify free functions time out at about 10 seconds. The request sends:
   - the masked message;
   - the masked earlier turns of this chat.
4. The Edge Function gathers sources, as the signed-in user, so RLS applies:
   - the top guides, via the existing guide search;
   - the top Knowledge hub articles (`search_knowledge`);
   - the top AutoCount help-centre pages (`search_official_pages`). For the top 2–3, it fetches the article page text live, so a menu path can be read from the page itself. Only `/support/solutions/articles/*` URLs are fetched (robots.txt), with the existing user agent.
   - Optional: web snippets via Groq `browser_search`, only when the web setting is on and the sources above are thin. "Thin" is the builder's call. Web results may inform the explanation and entries, but **never** supply menu paths.
5. The Edge Function sends one structured-output call to Groq, with the sources numbered, and validates the result (schema below).
6. Code checks run on the result (next section). Anything that fails is moved out of the customer reply and flagged in "For you".
7. The answer goes back to the browser. The browser unmasks it, shows it, and saves the turn.

### The code checks (not the AI)

- **Entries:**
  - Each entry must have debits equal to credits, to the sen, and every amount must be positive.
  - Every line names one account type from a fixed list: asset, liability, equity, income, expense.
  - An entry that fails is shown as "didn't balance — not sent to the customer" and is removed from the customer reply.
- **Menu paths:**
  - A step with a menu path must cite a source of kind `my-guide`, `knowledge` or `official`.
  - The cited text must actually contain that path. Matching is loose: ignore case, spacing and `>` vs `→`.
  - Otherwise, the path is removed and the step says "Menu path not confirmed — I'll confirm the exact menu."
  - The customer reply is rebuilt or edited to match.
- **Desktop vs Cloud:** a step is labelled Desktop or Cloud by its source.
  - Help-centre pages are Cloud.
  - Knowledge articles keep the paths separately (`desktop_steps` / `cloud_steps`).
  - Guides get a new **platform** field: Desktop, Cloud or Both (decided with the user). A "Both" guide can support either kind of step.
  - A Cloud source can't support a Desktop step.
- **Leaks:**
  - The customer reply must not contain placeholders that failed to unmask, or internal markers.
  - Only allow-listed text from the "For you" side reaches the customer reply.
- **Clarifying questions:** if the model says key facts are missing, the turn shows the questions only, at most 5, with no entries and no customer reply. The user answers them in a follow-up.

### Answer schema (shape; exact field names are the builder's)

- `needsMoreInfo`: boolean.
- `questions[]`
- `summary`: what's going on, in plain words.
- `assumptions[]`
- `entries[]`: `{ date?, description, lines[{ account, accountType, dr?, cr? }] }`
- `steps`: `{ desktop[], cloud[] }`, each step `{ text, menuPath?, sourceIds[] }`.
- `customerReply`
- `needsAccountant`: a note, if it's a judgement call.
- `doubts[]`
- `sources[]`: `{ id, kind: my-guide | knowledge | official | web, title, url }`

Reuse ideas from `lib/analysis-schema.ts` where they fit, but don't force the old 7-section shape.

### Limits and errors

- On Groq 429, show "Groq's free limit is busy — try again in N seconds", using `retry-after`.
- On other failures, keep the user's message and let them retry. Nothing is lost.
- Show today's count of answers in the page footer, for example "8 answers today". It's counted locally from saved turns.

## Data (new migration 0012)

- **`accountant_chats`:**
  - `user_id`, `title` (from the first message; editable), timestamps, `deleted_at`, `fts`;
  - `mask_map jsonb`: placeholder → real value, kept so follow-ups reuse the same placeholders.
- **`accountant_messages`:**
  - `chat_id`, `role` (user | assistant);
  - `content`: the user's text, stored **unmasked** so it's readable and searchable;
  - `answer jsonb`: assistant turns, unmasked;
  - `checked boolean`: the copy-gate tick;
  - `created_at`.
- **`guides.platform`:** `desktop | cloud | both`, not null.
  - Existing guides are backfilled with a best guess from their text: the word "Cloud" or a help-centre link means cloud; otherwise desktop.
  - The guide form, the import (a new optional column), the export and the guide page show it.
  - The user corrects guesses over time.
- Owner RLS on both, like every other table. Messages are reached through their chat.
- A search function for chats, used by the main search page (a new "Chats" section).
- Add both tables to `purge-bin`. That needs a redeploy, with approval.
- **The DB is private to the user.** Masking protects what goes to Groq, not what's stored.

## Settings

- Model name (default `openai/gpt-oss-120b`), so a Groq deprecation is a one-field change.
- "Use web search when my sources don't cover it": **off by default**. The user turns it on after confirming in Groq that it's free for them.
- Masking is always on. There's no off switch, since the user chose to hide data.

## Secrets and setup (the user does these; I never handle keys)

- The user creates a free Groq API key.
- They add it as Supabase Edge Function secret `GROQ_API_KEY` in the dashboard.
- They switch on Zero Data Retention in Groq Data Controls.
- They check whether browser search is charged on the free tier.
- The key never reaches the browser or Netlify.
- Steps go in `docs/GO-LIVE.md` and the README.

## Test set (draft — the user must correct before use)

Amounts in RM unless stated. "Expected" lists the entry the answer must contain (account names may vary; account types and amounts must match), or the questions it must ask.

1. **Old deposit never recorded, knock off last month's invoice.** A customer paid a RM5,000 deposit 2 years ago. It was never keyed in as an AR deposit. They now want it set against last month's invoice of RM5,000.
   - Expected: **ask first.** Where did the RM5,000 go when it was banked: suspense, other income, a receipt to the debtor, or not recorded at all? Is that financial year closed or audited?
   - If it's in suspense: Dr Suspense (liability/asset) 5,000 / Cr Debtor (asset) 5,000.
   - Flag `needsAccountant` if it went to income in an audited year.
2. **Customer short-paid because of bank charges.** Invoice RM1,000; RM990 received; RM10 deducted by the bank.
   - Dr Bank 990, Dr Bank charges (expense) 10 / Cr Debtor 1,000.
3. **Customer overpaid, refund the extra.** Invoice RM2,000; RM2,500 received; RM500 refunded.
   - Receipt: Dr Bank 2,500 / Cr Debtor 2,500.
   - Refund: Dr Debtor 500 / Cr Bank 500.
4. **Credit note on a service invoice with 8% service tax.** Invoice RM1,000 + RM80 SST; RM200 discount given after invoicing.
   - Dr Service revenue (income) 200, Dr SST payable (liability) 16 / Cr Debtor 216.
   - SST credit-note conditions are dated "as of" and sourced, or flagged.
5. **Bad debt write-off.** A customer owes RM3,000 and has closed down; no allowance was made earlier.
   - Dr Bad debts (expense) 3,000 / Cr Debtor 3,000.
   - Mention tax deductibility needs the accountant (`needsAccountant`).
   - Decided 23 Oct 2026: asking first (which year, whether it is closed or audited, any part payment) is also acceptable.
6. **Contra: a customer who is also a supplier.** They owe us RM5,000; we owe them RM3,000; offset.
   - Dr Creditor (liability) 3,000 / Cr Debtor (asset) 3,000.
7. **Supplier deposit, then the purchase invoice.** Paid a RM2,000 deposit; later received a RM8,000 invoice; deposit applied.
   - Deposit: Dr Supplier deposit (asset) 2,000 / Cr Bank 2,000.
   - Invoice: Dr Purchases (expense) 8,000 / Cr Creditor 8,000.
   - Apply: Dr Creditor 2,000 / Cr Supplier deposit 2,000.
8. **Foreign-currency receipt at a different rate.** USD1,000 invoice at 4.40 (RM4,400); paid when the rate was 4.30 (RM4,300).
   - Dr Bank 4,300, Dr Realised forex loss (expense) 100 / Cr Debtor 4,400.
9. **Annual insurance paid in advance.** RM12,000 paid on 1 Oct; year end 31 Dec.
   - Payment: Dr Prepayment (asset) 12,000 / Cr Bank 12,000.
   - 31 Dec: Dr Insurance (expense) 3,000 / Cr Prepayment 3,000.
10. **Electricity bill not yet received at month end.** Estimated RM800.
    - Dr Utilities (expense) 800 / Cr Accruals (liability) 800.
    - Reverse next month when the bill arrives.

The test runs as a separate script against the live Groq API, about 10 calls, using the user's key from their machine. It's **not** part of CI or `npm test`, because it uses the free quota and needs the key. It checks:
- the right account types and amounts;
- balance;
- questions on scenario 1;
- no unsourced menu paths.

The user runs it before go-live and after any prompt or model change.

## Left to the builder

- The prompt wording, how many sources go in, and token budgeting to stay under 8K tokens a minute.
- How "thin sources" is decided for the optional web step.
- The page layout, within the app's existing patterns: chat list plus open chat; a "For you" / "For the customer" split; the masking preview.
- How "Save as guide" hands the prefill to the guide form.
- Unit tests for masking, the code checks and schema parsing, using recorded fixtures, so `npm test` never calls Groq. Playwright tests that stub the Edge Function.
- Whether the help-centre page fetch is cached.

## My calls (the user can override)

- The page is called **Accountant chat** and sits in the sidebar next to the Knowledge hub.
- It runs in a Supabase Edge Function, not on Netlify, because of the timeout.
- Chats are stored unmasked in the user's private DB.
- The web step is off by default until the user confirms it's free.
- Clarifying questions replace the answer, rather than coming with a provisional one.
- Chats are not in the Excel export in v1.
- **Sources are masked too.** Guide and Knowledge text is pulled in on the server, so the Edge Function runs the same automatic masking rules (shared code) on it before calling Groq, and merges the placeholders into the chat's `mask_map`. Person names inside guides can't be caught automatically. The send preview shows the user's own text exactly, with a line saying that matching guides are masked by the same rules.
- **Only checked sources can confirm a menu path:**
  - verified guides;
  - Knowledge articles marked "steps verified";
  - AutoCount help-centre pages.
  An unverified guide can still inform the explanation, but a path taken from it is shown as "from an unverified guide — check it" and is left out of the customer reply. This stops a saved, unchecked answer from confirming itself later.
- **The live test calls the deployed `ask-accountant` function, signed in as the e2e test account** (credentials the user already keeps in `.env.local`). So the whole pipeline is tested, and the Groq key stays only in Supabase.
