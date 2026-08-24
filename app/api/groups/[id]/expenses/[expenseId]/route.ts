import { NextRequest, NextResponse } from "next/server";
import { getGroup, saveGroup } from "@/lib/store";
import {
  MAX_AMOUNT,
  MAX_DESC_LEN,
  nameKey,
  normalizeName,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;
    const body = await req.json().catch(() => null);

    const description = normalizeName(String(body?.description ?? ""));
    const amount = Number(body?.amount);
    const paidBy = normalizeName(String(body?.paidBy ?? ""));
    const splitAmongRaw: unknown = body?.splitAmong;

    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: "Некоректна сума" }, { status: 400 });
    }
    if (!Array.isArray(splitAmongRaw) || splitAmongRaw.length === 0) {
      return NextResponse.json({ error: "Оберіть, між ким ділити" }, { status: 400 });
    }
    if (description.length > MAX_DESC_LEN) {
      return NextResponse.json({ error: "Опис задовгий (до 80 символів)" }, { status: 400 });
    }

    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    const entry = group.entries.find((e) => e.id === expenseId);
    if (!entry) {
      return NextResponse.json({ error: "Запис не знайдено" }, { status: 404 });
    }

    if (entry.type === "expense" && !description) {
      return NextResponse.json({ error: "Вкажіть опис витрати" }, { status: 400 });
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
    if (entry.type === "settlement" && (splitAmong.length !== 1 || splitAmong[0] === payer)) {
      return NextResponse.json({ error: "Переказ має одного отримувача, не платника" }, { status: 400 });
    }

    entry.description = entry.type === "settlement" ? description || "Переказ" : description;
    entry.amount = amount;
    entry.paidBy = payer;
    entry.splitAmong = splitAmong;
    entry.updatedAt = Date.now();

    await saveGroup(group);
    return NextResponse.json(group);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const { id, expenseId } = await params;
    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    const before = group.entries.length;
    group.entries = group.entries.filter((e) => e.id !== expenseId);
    if (group.entries.length === before) {
      return NextResponse.json({ error: "Запис не знайдено" }, { status: 404 });
    }
    await saveGroup(group);
    return NextResponse.json(group);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}
