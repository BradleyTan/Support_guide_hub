import { describe, expect, it } from "vitest";
import { BACKUP_MODEL, backupFor, classifyGroqFailure } from "@/lib/accountant/core/groq-errors";

const tpd = "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` on tokens per day (TPD): Limit 200000, Used 199800, Requested 2100. Please try again in 7m12.5s.";
const tpm = "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 7000, Requested 2100. Please try again in 9.3s.";

describe("classifyGroqFailure", () => {
  it("tells today's limit apart from the per-minute limit", () => {
    expect(classifyGroqFailure(429, tpd)).toBe("daily_limit");
    expect(classifyGroqFailure(429, tpm)).toBe("rate_limited");
    expect(classifyGroqFailure(429, "Rate limit reached ... on requests per day (RPD): Limit 1000")).toBe("daily_limit");
  });

  it("names a missing or rejected key", () => {
    expect(classifyGroqFailure(401, "Invalid API Key")).toBe("not_configured");
    expect(classifyGroqFailure(403, "")).toBe("not_configured");
  });

  it("names a question or chat too long for the model", () => {
    expect(classifyGroqFailure(413, "Request too large")).toBe("too_long");
    expect(classifyGroqFailure(400, "Please reduce the length of the messages or completion. maximum context length is 131072 tokens")).toBe("too_long");
  });

  it("names Groq being down or slow", () => {
    expect(classifyGroqFailure(503, "Service Unavailable")).toBe("groq_down");
    expect(classifyGroqFailure(500, "")).toBe("groq_down");
    expect(classifyGroqFailure(504, "timeout")).toBe("groq_timeout");
  });

  it("leaves anything else as a general Groq error", () => {
    expect(classifyGroqFailure(400, "Some other problem")).toBe("groq_error");
  });
});

describe("backupFor", () => {
  it("offers the backup model when the main one is used up for the day", () => {
    expect(backupFor("openai/gpt-oss-120b")).toBe(BACKUP_MODEL);
  });

  it("offers nothing when the backup model is already the one in use", () => {
    expect(backupFor(BACKUP_MODEL)).toBeNull();
  });
});
