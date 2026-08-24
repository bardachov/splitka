import { NextRequest, NextResponse } from "next/server";
import { getGroup, saveGroup } from "@/lib/store";
import { MAX_MEMBERS, MAX_NAME_LEN, nameKey, normalizeName } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const name = normalizeName(String(body?.name ?? ""));

    if (!name || name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: "Вкажіть ім'я (до 30 символів)" }, { status: 400 });
    }

    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    if (group.members.length >= MAX_MEMBERS) {
      return NextResponse.json({ error: "Забагато учасників у групі" }, { status: 400 });
    }

    const exists = group.members.find((m) => nameKey(m.name) === nameKey(name));
    if (exists) {
      return NextResponse.json(
        { error: `Ім'я «${exists.name}» вже зайняте в цій групі`, existing: exists.name },
        { status: 409 }
      );
    }

    group.members.push({ name, createdAt: Date.now() });
    await saveGroup(group);
    return NextResponse.json(group, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}
