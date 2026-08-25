import { NextResponse } from "next/server";
import { createGroup, getGroup } from "@/lib/store";
import { computeNetBalances, simplifyDebts } from "@/lib/balances";

export const dynamic = "force-dynamic";

/**
 * Health-check / smoke test: creates a demo group with two members and two
 * expenses, re-reads it from storage, and returns the computed balances.
 */
export async function GET() {
  try {
    const now = Date.now();
    const group = await createGroup({
      name: "Демо: Поїздка в Карпати",
      currency: "UAH",
      members: [
        { name: "Артем", createdAt: now },
        { name: "Оля", createdAt: now },
      ],
      entries: [
        {
          id: crypto.randomUUID(),
          type: "expense",
          description: "Вечеря в колибі",
          amount: 90000,
          paidBy: "Артем",
          splitAmong: ["Артем", "Оля"],
          createdAt: now,
        },
        {
          id: crypto.randomUUID(),
          type: "expense",
          description: "Продукти",
          amount: 60000,
          paidBy: "Оля",
          splitAmong: ["Артем", "Оля"],
          createdAt: now + 1,
        },
      ],
      createdAt: now,
    });

    const readBack = await getGroup(group.id);
    if (!readBack) throw new Error("Read-back failed");

    const net = computeNetBalances(readBack);
    const transfers = simplifyDebts(net);

    return NextResponse.json({
      ok: true,
      groupPath: `/g/${readBack.id}`,
      members: readBack.members.map((m) => m.name),
      entries: readBack.entries.length,
      net: Object.fromEntries(net),
      transfers,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 502 }
    );
  }
}
