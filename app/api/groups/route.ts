import { NextRequest, NextResponse } from "next/server";
import { createGroup } from "@/lib/store";
import {
  cardError,
  CURRENCIES,
  MAX_GROUP_NAME_LEN,
  MAX_MEMBERS,
  MAX_NAME_LEN,
  nameKey,
  normalizeCard,
  normalizeName,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name = normalizeName(String(body?.name ?? ""));
    const currency = String(body?.currency ?? "UAH");
    const creator = normalizeName(String(body?.creator ?? ""));
    const creatorCard = normalizeCard(String(body?.creatorCard ?? ""));

    if (!name || name.length > MAX_GROUP_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть назву групи (до 50 символів)" }, { status: 400 });
    }
    if (!(CURRENCIES as readonly string[]).includes(currency)) {
      return NextResponse.json({ error: "Невідома валюта" }, { status: 400 });
    }
    if (!creator || creator.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть ваше ім'я (до 30 символів)" }, { status: 400 });
    }
    const badCreatorCard = cardError(creatorCard);
    if (badCreatorCard) {
      return NextResponse.json({ error: badCreatorCard }, { status: 400 });
    }

    // Optional list of friends added right at creation. A plain string is the
    // pre-card shape, still sent by clients running an older bundle.
    const rawMembers: unknown = body?.members ?? [];
    if (!Array.isArray(rawMembers)) {
      return NextResponse.json({ error: "Некоректний список учасників" }, { status: 400 });
    }
    const seen = new Set([nameKey(creator)]);
    const extras: { name: string; card: string }[] = [];
    for (const raw of rawMembers) {
      const entry =
        typeof raw === "string"
          ? { name: raw, card: "" }
          : { name: (raw as { name?: unknown })?.name, card: (raw as { card?: unknown })?.card };
      const member = normalizeName(String(entry.name ?? ""));
      if (!member) continue;
      if (member.length > MAX_NAME_LEN) {
        return NextResponse.json({ error: "Ім'я учасника задовге (до 30 символів)" }, { status: 400 });
      }
      const card = normalizeCard(String(entry.card ?? ""));
      const badCard = cardError(card);
      if (badCard) {
        return NextResponse.json({ error: badCard }, { status: 400 });
      }
      const key = nameKey(member);
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push({ name: member, card });
    }
    if (1 + extras.length > MAX_MEMBERS) {
      return NextResponse.json({ error: "Забагато учасників у групі" }, { status: 400 });
    }

    const now = Date.now();
    const group = await createGroup({
      name,
      currency,
      owner: creator,
      // Stagger createdAt so the member order is stable after re-assembly.
      // An absent card stays absent so card-less members serialize exactly as
      // they did before cards existed.
      members: [{ name: creator, card: creatorCard }, ...extras].map((m, i) => ({
        name: m.name,
        createdAt: now + i,
        ...(m.card ? { card: m.card } : {}),
      })),
      entries: [],
      createdAt: now,
    });
    return NextResponse.json({ id: group.id, creator }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не вдалося створити групу. Спробуйте ще раз." }, { status: 502 });
  }
}
