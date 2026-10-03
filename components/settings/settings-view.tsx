"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, RotateCcw } from "lucide-react";
import { restoreGuide } from "@/app/(app)/guides/actions";
import { clearSearchHistory } from "@/app/(app)/insights/actions";
import { exportEverything } from "@/app/(app)/settings/actions";
import { downloadXlsx } from "@/lib/download-xlsx";
import { exportFileName } from "@/lib/export";
import { ACTIVITY_DAYS } from "@/lib/insights";
import { formatDate } from "@/lib/format";
import type { Guide } from "@/lib/types";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
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
          if (!confirm("Clear all of your search history? Search gaps on Insights will start again from empty.")) return;
          setPending(true);
          const res = await clearSearchHistory();
          setPending(false);
          if (res.ok) {
            toast.success("Search history cleared");
            router.refresh();
          } else toast.error(res.error);
        }}
      >
        {pending && <Loader2 className="animate-spin" />} Clear search history
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

export function SettingsView({ deleted, indexed, searchesLogged }: { deleted: Guide[]; indexed: { count: number; lastRefreshed: string | null }; searchesLogged: number }) {
  return (
    <>
      <PageHeader title="Settings" description="Account, official sources and your data." />
      <div className="flex max-w-4xl flex-col gap-6">
        <Card title="AI">
          <Row title="AI features are off" description="You chose not to use AI for now: no guide drafting, AI search answers or accounting analysis. Nothing is sent to an AI service. Turning AI on later needs your approval and an Anthropic API key.">
            <span className="text-sm text-muted-foreground">Off</span>
          </Row>
        </Card>

        <Card title="Privacy">
          <Row title="Screenshots and files" description="Stored privately in your own storage bucket. Only you can open them, through links that expire after 10 minutes.">
            <span className="text-sm text-muted-foreground">Private</span>
          </Row>
          <Row title="Meaning-based search" description="Guide text is turned into search vectors by a model running inside your own Supabase project. It isn’t sent to any other company.">
            <span className="text-sm text-muted-foreground">In your project</span>
          </Row>
          <Row
            title="Search history"
            description={`Your searches are logged for Insights (search gaps) and kept ${ACTIVITY_DAYS} days. Only you can see them. Clearing removes all of them now; guide-open counts are kept.`}
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

        <Card title="Account">
          <Row title="Password" description="Change the password you use to sign in. If you forget it, use “Forgot password?” on the sign-in page.">
            <ButtonLink variant="outline" href="/reset-password">
              <KeyRound /> Change password
            </ButtonLink>
          </Row>
        </Card>

        <Card title="Your data">
          <Row title="Export everything" description="Guides, analyses, SOPs and templates as one Excel file, one sheet each. Items in the bin aren’t included.">
            <ExportEverything />
          </Row>
          <DeletedGuides guides={deleted} />
          <Row title="Backups" description="Supabase takes a daily backup of the database. The README explains how to restore it.">
            <span className="text-sm text-muted-foreground">Daily</span>
          </Row>
        </Card>
      </div>
    </>
  );
}
