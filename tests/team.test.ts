import { describe, expect, it } from "vitest";
import { canUseApp, editorNameFor, groupMembers, isOwner, type Membership, type TeamMemberRow } from "@/lib/team-rules";

const make = (role: Membership["role"], status: Membership["status"]): Membership => ({ role, status, displayName: "Sam" });

describe("canUseApp", () => {
  it("is true only for approved members", () => {
    expect(canUseApp(make("member", "approved"))).toBe(true);
    expect(canUseApp(make("owner", "approved"))).toBe(true);
    expect(canUseApp(make("member", "pending"))).toBe(false);
    expect(canUseApp(make("member", "rejected"))).toBe(false);
    expect(canUseApp(make("member", "removed"))).toBe(false);
    expect(canUseApp(null)).toBe(false);
  });
});

describe("isOwner", () => {
  it("is true only for an approved owner", () => {
    expect(isOwner(make("owner", "approved"))).toBe(true);
    expect(isOwner(make("owner", "removed"))).toBe(false);
    expect(isOwner(make("owner", "pending"))).toBe(false);
    expect(isOwner(make("member", "approved"))).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});

describe("groupMembers", () => {
  const row = (id: string, status: TeamMemberRow["status"], createdAt: string, name = "", role: TeamMemberRow["role"] = "member"): TeamMemberRow => ({
    userId: id,
    email: `${id}@example.com`,
    displayName: name,
    role,
    status,
    createdAt,
  });

  it("splits by status and keeps the owner out of the lists", () => {
    const g = groupMembers([
      row("a", "pending", "2026-01-02T00:00:00Z"),
      row("b", "approved", "2026-01-01T00:00:00Z", "Bea"),
      row("c", "rejected", "2026-01-03T00:00:00Z"),
      row("d", "removed", "2026-01-04T00:00:00Z"),
      row("o", "approved", "2026-01-01T00:00:00Z", "Owner", "owner"),
    ]);
    expect(g.pending.map((r) => r.userId)).toEqual(["a"]);
    expect(g.approved.map((r) => r.userId)).toEqual(["b"]);
    expect(g.inactive.map((r) => r.userId).sort()).toEqual(["c", "d"]);
  });

  it("lists pending oldest first and approved by name", () => {
    const g = groupMembers([
      row("late", "pending", "2026-02-02T00:00:00Z"),
      row("early", "pending", "2026-02-01T00:00:00Z"),
      row("z", "approved", "2026-01-01T00:00:00Z", "Zed"),
      row("a", "approved", "2026-01-02T00:00:00Z", "amy"),
      row("noname", "approved", "2026-01-03T00:00:00Z", ""),
    ]);
    expect(g.pending.map((r) => r.userId)).toEqual(["early", "late"]);
    expect(g.approved.map((r) => r.userId)).toEqual(["a", "noname", "z"]);
  });
});

describe("editorNameFor", () => {
  const rows = [
    { user_id: "u1", display_name: "  Max Member " },
    { user_id: "u2", display_name: "   " },
  ];
  it("returns the trimmed name of a readable team row", () => {
    expect(editorNameFor("u1", rows)).toBe("Max Member");
  });
  it("falls back to 'a teammate' for a hidden row or a blank name", () => {
    expect(editorNameFor("u3", rows)).toBe("a teammate");
    expect(editorNameFor("u2", rows)).toBe("a teammate");
  });
  it("has no name when the editor's account was deleted", () => {
    expect(editorNameFor(null, rows)).toBeUndefined();
  });
});
