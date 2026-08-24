import { NextRequest, NextResponse } from "next/server";
import { getGroup } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const group = await getGroup(id);
    if (!group) {
      return NextResponse.json({ error: "Групу не знайдено" }, { status: 404 });
    }
    return NextResponse.json(group);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Помилка сховища" }, { status: 502 });
  }
}
