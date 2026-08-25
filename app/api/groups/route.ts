import { NextRequest, NextResponse } from "next/server";
import { createGroup } from "@/lib/store";
import {
  CURRENCIES,
  MAX_GROUP_NAME_LEN,
  MAX_MEMBERS,
  MAX_NAME_LEN,
  nameKey,
  normalizeName,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name = normalizeName(String(body?.name ?? ""));
    const currency = String(body?.currency ?? "UAH");
    const creator = normalizeName(String(body?.creator ?? ""));

    if (!name || name.length > MAX_GROUP_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть назву групи (до 50 символів)" }, { status: 400 });
    }
    if (!(CURRENCIES as readonly string[]).includes(currency)) {
      return NextResponse.json({ error: "Невідома валюта" }, { status: 400 });
    }
    if (!creator || creator.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть ваше ім'я (до 30 символів)" }, { status: 400 });
    }

    // Optional list of friend names added right at creation.
    const rawMembers: unknown = body?.members ?? [];
    if (!Array.isArray(rawMembers)) {
      return NextResponse.json({ error: "Некоректний список учасників" }, { status: 400 });
    }
    const seen = new Set([nameKey(creator)]);
    const extras: string[] = [];
    for (const raw of rawMembers) {
      const member = normalizeName(String(raw));
      if (!member) continue;
      if (member.length > MAX_NAME_LEN) {
        return NextResponse.json({ error: "Ім'я учасника задовге (до 30 символів)" }, { status: 400 });
      }
      const key = nameKey(member);
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push(member);
    }
    if (1 + extras.length > MAX_MEMBERS) {
      return NextResponse.json({ error: "Забагато учасників у групі" }, { status: 400 });
    }

    const now = Date.now();
    const group = await createGroup({
      name,
      currency,
      // Stagger createdAt so the member order is stable after re-assembly.
      members: [creator, ...extras].map((m, i) => ({ name: m, createdAt: now + i })),
      entries: [],
      createdAt: now,
    });
    return NextResponse.json({ id: group.id, creator }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Не вдалося створити групу. Спробуйте ще раз." }, { status: 502 });
  }
}
