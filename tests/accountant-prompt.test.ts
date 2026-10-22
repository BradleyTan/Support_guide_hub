import { describe, expect, it } from "vitest";
import type { Source } from "@/lib/accountant/core/answer";
import { buildMessages, SYSTEM_PROMPT } from "@/lib/accountant/core/prompt";

const source = (id: string, text: string): Source => ({ id, kind: "my-guide", title: `Guide ${id}`, url: "https://x.test", platform: "desktop", checked: true, text });

describe("buildMessages", () => {
  it("caps total source text at 12,000 chars and numbers sources S1..", () => {
    const sources = [source("a", "x".repeat(5000)), source("b", "y".repeat(5000)), source("c", "z".repeat(5000)), source("d", "w".repeat(5000))];
    const { messages, sources: out } = buildMessages({ history: [], message: "Hi", sources, map: {} });
    expect(out.map((s) => s.id)).toEqual(["S1", "S2", "S3", "S4"].slice(0, out.length));
    const all = messages.map((m) => m.content).join("\n");
    expect(all).toContain("[S1]");
    const total = out.reduce((n, s) => n + s.text.length, 0);
    expect(total).toBeLessThanOrEqual(12_000);
    expect(out[0].text.length).toBeLessThanOrEqual(3_000);
  });

  it("never includes an unmasked value", () => {
    const { messages, map } = buildMessages({ history: [], message: "Customer [COMPANY 1] asks", sources: [source("a", "Refund for IC 900101-14-5678 at Lee Trading Sdn Bhd")], map: { "[COMPANY 1]": "Lee Trading Sdn Bhd" } });
    const all = messages.map((m) => m.content).join("\n");
    expect(all).not.toContain("900101-14-5678");
    expect(all).not.toContain("Lee Trading");
    expect(Object.keys(map)).toContain("[IC 1]");
    expect(map["[COMPANY 1]"]).toBe("Lee Trading Sdn Bhd");
  });

  it("puts the system prompt first, then history, then the message with sources", () => {
    const { messages } = buildMessages({ history: [{ role: "user", content: "Earlier" }, { role: "assistant", content: "Reply" }], message: "Now", sources: [], map: {} });
    expect(messages[0]).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(messages.slice(1, 3).map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages.at(-1)!.role).toBe("user");
    expect(messages.at(-1)!.content).toContain("Now");
    expect(messages.at(-1)!.content).toMatch(/no sources/i);
  });

  it("the system prompt covers the safety rules", () => {
    for (const phrase of [/at most 5/i, /source id/i, /customerMessage/i, /needsAccountant/i, /as of/i, /Malaysia/i]) expect(SYSTEM_PROMPT).toMatch(phrase);
  });
});
