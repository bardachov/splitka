export type Member = {
  name: string;
  createdAt: number;
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
