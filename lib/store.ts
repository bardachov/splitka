import "server-only";
import { Redis } from "@upstash/redis";
import type { Entry, Group, Member } from "./types";
import { MAX_ENTRIES, MAX_MEMBERS, nameKey } from "./types";

/**
 * Persistence: Upstash Redis (Vercel Marketplace). One group is one hash:
 *
 *   group:{id}
 *     meta          → { name, currency, createdAt }
 *     member:{key}  → Member   (key = nameKey(name))
 *     entry:{id}    → Entry
 *
 * Every mutation touches only its own field (HSET/HDEL or a small Lua
 * script), so concurrent writers can no longer overwrite each other the
 * way the old whole-document read-modify-write on npoint.io did.
 *
 * Groups created before the migration still live on npoint.io; the first
 * read imports such a group into Redis, after which all writes go to Redis.
 */

type Meta = {
  name: string;
  currency: string;
  createdAt: number;
  /** Absent in groups stored before ownership existed. */
  owner?: string;
};

export type MutationResult =
  | { status: "ok"; group: Group }
  | { status: "not_found" }
  | { status: "full" }
  | { status: "exists"; existing: string };

let client: Redis | null = null;
function redis(): Redis {
  if (!client) client = Redis.fromEnv();
  return client;
}

const keyOf = (id: string) => `group:${id}`;

function isValidId(id: string): boolean {
  return /^[A-Za-z0-9]{8,64}$/.test(id);
}

const ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

/** HSET the entry unless the group is gone or already at the entry cap. */
export const ADD_ENTRY_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -2 end
local n = 0
for _, k in ipairs(redis.call('HKEYS', KEYS[1])) do
  if string.sub(k, 1, 6) == 'entry:' then n = n + 1 end
end
if n >= tonumber(ARGV[1]) then return -1 end
redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
return 1
`;

/** Claim the member field unless the name is taken or the group is full. */
export const ADD_MEMBER_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -2 end
if redis.call('HEXISTS', KEYS[1], ARGV[2]) == 1 then return 0 end
local n = 0
for _, k in ipairs(redis.call('HKEYS', KEYS[1])) do
  if string.sub(k, 1, 7) == 'member:' then n = n + 1 end
end
if n >= tonumber(ARGV[1]) then return -1 end
redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
return 1
`;

/**
 * Write only while the entry still exists — a plain HSET racing a
 * concurrent delete would resurrect the deleted entry.
 */
export const UPDATE_ENTRY_SCRIPT = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then return 0 end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
return 1
`;

function assemble(id: string, data: Record<string, unknown>): Group | null {
  const meta = data.meta as Meta | undefined;
  if (!meta || typeof meta.name !== "string") return null;
  const members: Member[] = [];
  const entries: Entry[] = [];
  for (const [field, value] of Object.entries(data)) {
    if (field.startsWith("member:")) members.push(value as Member);
    else if (field.startsWith("entry:")) entries.push(value as Entry);
  }
  members.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  entries.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  return {
    id,
    name: meta.name,
    currency: meta.currency,
    // The creator has always been written first, so it is the safe fallback.
    owner: meta.owner ?? members[0]?.name ?? "",
    members,
    entries,
    createdAt: meta.createdAt,
  };
}

function toFields(group: Group): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    meta: {
      name: group.name,
      currency: group.currency,
      createdAt: group.createdAt,
      owner: group.owner,
    } satisfies Meta,
  };
  for (const m of group.members) fields[`member:${nameKey(m.name)}`] = m;
  for (const e of group.entries) fields[`entry:${e.id}`] = e;
  return fields;
}

export async function createGroup(group: Omit<Group, "id">): Promise<Group> {
  const full: Group = { ...group, id: generateId() };
  await redis().hset(keyOf(full.id), toFields(full));
  return full;
}

export async function getGroup(id: string): Promise<Group | null> {
  if (!isValidId(id)) return null;
  const data = await redis().hgetall<Record<string, unknown>>(keyOf(id));
  if (data && Object.keys(data).length > 0) return assemble(id, data);
  return importLegacyGroup(id);
}

export async function addMember(
  id: string,
  member: Member
): Promise<MutationResult> {
  const key = keyOf(id);
  const field = `member:${nameKey(member.name)}`;
  const res = await redis().eval<[number, string, string], number>(
    ADD_MEMBER_SCRIPT,
    [key],
    [MAX_MEMBERS, field, JSON.stringify(member)]
  );
  if (res === -2) return { status: "not_found" };
  if (res === -1) return { status: "full" };
  if (res === 0) {
    const existing = await redis().hget<Member>(key, field);
    return { status: "exists", existing: existing?.name ?? member.name };
  }
  return okWithGroup(id);
}

export async function addEntry(
  id: string,
  entry: Entry
): Promise<MutationResult> {
  const res = await redis().eval<[number, string, string], number>(
    ADD_ENTRY_SCRIPT,
    [keyOf(id)],
    [MAX_ENTRIES, `entry:${entry.id}`, JSON.stringify(entry)]
  );
  if (res === -2) return { status: "not_found" };
  if (res === -1) return { status: "full" };
  return okWithGroup(id);
}

export async function updateEntry(
  id: string,
  entry: Entry
): Promise<MutationResult> {
  const res = await redis().eval<[string, string], number>(
    UPDATE_ENTRY_SCRIPT,
    [keyOf(id)],
    [`entry:${entry.id}`, JSON.stringify(entry)]
  );
  if (res === 0) return { status: "not_found" };
  return okWithGroup(id);
}

export async function deleteEntry(
  id: string,
  entryId: string
): Promise<MutationResult> {
  const removed = await redis().hdel(keyOf(id), `entry:${entryId}`);
  if (removed === 0) return { status: "not_found" };
  return okWithGroup(id);
}

async function okWithGroup(id: string): Promise<MutationResult> {
  const group = await getGroup(id);
  if (!group) return { status: "not_found" };
  return { status: "ok", group };
}

/* ---------- lazy import from the old npoint.io backend ---------- */

const LEGACY_API = "https://api.npoint.io";
const UA = "splitka-mvp/1.0";

async function importLegacyGroup(id: string): Promise<Group | null> {
  const res = await fetch(`${LEGACY_API}/${id}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Legacy storage read failed: ${res.status}`);
  let data: Group;
  try {
    data = (await res.json()) as Group;
  } catch {
    return null;
  }
  if (!data || !Array.isArray(data.members) || !Array.isArray(data.entries)) {
    return null;
  }
  const group: Group = {
    ...data,
    id,
    // Pre-migration groups never stored an owner; the creator joined first.
    owner: data.owner ?? data.members[0]?.name ?? "",
  };
  await redis().hset(keyOf(id), toFields(group));
  return group;
}
