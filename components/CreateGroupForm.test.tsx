import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateGroupForm from "./CreateGroupForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/recentGroups", () => ({ rememberGroup: vi.fn() }));

/** The JSON body of the single POST the form made. */
function postedBody() {
  const call = vi.mocked(fetch).mock.calls.at(-1)!;
  return JSON.parse(String((call[1] as RequestInit).body));
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Назва групи"), "Карпати");
  await user.type(screen.getByLabelText("Ваше ім'я"), "Артем");
}

describe("CreateGroupForm", () => {
  beforeEach(() => {
    push.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "abc12345", creator: "Артем" }),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("adds a friend as a chip and clears the input", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    const input = screen.getByPlaceholderText("Ім'я друга");
    await user.type(input, "Оля");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    expect(screen.getByRole("button", { name: "Прибрати Оля" })).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("adds a friend on Enter without submitting the form", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Оля{Enter}");

    expect(screen.getByRole("button", { name: "Прибрати Оля" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a duplicate friend regardless of case", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Оля{Enter}");
    await user.type(screen.getByPlaceholderText("Ім'я друга"), "ОЛЯ{Enter}");

    expect(screen.getByText("«ОЛЯ» вже є в списку")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Прибрати/ })).toHaveLength(1);
  });

  it("rejects a friend whose name collides with the creator's", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.type(screen.getByLabelText("Ваше ім'я"), "Артем");
    await user.type(screen.getByPlaceholderText("Ім'я друга"), "артем{Enter}");

    expect(screen.getByText("«артем» вже є в списку")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Прибрати/ })).toBeNull();
  });

  it("removes a friend when the chip is clicked", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Оля{Enter}");
    await user.click(screen.getByRole("button", { name: "Прибрати Оля" }));

    expect(screen.queryByRole("button", { name: "Прибрати Оля" })).toBeNull();
  });

  it("normalizes a friend's name before adding it", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.type(screen.getByPlaceholderText("Ім'я друга"), "  Анна   Марія  {Enter}");

    expect(screen.getByRole("button", { name: "Прибрати Анна Марія" })).toBeTruthy();
  });

  it("posts the group with friends as objects", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Оля{Enter}");
    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Петро{Enter}");
    await user.click(screen.getByRole("button", { name: "Створити групу" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/groups");
    expect(postedBody()).toMatchObject({
      name: "Карпати",
      currency: "UAH",
      creator: "Артем",
      creatorCard: "",
      members: [{ name: "Оля" }, { name: "Петро" }],
    });
  });

  it("posts the creator's card as bare digits", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByLabelText(/Ваша картка/), "5375411234567894");
    await user.click(screen.getByRole("button", { name: "Створити групу" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(postedBody().creatorCard).toBe("5375411234567894");
  });

  it("formats the card as it is typed", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    const input = screen.getByLabelText(/Ваша картка/) as HTMLInputElement;
    await user.type(input, "5375411234567894");

    expect(input.value).toBe("5375 4112 3456 7894");
  });

  it("ignores non-digits and stops at 16 digits", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    const input = screen.getByLabelText(/Ваша картка/) as HTMLInputElement;
    await user.type(input, "5375-4112-3456-7894-999");

    expect(input.value).toBe("5375 4112 3456 7894");
  });

  it("attaches a card to the friend it was typed with, then clears it", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await fillRequiredFields(user);
    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Оля");
    const cardInput = screen.getByPlaceholderText(/Картка друга/) as HTMLInputElement;
    await user.type(cardInput, "4149499312345679");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    expect(cardInput.value).toBe("");
    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Петро{Enter}");
    await user.click(screen.getByRole("button", { name: "Створити групу" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(postedBody().members).toEqual([
      { name: "Оля", card: "4149499312345679" },
      { name: "Петро" },
    ]);
  });

  it("marks a friend who has a card", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await user.type(screen.getByPlaceholderText("Ім'я друга"), "Оля");
    await user.type(screen.getByPlaceholderText(/Картка друга/), "4149499312345679");
    await user.click(screen.getByRole("button", { name: "Додати" }));

    expect(screen.getByRole("button", { name: /Прибрати Оля/ }).textContent).toContain("💳");
  });

  it("navigates to the new group and remembers the identity", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Створити групу" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/g/abc12345"));
    expect(localStorage.getItem("splitka:me:abc12345")).toBe("Артем");
  });

  it("shows the server error and stays on the form", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Невідома валюта" }),
    } as never);
    const user = userEvent.setup();
    render(<CreateGroupForm />);

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Створити групу" }));

    expect(await screen.findByText("Невідома валюта")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});
