import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/types";

vi.mock("@/lib/store", () => ({ createGroup: vi.fn() }));

const { createGroup } = await import("@/lib/store");
const { POST } = await import("./route");

const VALID = "5375411234567894";
const VALID_2 = "4149499312345679";

function req(body: unknown) {
  return new Request("http://localhost/api/groups", {
    method: "POST",
    body: JSON.stringify(body),
  }) as never;
}

/** Members the route handed to the store on the last call. */
function members() {
  return vi.mocked(createGroup).mock.calls.at(-1)![0].members;
}

const base = { name: "Карпати", currency: "UAH", creator: "Артем" };

beforeEach(() => {
  vi.mocked(createGroup).mockImplementation(
    async (g) => ({ ...g, id: "abc12345" }) as Group
  );
});

describe("POST /api/groups", () => {
  it("still accepts members as a flat string array", async () => {
    const res = await POST(req({ ...base, members: ["Оля", "Петро"] }));

    expect(res.status).toBe(201);
    expect(members().map((m) => m.name)).toEqual(["Артем", "Оля", "Петро"]);
    expect(members().every((m) => m.card === undefined)).toBe(true);
  });

  it("stores the creator's own card", async () => {
    await POST(req({ ...base, creatorCard: "5375 4112 3456 7894" }));

    expect(members()[0]).toMatchObject({ name: "Артем", card: VALID });
  });

  it("stores a card per friend given as an object", async () => {
    await POST(
      req({ ...base, members: [{ name: "Оля", card: VALID_2 }, { name: "Петро" }] })
    );

    expect(members()[1]).toMatchObject({ name: "Оля", card: VALID_2 });
    expect(members()[2].card).toBeUndefined();
  });

  it("keeps the staggered createdAt ordering", async () => {
    await POST(req({ ...base, members: ["Оля", "Петро"] }));

    const stamps = members().map((m) => m.createdAt);
    expect(stamps[0]).toBeLessThan(stamps[1]);
    expect(stamps[1]).toBeLessThan(stamps[2]);
  });

  it("dedupes a friend who repeats the creator, regardless of case", async () => {
    await POST(req({ ...base, members: ["артем", "Оля"] }));

    expect(members().map((m) => m.name)).toEqual(["Артем", "Оля"]);
  });

  it("rejects an invalid creator card", async () => {
    const res = await POST(req({ ...base, creatorCard: "5375411234567890" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Перевірте номер картки" });
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("rejects an invalid friend card", async () => {
    const res = await POST(req({ ...base, members: [{ name: "Оля", card: "5375" }] }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Номер картки — 16 цифр" });
    expect(createGroup).not.toHaveBeenCalled();
  });
});
