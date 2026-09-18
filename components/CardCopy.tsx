"use client";

import { copyText } from "@/lib/clipboard";
import { formatCard } from "@/lib/types";

/**
 * A member's card, shown grouped for reading and copied bare — banking apps
 * always accept a number without spaces, not always one with them.
 */
export function CardCopy({
  card,
  showToast,
}: {
  card: string;
  showToast: (msg: string) => void;
}) {
  async function copy() {
    showToast(
      (await copyText(card)) ? "Картку скопійовано ✓" : "Не вдалося скопіювати"
    );
  }

  return (
    <button
      type="button"
      className="card-copy"
      onClick={copy}
      aria-label={`Скопіювати картку ${formatCard(card)}`}
    >
      {formatCard(card)}
      <span className="card-copy-icon" aria-hidden="true">
        ⧉
      </span>
    </button>
  );
}
