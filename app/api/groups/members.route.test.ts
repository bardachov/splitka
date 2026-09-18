import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group, Member } from "@/lib/types";

vi.mock("@/lib/store", () => ({
  addMember: vi.fn(),
  getGroup: vi.fn(),
  updateMember: vi.fn(),
}));

const { addMember, getGroup, updateMember } = await import("@/lib/store");
const { POST, PUT } = await import("./[id]/members/route");

const VALID = "5375411234567894";

const GROUP: Group = {
  id: "abc12345",
  name: "Карпати",
  currency: "UAH",
  owner: "Артем",
  members: [
    { name: "Артем", createdAt: 1 },
    { name: "Оля", createdAt: 2, card: VALID },
  ],
  entries: [],
  createdAt: 1,
};

const params = Promise.resolve({ id: GROUP.id });

function req(body: unknown) {
  return new Request("http://localhost/api/groups/abc12345/members", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

/** The Member handed to the mocked store on the last call. */
function written(fn: typeof addMember | typeof updateMember): Member {
  return vi.mocked(fn).mock.calls.at(-1)![1];
}

beforeEach(() => {
  vi.mocked(getGroup).mockResolvedValue(GROUP);
  vi.mocked(addMember).mockResolvedValue({ status: "ok", group: GROUP });
  vi.mocked(updateMember).mockResolvedValue({ status: "ok", group: GROUP });
});

describe("POST /api/groups/:id/members", () => {
  it("stores a valid card as bare digits", async () => {
    const res = await POST(req({ name: "Петро", card: "5375 4112 3456 7894" }), { params });

    expect(res.status).toBe(201);
    expect(written(addMember).card).toBe(VALID);
  });

  it("omits the card entirely when none is given", async () => {
    await POST(req({ name: "Петро" }), { params });

    const member = written(addMember);
    expect(member.card).toBeUndefined();
    // The stored JSON must stay byte-identical to pre-card members.
    expect(JSON.stringify(member)).not.toContain("card");
  });

  it("rejects a card failing the Luhn check without touching the store", async () => {
    const res = await POST(req({ name: "Петро", card: "5375411234567890" }), { params });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Перевірте номер картки" });
    expect(addMember).not.toHaveBeenCalled();
  });

  it("rejects a card that is too short", async () => {
    const res = await POST(req({ name: "Петро", card: "5375" }), { params });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Номер картки — 16 цифр" });
  });
});

describe("PUT /api/groups/:id/members", () => {
  it("sets the card on an existing member", async () => {
    const res = await PUT(req({ name: "Артем", card: "5375 4112 3456 7894" }), { params });

    expect(res.status).toBe(200);
    expect(written(updateMember)).toEqual({ name: "Артем", createdAt: 1, card: VALID });
  });

  it("keeps the stored name spelling when the client sends another case", async () => {
    await PUT(req({ name: "оля", card: VALID }), { params });

    // Entries reference members by exact name — rewriting it would silently
    // break the balances.
    expect(written(updateMember).name).toBe("Оля");
  });

  it("clears the card when an empty value is sent", async () => {
    await PUT(req({ name: "Оля", card: "" }), { params });

    expect(written(updateMember).card).toBeUndefined();
  });

  it("404s for a member who is not in the group", async () => {
    const res = await PUT(req({ name: "Хтось", card: VALID }), { params });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Учасника не знайдено" });
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("404s when the group does not exist", async () => {
    vi.mocked(getGroup).mockResolvedValue(null);

    const res = await PUT(req({ name: "Оля", card: VALID }), { params });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Групу не знайдено" });
  });

  it("404s when the member vanished between the read and the write", async () => {
    vi.mocked(updateMember).mockResolvedValue({ status: "not_found" });

    const res = await PUT(req({ name: "Оля", card: VALID }), { params });

    expect(res.status).toBe(404);
  });

  it("rejects an invalid card before reading the group", async () => {
    const res = await PUT(req({ name: "Оля", card: "5375411234567890" }), { params });

    expect(res.status).toBe(400);
    expect(getGroup).not.toHaveBeenCalled();
  });

  it("rejects a missing name", async () => {
    const res = await PUT(req({ card: VALID }), { params });

    expect(res.status).toBe(400);
  });
});
