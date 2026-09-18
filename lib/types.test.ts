import { describe, expect, it } from "vitest";
import { cardError, findMember, formatCard, nameKey, normalizeCard, normalizeName } from "./types";

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

describe("findMember", () => {
  const members = [
    { name: "Оля", createdAt: 1 },
    { name: "Анна Марія", createdAt: 2 },
  ];

  it("finds a member regardless of case", () => {
    expect(findMember(members, "ОЛЯ")?.name).toBe("Оля");
  });

  it("finds a member whose whitespace differs", () => {
    expect(findMember(members, "  анна   марія ")?.name).toBe("Анна Марія");
  });

  it("returns undefined for a stranger and for an empty name", () => {
    expect(findMember(members, "Петро")).toBeUndefined();
    expect(findMember(members, "")).toBeUndefined();
  });
});

// A valid card is 16 digits passing Luhn. 5375 4112 3456 7894 is a Luhn-valid
// Mastercard-shaped test number; ...7890 is the same digits with a bad check.
const VALID = "5375411234567894";

describe("normalizeCard", () => {
  it("keeps only digits", () => {
    expect(normalizeCard("5375 4112 3456 7894")).toBe(VALID);
    expect(normalizeCard("5375-4112-3456-7894")).toBe(VALID);
  });

  it("drops anything that is not a digit", () => {
    expect(normalizeCard("картка: 5375")).toBe("5375");
  });

  it("truncates past 16 digits so a slip cannot store a longer value", () => {
    expect(normalizeCard(VALID + "999")).toBe(VALID);
  });

  it("maps an empty or digitless string to empty", () => {
    expect(normalizeCard("")).toBe("");
    expect(normalizeCard("   ")).toBe("");
  });
});

describe("formatCard", () => {
  it("groups a full number into blocks of four", () => {
    expect(formatCard(VALID)).toBe("5375 4112 3456 7894");
  });

  it("groups a partial number without a trailing space", () => {
    expect(formatCard("5375")).toBe("5375");
    expect(formatCard("53754")).toBe("5375 4");
    expect(formatCard("")).toBe("");
  });
});

describe("cardError", () => {
  it("accepts a Luhn-valid 16-digit number", () => {
    expect(cardError(VALID)).toBeNull();
  });

  it("rejects a number that is not 16 digits", () => {
    expect(cardError("537541123456789")).toBe("Номер картки — 16 цифр");
    expect(cardError("5375")).toBe("Номер картки — 16 цифр");
  });

  it("rejects a 16-digit number failing the Luhn check", () => {
    expect(cardError("5375411234567890")).toBe("Перевірте номер картки");
    expect(cardError("4149499312345678")).toBe("Перевірте номер картки");
  });

  it("accepts an empty value — the card is optional", () => {
    expect(cardError("")).toBeNull();
  });
});
