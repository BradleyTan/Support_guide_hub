import { describe, expect, it } from "vitest";
import { canUseApp, isOwner, type Membership } from "@/lib/team-rules";

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
