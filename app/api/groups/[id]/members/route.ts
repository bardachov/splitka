import { NextRequest, NextResponse } from "next/server";
import { addMember, getGroup } from "@/lib/store";
import { MAX_NAME_LEN, normalizeName } from "@/lib/types";

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

    // getGroup also lazily imports pre-migration groups into Redis.
    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }

    const res = await addMember(id, { name, createdAt: Date.now() });
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
