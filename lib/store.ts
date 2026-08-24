import "server-only";
import type { Group } from "./types";

/**
 * Persistence backend: npoint.io — a free JSON storage service.
 * Each group is one npoint document; the document token is the group ID
 * (and the share link). Access model matches the app: whoever has the
 * link can read and write. Can be swapped for KV/Postgres behind this
 * same interface later.
 */
const CREATE_URL = "https://www.npoint.io/documents";
const API_BASE = "https://api.npoint.io";
/** Safety cap for one group document. */
const MAX_BYTES = 150_000;

const UA = "splitka-mvp/1.0";

function isValidId(id: string): boolean {
  return /^[A-Za-z0-9]{8,64}$/.test(id);
}

export async function createGroup(group: Omit<Group, "id">): Promise<Group> {
  const res = await fetch(CREATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ contents: JSON.stringify(group) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage create failed: ${res.status}`);
  const data = (await res.json()) as { token?: string };
  const id = data.token ?? "";
  if (!isValidId(id)) throw new Error("Storage returned an unexpected token");
  const full: Group = { ...group, id };
  await saveGroup(full);
  return full;
}

export async function getGroup(id: string): Promise<Group | null> {
  if (!isValidId(id)) return null;
  const res = await fetch(`${API_BASE}/${id}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Storage read failed: ${res.status}`);
  let data: Group;
  try {
    data = (await res.json()) as Group;
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.members) || !Array.isArray(data.entries)) return null;
  return { ...data, id };
}

export async function saveGroup(group: Group): Promise<void> {
  const body = JSON.stringify(group);
  if (new TextEncoder().encode(body).length > MAX_BYTES) {
    throw new Error("GROUP_TOO_LARGE");
  }
  const res = await fetch(`${API_BASE}/${group.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage write failed: ${res.status}`);
}
