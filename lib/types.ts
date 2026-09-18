export type Member = {
  name: string;
  createdAt: number;
  /** Where to send this person money: 16 digits, no spaces. Absent for
   *  members who joined before cards existed, or who never set one. */
  card?: string;
};

export type EntryType = "expense" | "settlement";

export type Entry = {
  id: string;
  type: EntryType;
  description: string;
  /** Amount in minor units (kopiykas/cents) */
  amount: number;
  /** Member name of who paid */
  paidBy: string;
  /** Member names among whom the amount is split (for settlement: the single recipient) */
  splitAmong: string[];
  createdAt: number;
  updatedAt?: number;
};

export type Group = {
  id: string;
  name: string;
  currency: string;
  /** Creator's member name; groups stored before this field existed fall back to the first member. */
  owner: string;
  members: Member[];
  entries: Entry[];
  createdAt: number;
};

export const CURRENCIES = ["UAH", "USD", "EUR", "PLN"] as const;

export const MAX_NAME_LEN = 30;
export const CARD_DIGITS = 16;
export const MAX_DESC_LEN = 80;
export const MAX_GROUP_NAME_LEN = 50;
export const MAX_MEMBERS = 50;
export const MAX_ENTRIES = 500;
/** 100 million minor units (1,000,000.00) */
export const MAX_AMOUNT = 100_000_000;

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function nameKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase("uk-UA");
}

/** Members are looked up by name, ignoring case and stray whitespace. */
export function findMember(
  members: Member[],
  name: string
): Member | undefined {
  return members.find((m) => nameKey(m.name) === nameKey(name));
}

/* ---------- card numbers ---------- */

/**
 * The canonical form: digits only. This is what gets stored and what lands on
 * the clipboard — banking apps always accept a bare number, not always a
 * spaced one.
 */
export function normalizeCard(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CARD_DIGITS);
}

/** Display form: 5375411234567894 → "5375 4112 3456 7894". */
export function formatCard(card: string): string {
  return card.replace(/(.{4})(?=.)/g, "$1 ");
}

function passesLuhn(card: string): boolean {
  let sum = 0;
  for (let i = 0; i < card.length; i++) {
    let n = Number(card[card.length - 1 - i]);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** null when acceptable. An empty card is acceptable — the field is optional. */
export function cardError(card: string): string | null {
  if (!card) return null;
  if (card.length !== CARD_DIGITS || /\D/.test(card)) {
    return `Номер картки — ${CARD_DIGITS} цифр`;
  }
  if (!passesLuhn(card)) return "Перевірте номер картки";
  return null;
}
