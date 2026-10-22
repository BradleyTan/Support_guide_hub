import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { modelAnswerJsonSchema, parseAnswer } from "@/lib/accountant/core/answer";

const okRaw = readFileSync("tests/fixtures/accountant/answer-ok.json", "utf8");

/** Minimal JSON-Schema checker for the subset Groq strict mode uses (object/array/string/number/boolean/null/enum). */
function conforms(schema: Record<string, unknown>, value: unknown): boolean {
  const type = schema.type as string | string[] | undefined;
  const types = Array.isArray(type) ? type : type ? [type] : [];
  const typeOf = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? "number" : typeof v);
  if (types.length && !types.includes(typeOf(value)) && !(types.includes("integer") && Number.isInteger(value))) return false;
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) return false;
  if (typeOf(value) === "object") {
    const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const obj = value as Record<string, unknown>;
    for (const k of (schema.required ?? []) as string[]) if (!(k in obj)) return false;
    if (schema.additionalProperties === false && Object.keys(obj).some((k) => !(k in props))) return false;
    return Object.entries(obj).every(([k, v]) => !props[k] || conforms(props[k], v));
  }
  if (typeOf(value) === "array" && schema.items) return (value as unknown[]).every((v) => conforms(schema.items as Record<string, unknown>, v));
  return true;
}

describe("parseAnswer", () => {
  it("parseAnswer accepts a fixture", () => {
    const r = parseAnswer(okRaw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.answer.entries[0].lines).toHaveLength(3);
  });

  it("parseAnswer rejects string amounts", () => {
    const bad = JSON.parse(okRaw);
    bad.entries[0].lines[0].dr = "1,000.00";
    expect(parseAnswer(JSON.stringify(bad)).ok).toBe(false);
  });

  it("parseAnswer rejects non-JSON", () => {
    const r = parseAnswer("Sure! Here is the answer: ...");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON/);
  });

  it("rejects more than 5 questions and an unknown account type", () => {
    const many = { ...JSON.parse(okRaw), needsMoreInfo: true, questions: ["a", "b", "c", "d", "e", "f"] };
    expect(parseAnswer(JSON.stringify(many)).ok).toBe(false);
    const badType = JSON.parse(okRaw);
    badType.entries[0].lines[0].accountType = "cash";
    expect(parseAnswer(JSON.stringify(badType)).ok).toBe(false);
  });
});

describe("JSON schema for Groq", () => {
  it("json schema and zod schema agree", () => {
    expect(conforms(modelAnswerJsonSchema as Record<string, unknown>, JSON.parse(okRaw))).toBe(true);
    const missing = JSON.parse(okRaw);
    delete missing.customerMessage;
    expect(conforms(modelAnswerJsonSchema as Record<string, unknown>, missing)).toBe(false);
    expect(parseAnswer(JSON.stringify(missing)).ok).toBe(false);
  });

  it("is strict-mode ready: every object lists all its properties as required and forbids extras", () => {
    const walk = (s: Record<string, unknown>) => {
      if (s.type === "object") {
        expect(s.additionalProperties).toBe(false);
        expect(new Set(s.required as string[])).toEqual(new Set(Object.keys(s.properties as object)));
        Object.values(s.properties as Record<string, Record<string, unknown>>).forEach(walk);
      }
      if (s.items) walk(s.items as Record<string, unknown>);
    };
    walk(modelAnswerJsonSchema as Record<string, unknown>);
  });
});
