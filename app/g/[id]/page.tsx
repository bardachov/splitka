import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGroup } from "@/lib/store";
import GroupClient from "@/components/GroupClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const group = await getGroup(id).catch(() => null);
  return {
    title: group ? `${group.name} — Splitka` : "Splitka",
    description: group
      ? `Спільні витрати групи «${group.name}». Приєднуйтесь за своїм ім'ям.`
      : undefined,
  };
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const group = await getGroup(id).catch(() => null);
  if (!group) notFound();
  return <GroupClient initialGroup={group} />;
}
