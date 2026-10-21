# Knowledge hub: design

Date: 21 Oct 2026 · App: AutoCount Support Desk (`autocount-support`, Next.js 16 + Supabase) · Status: awaiting the user's approval

## Why

The user is an AutoCount support consultant. On client calls they often need to explain an accounting idea (debtor aging, a debtor statement, opening balances, bank reconciliation…) to a client who isn't an accountant, and they want to understand these ideas well themselves. Today the app has the user's own troubleshooting guides and a scenario calculator, but nothing that explains the accounting concepts behind AutoCount in plain words.

The Knowledge hub is a private library of short articles, each one explaining one accounting idea simply enough that the user can **read the top of it and immediately tell the customer**.

## Who it's for

- The user alone. Everything stays private to their account, like guides (Row Level Security, `user_id = auth.uid()`).
- Reader profile: someone who may not know accounting. Plain English, short sentences, no jargon without an explanation.
- Used mid-call: the first thing on an article must be usable straight away.

## Goals

1. About 38 starter articles covering everyday AutoCount **accounting** topics (list below), written in plain English with a Malaysian context (RM, SST, e-Invoice/MyInvois, LHDN).
2. Each article opens with a **"Tell the customer"** block: 2–3 plain sentences the user can say or paste to a client, with a copy button.
3. Under that, the details, in this order:
   - **What it is**: a short plain explanation for the user.
   - **Example**: a small worked example in RM (e.g. an aging table with three customers).
   - **In AutoCount**: where to find or do it (menu path, report name), in two labelled parts because the user's clients use **both**:
     - **Desktop** (AutoCount Accounting 2.x)
     - **Cloud** (AutoCount Cloud Accounting)

     Every menu path is marked **Needs verification** until the user confirms it, the same rule the Accounting analyst uses. Never invent a menu path. Where no source gives one (expected often for Desktop, since the readable sources are mostly the Cloud help centres), say "Not found in a source yet — add it once checked" so the user can fill it in. A Cloud path is never shown as if it were the Desktop path.
   - **Common mistakes**: what clients typically get wrong.
   - **Related topics**: links to other articles.
   - **Sources**: links to where the information came from (see Sources and accuracy).
4. Articles are **editable** by the user (all sections), and the user can **add their own** articles. Soft delete with the existing 30-day bin, covered by the nightly `purge-bin` job.
5. A **Reviewed** flag per article, like the Verified flag on guides. Starter articles start as "Not reviewed yet".
6. Easy to find:
   - a Knowledge hub page with categories and a filter box;
   - articles appear in the main **Search** page;
   - articles appear in the **Ctrl K** command palette.

## Non-goals (for now)

