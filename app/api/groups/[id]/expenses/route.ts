import { NextRequest, NextResponse } from "next/server";
import { getGroup, saveGroup } from "@/lib/store";
import {
  Entry,
  MAX_AMOUNT,
  MAX_DESC_LEN,
  MAX_ENTRIES,
  nameKey,
  normalizeName,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);

    const type = body?.type === "settlement" ? "settlement" : "expense";
    const description = normalizeName(String(body?.description ?? ""));
    const amount = Number(body?.amount);
    const paidBy = normalizeName(String(body?.paidBy ?? ""));
    const splitAmongRaw: unknown = body?.splitAmong;

    if (type === "expense" && (!description || description.length > MAX_DESC_LEN)) {
      return NextResponse.json({ error: "Вкажіть опис витрати (до 80 символів)" }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: "Некоректна сума" }, { status: 400 });
    }
    if (!Array.isArray(splitAmongRaw) || splitAmongRaw.length === 0) {
      return NextResponse.json({ error: "Оберіть, між ким ділити" }, { status: 400 });
    }

    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    if (group.entries.length >= MAX_ENTRIES) {
      return NextResponse.json({ error: "Досягнуто ліміт записів у групі" }, { status: 400 });
    }

    const byKey = new Map(group.members.map((m) => [nameKey(m.name), m.name]));
    const payer = byKey.get(nameKey(paidBy));
    if (!payer) {
      return NextResponse.json({ error: "Платник не є учасником групи" }, { status: 400 });
    }
    const splitAmong: string[] = [];
    for (const raw of splitAmongRaw) {
      const member = byKey.get(nameKey(normalizeName(String(raw))));
      if (!member) {
        return NextResponse.json({ error: "Серед учасників поділу є хтось не з групи" }, { status: 400 });
      }
      if (!splitAmong.includes(member)) splitAmong.push(member);
    }
    if (type === "settlement" && (splitAmong.length !== 1 || splitAmong[0] === payer)) {
      return NextResponse.json({ error: "Переказ має одного отримувача, не платника" }, { status: 400 });
    }

    const entry: Entry = {
      id: crypto.randomUUID(),
      type,
      description: type === "settlement" ? description || "Переказ" : description,
      amount,
      paidBy: payer,
      splitAmong,
      createdAt: Date.now(),
    };
    group.entries.push(entry);
    await saveGroup(group);
    return NextResponse.json(group, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}
