"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw, UserMinus, Users, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { approveMember, reapproveMember, rejectMember, removeMember, type ActionResult } from "@/app/(app)/team/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { TeamMemberRow } from "@/lib/team-rules";

type Groups = { pending: TeamMemberRow[]; approved: TeamMemberRow[]; inactive: TeamMemberRow[] };
type Action = (id: string) => Promise<ActionResult>;

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border bg-card">
      <h2 className="flex items-center gap-2 border-b px-4 py-3 font-medium sm:px-5">
        {title} <span className="num text-sm font-normal text-muted-foreground">{count}</span>
      </h2>
      {count === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">Nobody here.</p> : <ul className="divide-y">{children}</ul>}
    </section>
  );
}

function Person({ p, children }: { p: TeamMemberRow; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{p.displayName || p.email || "Unnamed"}</p>
        <p className="truncate text-sm text-muted-foreground">
          {p.email} · signed up {formatDate(p.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </li>
  );
}

function Act({
  label,
  icon: Icon,
  loading,
  disabled,
  onClick,
  variant = "outline",
}: {
  label: string;
  icon: LucideIcon;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <Button variant={variant} size="sm" disabled={disabled} onClick={onClick}>
      {loading ? <Loader2 className="animate-spin" /> : <Icon />} {label}
    </Button>
  );
}

export function TeamView({ groups }: { groups: Groups }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(p: TeamMemberRow, key: string, action: Action, done: string) {
    setBusy(`${p.userId}:${key}`);
    try {
      const res = await action(p.userId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(done);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const act = (p: TeamMemberRow, key: string, label: string, icon: LucideIcon, action: Action, done: string, variant?: "default" | "outline") => (
    <Act label={label} icon={icon} loading={busy === `${p.userId}:${key}`} disabled={busy !== null} variant={variant} onClick={() => run(p, key, action, done)} />
  );

  const empty = groups.pending.length + groups.approved.length + groups.inactive.length === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Team" description="Choose who can use the Support Desk. Removing someone never deletes the work they added." />
      {empty ? (
        <EmptyState icon={Users} title="No one else has signed up yet">
          When a colleague creates an account, they will appear here waiting for your approval.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <Section title="Waiting for approval" count={groups.pending.length}>
            {groups.pending.map((p) => (
              <Person key={p.userId} p={p}>
                {act(p, "approve", "Approve", Check, approveMember, "Approved", "default")}
                {act(p, "reject", "Reject", X, rejectMember, "Rejected")}
              </Person>
            ))}
          </Section>
          <Section title="Team" count={groups.approved.length}>
            {groups.approved.map((p) => (
              <Person key={p.userId} p={p}>
                {act(p, "remove", "Remove access", UserMinus, removeMember, "Access removed")}
              </Person>
            ))}
          </Section>
          <Section title="Removed or rejected" count={groups.inactive.length}>
            {groups.inactive.map((p) => (
              <Person key={p.userId} p={p}>
                {act(p, "again", "Approve again", RotateCcw, reapproveMember, "Approved")}
              </Person>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}
