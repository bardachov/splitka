"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/types";
import { rememberGroup } from "@/lib/recentGroups";

const CURRENCY_LABELS: Record<string, string> = {
  UAH: "₴ Гривня (UAH)",
  USD: "$ Долар (USD)",
  EUR: "€ Євро (EUR)",
  PLN: "zł Злотий (PLN)",
};

export default function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [creator, setCreator] = useState("");
  const [currency, setCurrency] = useState("UAH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency, creator }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Щось пішло не так");
        setBusy(false);
        return;
      }
      try {
        localStorage.setItem(`splitka:me:${data.id}`, data.creator);
      } catch {}
      rememberGroup(data.id, name.trim(), data.creator);
      router.push(`/g/${data.id}`);
    } catch {
      setError("Немає з'єднання. Спробуйте ще раз.");
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Нова група</h2>
      <label htmlFor="gname">Назва групи</label>
      <input
        id="gname"
        type="text"
        placeholder="Напр. Поїздка в Карпати"
        value={name}
        maxLength={50}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div className="row-2">
        <div>
          <label htmlFor="cname">Ваше ім&apos;я</label>
          <input
            id="cname"
            type="text"
            placeholder="Напр. Артем"
            value={creator}
            maxLength={30}
            onChange={(e) => setCreator(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="curr">Валюта</label>
          <select
            id="curr"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Створюємо…" : "Створити групу"}
      </button>
    </form>
  );
}
