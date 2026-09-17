import { NextRequest, NextResponse } from "next/server";
import { addMember, getGroup, updateMember } from "@/lib/store";
import {
  cardError,
  findMember,
  MAX_NAME_LEN,
  normalizeCard,
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
    const name = normalizeName(String(body?.name ?? ""));
    const card = normalizeCard(String(body?.card ?? ""));

    if (!name || name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть ім'я (до 30 символів)" }, { status: 400 });
    }
    const badCard = cardError(card);
    if (badCard) {
      return NextResponse.json({ error: badCard }, { status: 400 });
    }

    // getGroup also lazily imports pre-migration groups into Redis.
    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }

    // An absent card must stay absent, not become "", so members without one
    // serialize exactly as they did before cards existed.
    const res = await addMember(id, {
      name,
      createdAt: Date.now(),
      ...(card ? { card } : {}),
    });
    if (res.status === "not_found") {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    if (res.status === "full") {
      return NextResponse.json({ error: "Забагато учасників у групі" }, { status: 400 });
    }
    if (res.status === "exists") {
      return NextResponse.json(
        { error: `Ім'я «${res.existing}» вже зайняте в цій групі`, existing: res.existing },
        { status: 409 }
      );
    }
    return NextResponse.json(res.group, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}

/** Changes a member's payment details. An empty card clears them. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const name = normalizeName(String(body?.name ?? ""));
    const card = normalizeCard(String(body?.card ?? ""));

    if (!name || name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть ім'я (до 30 символів)" }, { status: 400 });
    }
    const badCard = cardError(card);
    if (badCard) {
      return NextResponse.json({ error: badCard }, { status: 400 });
    }

    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    const member = findMember(group.members, name);
    if (!member) {
      return NextResponse.json({ error: "Учасника не знайдено" }, { status: 404 });
    }

    // Spread the STORED member, never the client's spelling of the name:
    // entries reference members by exact name, so rewriting it here would
    // quietly detach this person from their own expenses.
    const { card: _dropped, ...rest } = member;
    const res = await updateMember(id, { ...rest, ...(card ? { card } : {}) });
    if (res.status !== "ok") {
      return NextResponse.json({ error: "Учасника не знайдено" }, { status: 404 });
    }
    return NextResponse.json(res.group);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}
