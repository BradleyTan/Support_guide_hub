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
