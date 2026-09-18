import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/types";
import GroupClient from "./GroupClient";

vi.mock("@/lib/recentGroups", () => ({ rememberGroup: vi.fn() }));

const ARTEM_CARD = "5375411234567894";
const OLYA_CARD = "4149499312345679";

/** Артем paid 100.00 split evenly, so Оля owes him 50.00. */
const GROUP: Group = {
  id: "abc12345",
  name: "Карпати",
  currency: "UAH",
  owner: "Артем",
  members: [
    { name: "Артем", createdAt: 1, card: ARTEM_CARD },
    { name: "Оля", createdAt: 2, card: OLYA_CARD },
    { name: "Петро", createdAt: 3 },
  ],
  entries: [
    {
      id: "e1",
      type: "expense",
      description: "Бензин",
      amount: 10000,
      paidBy: "Артем",
      splitAmong: ["Артем", "Оля"],
      createdAt: 5,
    },
  ],
  createdAt: 1,
};

function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

/** Answers every write with the group as the server would return it after. */
function stubFetch() {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const group: Group = body?.name
      ? {
          ...GROUP,
          members: GROUP.members.map((m) =>
            m.name.toLowerCase() === String(body.name).toLowerCase()
              ? { ...m, card: body.card || undefined }
              : m
          ),
        }
      : GROUP;
    return { ok: true, status: 200, json: async () => group };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The parsed body of the last request made. */
function lastBody() {
  const call = vi.mocked(fetch).mock.calls.at(-1)!;
  return JSON.parse(String((call[1] as RequestInit).body));
}

function lastMethod() {
  return (vi.mocked(fetch).mock.calls.at(-1)![1] as RequestInit).method;
}

describe("card display", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Оля");
    window.history.replaceState(null, "", `/g/${GROUP.id}`);
    stubFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the recipient's card on the debt row, not the payer's", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Баланси" }));
    const row = (await screen.findByText(/Хто кому винен/)).parentElement!;

    expect(within(row).getByText("5375 4112 3456 7894")).toBeTruthy();
    expect(within(row).queryByText("4149 4993 1234 5679")).toBeNull();
  });

  it("copies the card as bare digits", async () => {
    const writeText = vi.fn(async () => {});
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Баланси" }));
    await user.click(screen.getAllByRole("button", { name: /Скопіювати картку/ })[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(ARTEM_CARD));
    expect(await screen.findByText("Картку скопійовано ✓")).toBeTruthy();
  });

  it("lists cards in the per-member balances, omitting members without one", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Баланси" }));
    const card = (await screen.findByText(/Баланс кожного/)).parentElement!;

    expect(within(card).getByText("5375 4112 3456 7894")).toBeTruthy();
    expect(within(card).getByText("4149 4993 1234 5679")).toBeTruthy();
    expect(within(card).getByText("Петро")).toBeTruthy();
    expect(within(card).getAllByRole("button", { name: /Скопіювати картку/ })).toHaveLength(2);
  });

  it("shows cards in the share modal member list", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Поділитися" }));

    expect(screen.getByText("5375 4112 3456 7894")).toBeTruthy();
  });
});

describe("editing my own card", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", `/g/${GROUP.id}`);
    stubFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("offers to add a card when I have none", async () => {
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Петро");
    render(<GroupClient initialGroup={GROUP} />);

    expect(await screen.findByRole("button", { name: "Додати картку" })).toBeTruthy();
  });

  it("saves my card with a PUT carrying my own name", async () => {
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Петро");
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Додати картку" }));
    await user.type(screen.getByLabelText(/Куди переказувати/), ARTEM_CARD);
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(lastMethod()).toBe("PUT"));
    expect(lastBody()).toEqual({ name: "Петро", card: ARTEM_CARD });
  });

  it("prefills my current card and refuses an invalid one", async () => {
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Оля");
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Моя картка" }));
    const input = screen.getByLabelText(/Куди переказувати/) as HTMLInputElement;
    expect(input.value).toBe("4149 4993 1234 5679");

    await user.clear(input);
    await user.type(input, "5375411234567890");
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Перевірте номер картки")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears the card when the field is emptied", async () => {
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Оля");
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Моя картка" }));
    await user.clear(screen.getByLabelText(/Куди переказувати/));
    await user.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(lastBody()).toEqual({ name: "Оля", card: "" }));
  });
});

describe("joining with a card", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", `/g/${GROUP.id}`);
    stubFetch();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends the card along with a new member's name", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.type(await screen.findByLabelText(/Ваше ім/), "Іра");
    await user.type(screen.getByLabelText(/Ваша картка/), ARTEM_CARD);
    await user.click(screen.getByRole("button", { name: "Приєднатися" }));

    await waitFor(() => expect(lastMethod()).toBe("POST"));
    expect(lastBody()).toEqual({ name: "Іра", card: ARTEM_CARD });
  });

  it("saves the card of a member the author pre-added", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    // Петро is already in the group, so joining takes the no-POST shortcut.
    await user.type(await screen.findByLabelText(/Ваше ім/), "петро");
    await user.type(screen.getByLabelText(/Ваша картка/), ARTEM_CARD);
    await user.click(screen.getByRole("button", { name: "Приєднатися" }));

    await waitFor(() => expect(lastMethod()).toBe("PUT"));
    expect(lastBody()).toEqual({ name: "Петро", card: ARTEM_CARD });
  });

  it("reflects the saved card immediately, without waiting for a poll", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.type(await screen.findByLabelText(/Ваше ім/), "Петро");
    await user.type(screen.getByLabelText(/Ваша картка/), ARTEM_CARD);
    await user.click(screen.getByRole("button", { name: "Приєднатися" }));

    // The PUT response carries the updated group; ignoring it would leave the
    // header offering to add a card the member just set.
    expect(await screen.findByRole("button", { name: "Моя картка" })).toBeTruthy();
  });

  it("refuses an invalid card before joining", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.type(await screen.findByLabelText(/Ваше ім/), "Іра");
    await user.type(screen.getByLabelText(/Ваша картка/), "5375");
    await user.click(screen.getByRole("button", { name: "Приєднатися" }));

    expect(await screen.findByText("Номер картки — 16 цифр")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
