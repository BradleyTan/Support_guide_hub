"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, RotateCcw } from "lucide-react";
import { restoreGuide } from "@/app/(app)/guides/actions";
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

export function SettingsView({ deleted, indexed }: { deleted: Guide[]; indexed: { count: number; lastRefreshed: string | null } }) {
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
          <Row title="Export everything" description="All guides, analyses and templates as one Excel file.">
            <Button variant="outline" onClick={() => toast("Export is mocked")}>
              <Download /> Export to Excel
            </Button>
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
