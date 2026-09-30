# Support Desk for AutoCount

A personal guidelines tool for an AutoCount support consultant: a searchable library of your own fixes and how-tos, unified search across official AutoCount sources, an accounting analyst (journal entries + AutoCount steps + SST / e-Invoice notes), client reply drafts and SOP export. Tickets stay in Zoho Desk.

> **Status: Phase 0 prototype.** All data is sample data. There is no database, no AI calls, no web search and no login yet.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3001.

- **Preview state** (top bar): switch any screen between *With data*, *Empty*, *Loading* and *Error*.
- **Keyboard:** `Ctrl K` command palette · `/` search · `N` new guide.

## Checks

```bash
npm test        # lint + type-check + Playwright smoke tests (desktop and phone)
npm run build   # production build
```

## Structure

| Path | What |
|---|---|
| `app/(app)/` | One folder per screen (guides, search, analyst, replies, sop, templates, releases, settings) |
| `components/shell/` | Sidebar, phone tab bar, command palette, preview-state switcher |
| `components/shared/` | Page header + “How this works” note, smart text/image input, badges, empty/loading/error states |
| `lib/types.ts` | Domain types. These become the Phase 1 database schema |
| `lib/mock/` | Sample guides, analyses, templates and release notes |
| `e2e/` | Playwright smoke tests |

Setup for Supabase, the Anthropic API, SearXNG, environment variables, backups and deployment is added in later phases.
