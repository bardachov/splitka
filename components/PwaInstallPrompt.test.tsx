import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PwaInstallPrompt from "./PwaInstallPrompt";

/** Mirrors the stub-ordering note in GroupClient.test.tsx. */
function stubClipboard(writeText: () => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

/** The embedded-webview branch is the only one rendering the copy button. */
function renderInAppBranch() {
  Object.defineProperty(navigator, "userAgent", {
    value:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0",
    configurable: true,
  });
  render(<PwaInstallPrompt />);
}

describe("PwaInstallPrompt copy link", () => {
  afterEach(cleanup);

  it("copies the current URL and confirms on the button", async () => {
    const writeText = vi.fn(async () => {});
    const user = userEvent.setup();
    stubClipboard(writeText);
    renderInAppBranch();

    await user.click(await screen.findByRole("button", { name: "Скопіювати лінк" }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByRole("button", { name: "Скопійовано ✓" })).toBeTruthy();
  });

  it("leaves the button unconfirmed when the clipboard refuses", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("denied");
    });
    const user = userEvent.setup();
    stubClipboard(writeText);
    renderInAppBranch();

    await user.click(await screen.findByRole("button", { name: "Скопіювати лінк" }));

    expect(screen.getByRole("button", { name: "Скопіювати лінк" })).toBeTruthy();
  });
});
