import { describe, expect, it } from "vitest";
import { nameKey, normalizeName } from "./types";

// Characterization: these two helpers define member identity across the whole
// app — every lookup, dedupe and Redis field name is derived from them.

describe("normalizeName", () => {
  it("trims the edges", () => {
    expect(normalizeName("  Оля  ")).toBe("Оля");
  });

  it("collapses inner whitespace runs into one space", () => {
    expect(normalizeName("Анна   Марія")).toBe("Анна Марія");
    expect(normalizeName("Анна\t\nМарія")).toBe("Анна Марія");
  });

  it("preserves case", () => {
    expect(normalizeName("ОЛЯ")).toBe("ОЛЯ");
  });

  it("maps a whitespace-only string to empty", () => {
    expect(normalizeName("   ")).toBe("");
  });
});

describe("nameKey", () => {
  it("is case-insensitive for Ukrainian", () => {
    expect(nameKey("Оля")).toBe(nameKey("ОЛЯ"));
    expect(nameKey("оля")).toBe(nameKey("Оля"));
  });

  it("normalizes before lowercasing", () => {
    expect(nameKey("  Анна   Марія ")).toBe(nameKey("анна марія"));
  });

  it("keeps distinct names distinct", () => {
    expect(nameKey("Оля")).not.toBe(nameKey("Олена"));
  });
});
