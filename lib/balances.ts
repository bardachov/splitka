import type { Entry, Group } from "./types";

/**
 * Split an integer amount (minor units) equally among n participants.
 * The first `amount % n` participants get one extra minor unit.
 */
export function equalShares(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Net balance per member, in minor units.
 * Positive = the group owes this member (they are owed money).
 * Negative = this member owes the group.
 */
export function computeNetBalances(group: Group): Map<string, number> {
  const net = new Map<string, number>();
  for (const m of group.members) net.set(m.name, 0);

  const add = (name: string, delta: number) => {
    net.set(name, (net.get(name) ?? 0) + delta);
  };

  for (const e of group.entries) {
    const participants = e.splitAmong.filter((p) => net.has(p));
    if (!net.has(e.paidBy) || participants.length === 0) continue;
    add(e.paidBy, e.amount);
    const shares = equalShares(e.amount, participants.length);
    participants.forEach((p, i) => add(p, -shares[i]));
  }
  return net;
}

export type Transfer = { from: string; to: string; amount: number };

/**
 * Greedy debt simplification: who should pay whom to settle all balances.
 */
export function simplifyDebts(net: Map<string, number>): Transfer[] {
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];
  for (const [name, balance] of net) {
    if (balance < 0) debtors.push({ name, amount: -balance });
    else if (balance > 0) creditors.push({ name, amount: balance });
  }
  debtors.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  creditors.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transfers;
}

export function totalSpent(group: Group): number {
  return group.entries
    .filter((e: Entry) => e.type === "expense")
    .reduce((sum, e) => sum + e.amount, 0);
}
