import { describe, expect, it } from "vitest";
import { autoMask, hideSelection, unmask } from "@/lib/accountant/core/mask";

describe("autoMask", () => {
  it("masks IC, bank, phone, email, company", () => {
    const input = "Lee Trading Sdn Bhd, IC 900101-14-5678, acct 5140 1234 5678, 012-345 6789, a@b.com";
    const { text, map } = autoMask(input, {});
    for (const p of ["[COMPANY 1]", "[IC 1]", "[BANK 1]", "[PHONE 1]", "[EMAIL 1]"]) expect(text).toContain(p);
    for (const real of ["Lee Trading Sdn Bhd", "900101-14-5678", "5140 1234 5678", "012-345 6789", "a@b.com"]) {
      expect(text).not.toContain(real);
      expect(Object.values(map)).toContain(real);
    }
  });

  it("does not mask money or dates", () => {
    const input = "RM5,000.00 on 12/03/2024, invoice IV-00123, USD1,000 at 4.40";
    expect(autoMask(input, {}).text).toBe(input);
  });

  it("does not mask a big ringgit amount as a bank number", () => {
    expect(autoMask("RM 1234567890 paid", {}).text).toBe("RM 1234567890 paid");
  });

  it("reuses placeholders across turns", () => {
    const first = autoMask("ABC Sdn Bhd paid a deposit", {});
    const second = autoMask("ABC Sdn Bhd paid again", first.map);
    expect(first.text).toBe("[COMPANY 1] paid a deposit");
    expect(second.text).toBe("[COMPANY 1] paid again");
    expect(Object.keys(second.map)).toHaveLength(1);
  });

  it("numbers different values of one kind separately", () => {
    const { text } = autoMask("ABC Sdn Bhd and XYZ Berhad", {});
    expect(text).toBe("[COMPANY 1] and [COMPANY 2]");
  });
});

describe("hideSelection", () => {
  it("hides any text the user picks, everywhere it appears", () => {
    const { text, map } = hideSelection("Mr Tan called. Mr Tan wants a refund.", "Mr Tan", {});
    expect(text).toBe("[HIDDEN 1] called. [HIDDEN 1] wants a refund.");
    expect(map["[HIDDEN 1]"]).toBe("Mr Tan");
  });

  it("manual hide inside an auto span keeps one placeholder", () => {
    const masked = autoMask("Lee Trading Sdn Bhd owes RM500", {});
    // The user selects part of the original company name; the masked text no longer contains it.
    const again = hideSelection(masked.text, "Lee Trading", masked.map);
    expect(again.text).toBe("[COMPANY 1] owes RM500");
    expect(Object.keys(again.map)).toHaveLength(1);
  });

  it("hiding text that already contains a placeholder still unmasks fully", () => {
    const first = hideSelection("Ali and his wife Siti paid", "Ali", {});
    const second = hideSelection(first.text, "[HIDDEN 1] and his wife Siti", first.map);
    expect(second.text).toBe("[HIDDEN 2] paid");
    expect(unmask(second.text, second.map)).toBe("Ali and his wife Siti paid");
  });

  it("ignores blank or placeholder-only selections", () => {
    const masked = autoMask("ABC Sdn Bhd", {});
    expect(hideSelection(masked.text, "  ", masked.map).text).toBe("[COMPANY 1]");
    expect(hideSelection(masked.text, "[COMPANY 1]", masked.map).map).toEqual(masked.map);
  });
});

describe("unmask", () => {
  it("unmask round-trips", () => {
    const input = "Lee Trading Sdn Bhd (IC 900101145678) paid RM5,000; call 0123456789";
    const { text, map } = autoMask(input, {});
    expect(unmask(text, map)).toBe(input);
  });

  it("does not confuse [COMPANY 1] with [COMPANY 10]", () => {
    const map: Record<string, string> = {};
    for (let i = 1; i <= 10; i++) map[`[COMPANY ${i}]`] = `Co${i}`;
    expect(unmask("[COMPANY 10] then [COMPANY 1]", map)).toBe("Co10 then Co1");
  });
});

describe("whole words only", () => {
  it("a short hidden name is not replaced inside longer words", () => {
    const { text, map } = hideSelection("Tan bought a Tangible asset. Ask Tan.", "Tan", {});
    expect(text).toBe("[HIDDEN 1] bought a Tangible asset. Ask [HIDDEN 1].");
    expect(autoMask("Tangible fixed assets for Tan", map).text).toBe("Tangible fixed assets for [HIDDEN 1]");
  });
});
