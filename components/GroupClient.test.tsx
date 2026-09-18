import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Group } from "@/lib/types";
import GroupClient from "./GroupClient";

vi.mock("@/lib/recentGroups", () => ({ rememberGroup: vi.fn() }));

const GROUP: Group = {
  id: "abc12345",
  name: "Карпати",
  currency: "UAH",
  owner: "Артем",
  members: [
    { name: "Артем", createdAt: 1 },
    { name: "Анна Марія", createdAt: 2 },
  ],
  entries: [],
  createdAt: 1,
};

/**
 * userEvent.setup() installs its own clipboard stub, so ours has to be defined
 * after it — otherwise the component talks to user-event's stub, not this one.
 */
function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

function setHash(hash: string) {
  window.history.replaceState(null, "", `/g/${GROUP.id}${hash}`);
}

describe("GroupClient identity resolution", () => {
  beforeEach(() => {
    localStorage.clear();
    setHash("");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("adopts the identity from a personal #me= link", async () => {
    setHash("#me=Артем");
    render(<GroupClient initialGroup={GROUP} />);

    expect(await screen.findByText("Артем")).toBeTruthy();
    expect(localStorage.getItem(`splitka:me:${GROUP.id}`)).toBe("Артем");
  });

  it("matches the #me= name case-insensitively and stores the stored spelling", async () => {
    setHash("#me=артем");
    render(<GroupClient initialGroup={GROUP} />);

    await waitFor(() =>
      expect(localStorage.getItem(`splitka:me:${GROUP.id}`)).toBe("Артем")
    );
  });

  it("matches a #me= name whose whitespace differs", async () => {
    setHash("#me=" + encodeURIComponent("анна   марія"));
    render(<GroupClient initialGroup={GROUP} />);

    await waitFor(() =>
      expect(localStorage.getItem(`splitka:me:${GROUP.id}`)).toBe("Анна Марія")
    );
  });

  it("strips the hash so the address bar shares the group, not the identity", async () => {
    setHash("#me=Артем");
    render(<GroupClient initialGroup={GROUP} />);

    await waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("falls back to the join screen when #me= names a stranger", async () => {
    setHash("#me=Хтось");
    render(<GroupClient initialGroup={GROUP} />);

    expect(await screen.findByText("Я тут вперше")).toBeTruthy();
  });

  it("restores a saved identity from localStorage", async () => {
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Артем");
    render(<GroupClient initialGroup={GROUP} />);

    expect(await screen.findByText("Артем")).toBeTruthy();
    expect(screen.queryByText("Я тут вперше")).toBeNull();
  });

  it("shows the join screen when a saved identity is no longer a member", async () => {
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Хтось"); 
    render(<GroupClient initialGroup={GROUP} />);

    expect(await screen.findByText("Я тут вперше")).toBeTruthy();
  });

  it("picks an existing member from the join screen without calling the API", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Артем" }));

    expect(localStorage.getItem(`splitka:me:${GROUP.id}`)).toBe("Артем");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("joins an existing member by typed name without calling the API", async () => {
    const user = userEvent.setup();
    render(<GroupClient initialGroup={GROUP} />);

    await user.type(await screen.findByLabelText(/Ваше ім/), "артем");
    await user.click(screen.getByRole("button", { name: "Приєднатися" }));

    await waitFor(() =>
      expect(localStorage.getItem(`splitka:me:${GROUP.id}`)).toBe("Артем")
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("GroupClient link sharing", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(`splitka:me:${GROUP.id}`, "Артем");
    setHash("");
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("copies the group link and confirms with a toast", async () => {
    const writeText = vi.fn(async () => {});
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Поділитися" }));
    await user.click(screen.getAllByRole("button", { name: "Копіювати" })[0]);

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${location.origin}/g/${GROUP.id}`));
    expect(await screen.findByText("Лінк скопійовано ✓")).toBeTruthy();
  });

  it("copies a personal link carrying the member's name", async () => {
    const writeText = vi.fn(async () => {});
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Поділитися" }));
    await user.click(screen.getAllByRole("button", { name: "Копіювати" })[2]);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${location.origin}/g/${GROUP.id}#me=${encodeURIComponent("Анна Марія")}`
      )
    );
  });

  it("falls back to showing the link when the clipboard refuses", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("denied");
    });
    const user = userEvent.setup();
    stubClipboard(writeText);
    render(<GroupClient initialGroup={GROUP} />);

    await user.click(await screen.findByRole("button", { name: "Поділитися" }));
    await user.click(screen.getAllByRole("button", { name: "Копіювати" })[0]);

    expect(await screen.findByText(`${location.origin}/g/${GROUP.id}`)).toBeTruthy();
  });
});
