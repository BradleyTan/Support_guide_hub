export type Membership = {
  role: "owner" | "member";
  status: "pending" | "approved" | "rejected" | "removed";
  displayName: string;
};

/** Only approved members may use the app. */
export function canUseApp(m: Membership | null): boolean {
  return m?.status === "approved";
}

/** True only for an approved owner. */
export function isOwner(m: Membership | null): boolean {
  return m?.status === "approved" && m.role === "owner";
}

/** Waiting-page copy. No membership row (e.g. confirmed before the trigger existed) reads as pending. */
export function getMembershipStatusCopy(m: Membership | null, ownerName: string): { heading: string; body: string | null } {
  if (m?.status === "rejected" || m?.status === "removed") return { heading: "You don't have access", body: null };
  return {
    heading: "Waiting for approval",
    body: `${ownerName} needs to approve your account before you can use the Support Desk. Refresh this page once you've been told you're in.`,
  };
}

/** Error copy returned by server actions when the caller fails the membership gate. */
export const MEMBER_ONLY_ERROR = "Only approved team members can do this.";
export const OWNER_ONLY_ERROR = "Only the owner can do this.";

/** One row of the Team page. */
export type TeamMemberRow = {
  userId: string;
  email: string | null;
  displayName: string;
  role: Membership["role"];
  status: Membership["status"];
  createdAt: string;
};

const byName = (a: TeamMemberRow, b: TeamMemberRow) =>
  (a.displayName || a.email || "").localeCompare(b.displayName || b.email || "", undefined, { sensitivity: "base" });

/** Splits people for the Team page. The owner is never listed. Pending: oldest first. Team: by name. Inactive: newest first. */
export function groupMembers(rows: TeamMemberRow[]): { pending: TeamMemberRow[]; approved: TeamMemberRow[]; inactive: TeamMemberRow[] } {
  const people = rows.filter((r) => r.role !== "owner");
  return {
    pending: people.filter((r) => r.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    approved: people.filter((r) => r.status === "approved").sort(byName),
    inactive: people.filter((r) => r.status === "rejected" || r.status === "removed").sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
