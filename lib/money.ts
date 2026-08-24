export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Parse a user-entered amount ("123,45" / "123.45") into minor units, or null. */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const minor = Math.round(parseFloat(cleaned) * 100);
  if (!Number.isFinite(minor) || minor <= 0) return null;
  return minor;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
