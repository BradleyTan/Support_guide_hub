"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, Loader2, RotateCcw, X } from "lucide-react";
import { restoreGuide } from "@/app/(app)/guides/actions";
import { formatDate } from "@/lib/format";
import type { Guide } from "@/lib/types";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { OFFICIAL_SITES } from "@/lib/official-sites";

const MODELS = [
  { value: "claude-opus-5-5", label: "Claude Opus 5.5 (best reasoning)" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5 (fast, lower cost)" },
];

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

function ModelSelect({ id, defaultValue }: { id: string; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <Select value={v} onValueChange={(x) => setV(String(x))}>
      <SelectTrigger id={id} className="w-full bg-card sm:w-72">
        <SelectValue>{(x: string) => MODELS.find((m) => m.value === x)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MODELS.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

export function SettingsView({ deleted }: { deleted: Guide[] }) {
  const [mask, setMask] = useState(true);
  const [domains, setDomains] = useState<string[]>(OFFICIAL_SITES.map((s) => s.domain));
  const [newDomain, setNewDomain] = useState("");

  return (
    <>
      <PageHeader
        title="Settings"
        description="AI, privacy, official sources and your data."
        howItWorks={<>Settings are saved to your account. API keys are set on the server (Vercel environment variables) and are never shown or stored here.</>}
      />
      <div className="flex max-w-4xl flex-col gap-6">
        <Card title="AI">
          <Row title="Accounting analyst model" description="Used for journal entries and accounting treatment.">
            <ModelSelect id="m-analyst" defaultValue="claude-opus-5-5" />
          </Row>
          <Row title="Everything else" description="Reading screenshots, drafting guides, replies and search answers.">
            <ModelSelect id="m-other" defaultValue="claude-sonnet-5" />
          </Row>
        </Card>

        <Card title="Privacy">
          <Row title="Mask sensitive data before AI calls" description="Replaces company names, IC numbers (e.g. 900101-14-5678) and bank account numbers with placeholders before text or images are sent to the AI.">
            <Switch checked={mask} onCheckedChange={setMask} aria-label="Mask sensitive data before AI calls" />
          </Row>
          <Row title="Screenshots and files" description="Stored privately in your own storage bucket. Only you can open them, through links that expire after 10 minutes.">
            <span className="text-sm text-muted-foreground">Private</span>
          </Row>
        </Card>

        <Card title="Official sources">
          <Row title="Search engine" description="SearXNG (free, open source). Runs on your PC in Docker for now; a free host is chosen before go-live.">
            <Input defaultValue="http://localhost:8080" aria-label="SearXNG address" className="bg-background font-mono text-sm sm:w-72" />
          </Row>
          <div className="py-4">
            <p className="text-sm font-medium">Allowed websites</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Official search only returns pages from these sites, including the Accounting and HRMS help centres.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {domains.map((d) => (
                <li key={d} className="inline-flex h-7 items-center gap-1 rounded-md border bg-background pr-1 pl-2 font-mono text-xs">
                  {d}
                  <Button size="icon-xs" variant="ghost" aria-label={`Remove ${d}`} onClick={() => setDomains((p) => p.filter((x) => x !== d))}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
                  toast.error("That doesn’t look like a website address", { description: "Use a form like help.autocountsoft.com" });
                  return;
                }
                setDomains((p) => [...new Set([...p, d])]);
                setNewDomain("");
              }}
            >
              <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="Add a website, e.g. help.example.com" aria-label="Add allowed website" className="bg-background sm:w-72" />
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
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
