"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, RotateCcw } from "lucide-react";
import { restoreGuide } from "@/app/(app)/guides/actions";
import { restoreArticle } from "@/app/(app)/knowledge/actions";
import { restoreChat } from "@/app/(app)/chat/actions";
import type { KnowledgeArticle } from "@/lib/knowledge/model";
import { clearSearchHistory } from "@/app/(app)/insights/actions";
import { exportEverything, saveChatSettings, saveDisplayName } from "@/app/(app)/settings/actions";
import { downloadXlsx } from "@/lib/download-xlsx";
import { exportFileName } from "@/lib/export";
import { ACTIVITY_DAYS } from "@/lib/insights";
import { formatDate } from "@/lib/format";
import type { Guide } from "@/lib/types";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useIsOwner } from "@/components/shell/team-context";
import { PageHeader } from "@/components/shared/page-header";
import { OFFICIAL_SITES } from "@/lib/official-sites";

function Row({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="sm:justify-self-end">{children}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card px-4 sm:px-5" aria-label={title}>
      <h2 className="border-b py-3 font-medium">{title}</h2>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function ExportEverything() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await exportEverything();
          if (!res.ok) return void toast.error(res.error);
          await downloadXlsx(exportFileName("everything"), res.sheets);
          toast.success("Exported", { description: res.sheets.map((s) => `${s.name}: ${s.rows.length - 1}`).join(" · ") });
        } catch {
          toast.error("Couldn’t create the Excel file. Please try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : <Download />} Export to Excel
    </Button>
  );
}

function ClearSearchHistory({ count }: { count: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <span className="num text-sm text-muted-foreground">{count === 1 ? "1 search" : `${count} searches`}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={pending || count === 0}
        onClick={async () => {
          if (!confirm("Clear the whole team’s search history? Search gaps on Insights will start again from empty.")) return;
          setPending(true);
          const res = await clearSearchHistory();
          setPending(false);
          if (res.ok) {
            toast.success("Search history cleared");
            router.refresh();
          } else toast.error(res.error);
        }}
      >
        {pending && <Loader2 className="animate-spin" />} Clear team search history
      </Button>
    </div>
  );
}

function DeletedGuides({ guides }: { guides: Guide[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="py-4">
      <p className="text-sm font-medium">Deleted guides</p>
      <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">Guides you delete are kept here for 30 days so you can restore them.</p>
      {guides.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">The bin is empty.</p>
      ) : (
        <ul className="mt-3 divide-y rounded-md border bg-background">
          {guides.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
              <span className="min-w-0 flex-1 truncate">{g.title}</span>
              <span className="text-xs text-muted-foreground">deleted {g.deletedAt ? formatDate(g.deletedAt) : ""}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy === g.id}
                onClick={async () => {
                  setBusy(g.id);
                  const res = await restoreGuide(g.id);
                  setBusy(null);
                  if (res.ok) {
                    toast.success(`${g.id} restored`);
                    router.refresh();
                  } else toast.error(res.error);
                }}
              >
                {busy === g.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeletedArticles({ articles }: { articles: KnowledgeArticle[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="py-4">
      <p className="text-sm font-medium">Deleted Knowledge hub articles</p>
      <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">Kept here for 30 days so you can restore them, then removed for good overnight.</p>
      {articles.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">The bin is empty.</p>
      ) : (
        <ul className="mt-3 divide-y rounded-md border bg-background">
          {articles.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{a.title}</span>
              <span className="text-xs text-muted-foreground">deleted {a.deletedAt ? formatDate(a.deletedAt) : ""}</span>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Restore ${a.title}`}
                disabled={busy === a.id}
                onClick={async () => {
                  setBusy(a.id);
                  const res = await restoreArticle(a.id);
                  setBusy(null);
                  if (res.ok) {
                    toast.success(`“${a.title}” restored`);
                    router.refresh();
                  } else toast.error(res.error);
                }}
              >
                {busy === a.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatSettings({ initial }: { initial: { model: string; webSearch: boolean } }) {
  const router = useRouter();
  const [model, setModel] = useState(initial.model);
  const [webSearch, setWebSearch] = useState(initial.webSearch);
  const [saving, setSaving] = useState(false);

  async function save(next: { model: string; webSearch: boolean }) {
    setSaving(true);
    const res = await saveChatSettings(next);
    setSaving(false);
    if (!res.ok) {
      setWebSearch(initial.webSearch);
      return void toast.error(res.error);
    }
    toast.success("Chat settings saved");
    router.refresh();
  }

  return (
    <>
      <Row title="Model" description="The Groq model that answers. Change it only if Groq retires this one (they email you first).">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ model, webSearch });
          }}
        >
          <Input aria-label="Model" value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} className="font-mono text-xs" />
          <Button type="submit" variant="outline" disabled={saving || model.trim() === initial.model}>
            Save
          </Button>
        </form>
      </Row>
      <Row title="Use web search when my sources don’t cover it" description="Check in your Groq account that browser search is free for you before turning this on. Web results never supply AutoCount menu paths.">
        <Switch
          aria-label="Use web search when my sources don’t cover it"
          checked={webSearch}
          disabled={saving}
          onCheckedChange={(v) => {
            setWebSearch(v);
            void save({ model: initial.model, webSearch: v });
          }}
        />
      </Row>
    </>
  );
}

function DeletedChats({ chats }: { chats: { id: string; title: string; deletedAt: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="py-4">
      <p className="text-sm font-medium">Deleted chats</p>
      <p className="mt-0.5 max-w-[60ch] text-sm text-muted-foreground">Kept here for 30 days so you can restore them, then removed for good overnight.</p>
      {chats.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">The bin is empty.</p>
      ) : (
        <ul className="mt-3 divide-y rounded-md border bg-background">
          {chats.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="text-xs text-muted-foreground">deleted {formatDate(c.deletedAt)}</span>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Restore ${c.title}`}
                disabled={busy === c.id}
                onClick={async () => {
                  setBusy(c.id);
                  const res = await restoreChat(c.id);
                  setBusy(null);
                  if (res.ok) {
                    toast.success(`“${c.title}” restored`);
                    router.refresh();
                  } else toast.error(res.error);
                }}
              >
                {busy === c.id ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DisplayName({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <Row title="Your name" description="How teammates see you in “Last edited by”, edit history and the Team page.">
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const res = await saveDisplayName(name);
          setSaving(false);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Name saved");
          router.refresh();
        }}
      >
        <Input aria-label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <Button type="submit" variant="outline" disabled={saving || !name.trim() || name.trim() === initial}>
          Save
        </Button>
      </form>
    </Row>
  );
}

function AccountCard({ displayName }: { displayName: string }) {
  return (
    <Card title="Account">
      <DisplayName initial={displayName} />
      <Row title="Password" description="Change the password you use to sign in. If you forget it, use “Forgot password?” on the sign-in page.">
        <ButtonLink variant="outline" href="/reset-password">
          <KeyRound /> Change password
        </ButtonLink>
      </Row>
    </Card>
  );
}

export function SettingsView({
  deleted,
  deletedArticles,
  deletedChats,
  chat,
  indexed,
  searchesLogged,
  displayName,
}: {
  deleted: Guide[];
  deletedArticles: KnowledgeArticle[];
  deletedChats: { id: string; title: string; deletedAt: string }[];
  chat: { model: string; webSearch: boolean };
  indexed: { count: number; lastRefreshed: string | null };
  searchesLogged: number;
  displayName: string;
}) {
  const isOwner = useIsOwner();
  if (!isOwner) {
    return (
      <>
        <PageHeader title="Settings" description="Your chats and your account." />
        <div className="flex max-w-4xl flex-col gap-6">
          <Card title="Accountant chat">
            <DeletedChats chats={deletedChats} />
          </Card>
          <AccountCard displayName={displayName} />
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Settings" description="Account, official sources and your data." />
      <div className="flex max-w-4xl flex-col gap-6">
        <Card title="AI">
          <Row
            title="Only the Accountant chat uses AI"
            description="It sends your scenario to Groq’s free AI, with names, IC, bank and phone numbers hidden first. Everything else in the app (search, guides, the analyst calculator) works without AI. Turn on Zero Data Retention in Groq so nothing is kept there."
          >
            <span className="text-sm text-muted-foreground">Groq, free plan</span>
          </Row>
        </Card>

        <Card title="Accountant chat">
          <ChatSettings initial={chat} />
          <DeletedChats chats={deletedChats} />
        </Card>

        <Card title="Privacy">
          <Row title="Screenshots and files" description="Stored privately in your team’s storage bucket. Only approved team members can open them, through links that expire after 10 minutes.">
            <span className="text-sm text-muted-foreground">Private</span>
          </Row>
          <Row title="Meaning-based search" description="Guide text is turned into search vectors by a model running inside your own Supabase project. It isn’t sent to any other company.">
            <span className="text-sm text-muted-foreground">In your project</span>
          </Row>
          <Row
            title="Search history"
            description={`Everyone’s searches are logged for Insights (search gaps) and kept ${ACTIVITY_DAYS} days. Clearing removes the whole team’s history now; guide-open counts are kept.`}
          >
            <ClearSearchHistory count={searchesLogged} />
          </Row>
        </Card>

        <Card title="Official sources">
          <Row
            title="Help-centre index"
            description={`AutoCount’s help centres are read once a day from their published article lists (allowed by their robots.txt), then searched inside this app. Free; nothing to run on your PC.${indexed.lastRefreshed ? ` Last refreshed ${formatDate(indexed.lastRefreshed)}.` : ""}`}
          >
            <span className="text-sm text-muted-foreground">{indexed.count.toLocaleString()} articles</span>
          </Row>
          <div className="py-4">
            <p className="text-sm font-medium">Official websites</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Help centres are searched in the app. The AutoCount website and wiki are offered as Google searches limited to those sites.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {OFFICIAL_SITES.map((s) => (
                <li key={s.domain} className="inline-flex h-7 items-center rounded-md border bg-background px-2 font-mono text-xs" title={s.label}>
                  {s.domain}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <AccountCard displayName={displayName} />

        <Card title="Your data">
          <Row title="Export everything" description="Guides, analyses, SOPs, templates and Knowledge hub articles as one Excel file, one sheet each. Items in the bin aren’t included.">
            <ExportEverything />
          </Row>
          <DeletedGuides guides={deleted} />
          <DeletedArticles articles={deletedArticles} />
          <Row title="Backups" description="Supabase takes a daily backup of the database. The README explains how to restore it.">
            <span className="text-sm text-muted-foreground">Daily</span>
          </Row>
        </Card>
      </div>
    </>
  );
}