- Payroll topics (EPF, SOCSO, EIS, PCB). Accounting only.
- Sharing with colleagues, public links, or multiple users. Private, one user.
- Any AI. No AI writes, rewrites or answers anything at run time; nothing is sent to an AI service.
- The accountant/audit chatbot (possibly via Groq's free tier). That is a separate, later project.
- Translations (BM / 中文). English only, matching the app.

## Anti-goals (would make this a failure even if it works)

- Wrong or made-up AutoCount menu paths presented as fact.
- Explanations a non-accountant can't follow, or that are long walls of text.
- Out-of-date Malaysian tax facts (SST rates, e-Invoice phases) stated without a date or source.
- Articles appearing without the user asking (starter articles are added only when the user clicks a button).
- Breaking or slowing existing features (guides, search, Insights, exports, the bin).

## Starter topic list (accounting only)

- **Basics:** debit & credit, chart of accounts, journal entry, financial year & periods, opening balance, year-end closing.
- **Customers (AR):** invoice vs cash sale, credit note & debit note, receiving payment & knock-off, AR deposit, contra, debtor statement, debtor aging.
- **Suppliers (AP):** purchase invoice, supplier payment, supplier deposit, creditor aging.
- **Bank & cash:** bank reconciliation, petty cash, post-dated cheques.
- **Stock:** costing methods (FIFO, weighted average), stock take & stock adjustment, stock valuation.
- **Reports:** trial balance, profit & loss, balance sheet, general ledger, cash flow statement.
- **Tax:** SST (sales tax vs service tax), e-Invoice & TIN, withholding tax.
- **Period-end:** accruals & prepayments, depreciation, bad debts, foreign currency gain/loss, locking past periods.

(About 38 articles. The builder may merge or split a topic if it reads better, keeping the list's coverage.)

## Sources and accuracy

- Research each article from the official AutoCount help centres (`help.accounting.autocountcloud.com`, `help.hrms.autocountcloud.com`), the AutoCount website and wiki (`autocountsoft.com`, `wiki.autocountsoft.com`), LHDN / Royal Malaysian Customs for tax facts, and reputable accounting references.
- **Respect each site's rules:** honour robots.txt (the help centres' `/support/search` is disallowed and must not be used; their article pages are allowed). Earlier, the wiki returned HTTP 403 to automated fetches, so don't work around that block; cite wiki pages only if they can be read normally.
- Every article lists its sources (title + URL). Tax facts carry an "as of" date (e.g. "Service tax 8% from 1 Mar 2024").
- AutoCount Cloud help-centre pages describe the cloud product; menus can differ from desktop AutoCount. Say so where it matters, and keep menu paths marked Needs verification.
- Starter content is written once by Claude during the build (not at run time), and stored as data in the repo so it's reviewable in a diff. The user reviews articles in the app and ticks Reviewed.

## How it fits the existing app

- New sidebar item **Knowledge hub** in the Guidelines group (on phone: under More, like Insights).
- Storage: a new private table for articles (one migration, which needs the user's approval before it's applied). Fields cover: title, category, the "Tell the customer" text, what it is, example, AutoCount steps (with a verified flag per path, or per article), common mistakes, related articles, sources, a reviewed flag, timestamps and soft delete. Exact columns are left to the builder.
- Starter articles live in code (e.g. `lib/knowledge/`), each with a stable slug and a content version.
- **Adding starter articles** (decided by Claude; the user can change it):
  - An **Add starter articles** button is shown on the empty hub, and stays available afterwards (e.g. in the page header).
  - It lists the starter articles the user doesn't currently have; the user ticks which to add. Nothing is ever added without that choice, so an article the user deleted (in the bin or already purged) never comes back by itself.
  - An article in the bin counts as existing; restoring it is done from the bin, not by re-adding.
  - The user's edits are never overwritten.
- **Later corrections to starter text** (decided by Claude): each article records which starter version it came from and whether the user has edited it. When the repo's starter text is newer and the user hasn't edited that article, the article shows a small "Newer version available" note with an **Update** button. Edited articles are never offered an update.
- Search: hub articles appear as their own section on the Search page, matched by words and similar spelling at least (the same approach as guides). Meaning-based matching via the existing `embed` function is optional, the builder's call.
- Exports: add a "Knowledge hub" sheet to Settings → Export everything.
- The bin (decided by Claude): deleted articles get their own list under Settings (next to Deleted guides) and are restorable for 30 days. `purge-bin` is extended to remove them afterwards; that is an Edge Function redeploy, which needs the user's approval when it comes up.
- Insights: search gaps stay based on guides only (decided by Claude).
- Follow existing patterns: server actions with Zod validation, RLS on every table, security-invoker SQL functions, `PageHeader` + "How this works" note, empty/loading/error states, phone layout without sideways scrolling.

## Constraints

- Free: no new paid services. Supabase free plan, Netlify free plan.
- Every significant action needs the user's explicit "yes" first: package installs, migrations, Edge Function deploys, pushes. Approval doesn't carry over.
- Tests for the feature (unit, browser, SQL/RLS), lint and type-check clean, local commit, short report with results. Write tests run only when the user starts them (`E2E_ALLOW_WRITES=1`); the session can't run them.
- Never reproduce copyrighted text: articles are written in our own words; sources are linked, not copied.

## Left to the builder

- Exact table columns, slugs, and how related articles are stored.
- Page layout details within the existing design system (shadcn/ui on Base UI, Tailwind v4).
- Whether search uses meaning vectors as well as words/spelling.
- The precise wording of each article, within the rules above.
