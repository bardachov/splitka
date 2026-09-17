"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Entry, Group } from "@/lib/types";
import { rememberGroup } from "@/lib/recentGroups";
import { findMember, nameKey, normalizeName } from "@/lib/types";
import { copyText } from "@/lib/clipboard";
import {
  computeNetBalances,
  equalShares,
  simplifyDebts,
  totalSpent,
} from "@/lib/balances";
import { formatDate, formatDateTime, formatMoney, parseAmount } from "@/lib/money";
import { ConfirmDialog, Modal } from "@/components/Modal";

type Tab = "expenses" | "balances";

export default function GroupClient({ initialGroup }: { initialGroup: Group }) {
  const [group, setGroup] = useState<Group>(initialGroup);
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("expenses");
  const [shareOpen, setShareOpen] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  // navigator is unavailable during the server render pass.
  const [canShare] = useState(
    () => typeof navigator !== "undefined" && !!navigator.share
  );
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = `splitka:me:${group.id}`;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  // Resolve identity: a personal link (/g/{id}#me=Ім'я) wins, then localStorage.
  useEffect(() => {
    let fromLink: string | null = null;
    try {
      const hash = window.location.hash;
      const claimed = hash.startsWith("#")
        ? new URLSearchParams(hash.slice(1)).get("me")
        : null;
      if (claimed) {
        const member = findMember(initialGroup.members, claimed);
        if (member) fromLink = member.name;
        // Drop the hash so copying the URL from the address bar shares the
        // group, not this person's identity.
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }
    } catch {}
    if (fromLink) {
      chooseIdentity(fromLink);
      return;
    }

    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {}
    if (saved) {
      const member = findMember(initialGroup.members, saved);
      setMe(member ? member.name : null);
    } else {
      setMe(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep this group in the device's "my groups" list.
  useEffect(() => {
    if (typeof me === "string") {
      rememberGroup(group.id, group.name, me);
    }
  }, [group.id, group.name, me]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${group.id}`, { cache: "no-store" });
      if (res.ok) setGroup(await res.json());
    } catch {}
  }, [group.id]);

  // Poll for updates from friends.
  useEffect(() => {
    const iv = setInterval(refresh, 10000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  function chooseIdentity(name: string) {
    try {
      localStorage.setItem(storageKey, name);
    } catch {}
    setMe(name);
  }

  function resetIdentity() {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setMe(null);
  }

  async function shareUrl(url: string, title: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    showToast((await copyText(url)) ? "Лінк скопійовано ✓" : url);
  }

  const groupUrl = () => `${window.location.origin}/g/${group.id}`;
  const personalUrl = (name: string) =>
    `${groupUrl()}#me=${encodeURIComponent(name)}`;

  const isAuthor =
    typeof me === "string" && nameKey(me) === nameKey(group.owner);

  async function addFriend() {
    const name = normalizeName(friendName);
    if (!name || addingFriend) return;
    setAddingFriend(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error ?? "Не вдалося додати");
      } else {
        setGroup(data);
        setFriendName("");
        showToast(`${name} у групі ✓`);
      }
    } catch {
      showToast("Немає з'єднання");
    }
    setAddingFriend(false);
  }

  if (me === undefined) {
    return <main className="container" />;
  }

  if (me === null) {
    return (
      <JoinScreen
        group={group}
        onJoined={(g, name) => {
          setGroup(g);
          chooseIdentity(name);
        }}
        onPick={chooseIdentity}
      />
    );
  }

  return (
    <main className="container">
      <div style={{ marginTop: 8 }}>
        <Link href="/" className="brand" style={{ fontSize: 15 }}>
          <span
            className="logo"
            style={{ width: 22, height: 22, fontSize: 12, borderRadius: 6 }}
          >
            ₴
          </span>
          Splitka · мої групи
        </Link>
      </div>
      <div className="group-header">
        <div>
          <h1>{group.name}</h1>
          <div className="you-line">
            Ви — <b>{me}</b>
            <button onClick={resetIdentity}>змінити</button>
          </div>
        </div>
        <button
          className="btn small secondary"
          onClick={() => setShareOpen(true)}
        >
          Поділитися
        </button>
      </div>

      <div className="tabs">
        <button
          className={tab === "expenses" ? "active" : ""}
          onClick={() => setTab("expenses")}
        >
          Витрати
        </button>
        <button
          className={tab === "balances" ? "active" : ""}
          onClick={() => setTab("balances")}
        >
          Баланси
        </button>
      </div>

      {tab === "expenses" ? (
        <ExpensesTab group={group} me={me} onChange={setGroup} showToast={showToast} />
      ) : (
        <BalancesTab group={group} me={me} onChange={setGroup} showToast={showToast} />
      )}

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Поділитися групою"
      >
        <div className="share-title">Лінк групи</div>
        <div className="share-row">
          <span className="share-name">
            Людина сама обере, хто вона в групі
          </span>
          <button
            className="btn small secondary"
            onClick={() => shareUrl(groupUrl(), `Splitka: ${group.name}`)}
          >
            {canShare ? "Надіслати" : "Копіювати"}
          </button>
        </div>

        <div className="share-title">
          Особисті лінки — відкривши свій, людина одразу заходить під своїм
          ім&apos;ям, у будь-якому браузері
        </div>
        {group.members.map((m) => (
          <div className="share-row" key={m.name}>
            <span className="share-name">
              {m.name}
              {m.name === me ? " (ви)" : ""}
            </span>
            <button
              className="btn small secondary"
              onClick={() =>
                shareUrl(
                  personalUrl(m.name),
                  `Splitka: ${group.name} — лінк для ${m.name}`
                )
              }
            >
              {canShare ? "Надіслати" : "Копіювати"}
            </button>
          </div>
        ))}

        {isAuthor && (
          <>
            <div className="share-title">
              Додати друга — його лінк з&apos;явиться в списку вище
            </div>
            <div className="member-add-row">
              <input
                type="text"
                placeholder="Ім'я друга"
                value={friendName}
                maxLength={30}
                onChange={(e) => setFriendName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFriend();
                  }
                }}
              />
              <button
                className="btn small secondary"
                onClick={addFriend}
                disabled={!friendName.trim() || addingFriend}
              >
                {addingFriend ? "Додаємо…" : "Додати"}
              </button>
            </div>
          </>
        )}
      </Modal>

      {toast && <div className="toast">{toast}</div>}
      <p className="footer-note">
        Учасників: {group.members.length} · Кожен з цим лінком бачить групу
      </p>
    </main>
  );
}

/* ---------------- Join screen ---------------- */

function JoinScreen({
  group,
  onJoined,
  onPick,
}: {
  group: Group;
  onJoined: (g: Group, name: string) => void;
  onPick: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = findMember(group.members, trimmed);
    if (existing) {
      onPick(existing.name);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (res.status === 409 && data?.existing) {
        onPick(data.existing);
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "Щось пішло не так");
        setBusy(false);
        return;
      }
      onJoined(data, trimmed);
    } catch {
      setError("Немає з'єднання. Спробуйте ще раз.");
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div style={{ marginTop: 24 }}>
        <Link href="/" className="brand">
          <span className="logo">₴</span> Splitka
        </Link>
      </div>
      <h1>{group.name}</h1>
      <p className="sub">
        Вас запросили до групи спільних витрат. Хто ви?
      </p>

      {group.members.length > 0 && (
        <div className="card">
          <h2>Я вже в списку</h2>
          <div className="chips">
            {group.members.map((m) => (
              <button
                key={m.name}
                className="chip"
                onClick={() => onPick(m.name)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="card" onSubmit={join}>
        <h2>Я тут вперше</h2>
        <label htmlFor="jname">Ваше ім&apos;я (унікальне в групі)</label>
        <input
          id="jname"
          type="text"
          placeholder="Напр. Оля"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Заходимо…" : "Приєднатися"}
        </button>
      </form>
    </main>
  );
}

/* ---------------- Expenses tab ---------------- */

function ExpensesTab({
  group,
  me,
  onChange,
  showToast,
}: {
  group: Group;
  me: string;
  onChange: (g: Group) => void;
  showToast: (m: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const entries = useMemo(
    () => [...group.entries].sort((a, b) => b.createdAt - a.createdAt),
    [group.entries]
  );
  const total = totalSpent(group);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/expenses/${toDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        onChange(data);
        showToast("Запис видалено");
      } else {
        showToast(data?.error ?? "Не вдалося видалити");
      }
    } catch {
      showToast("Немає з'єднання");
    }
    setDeleting(false);
    setToDelete(null);
  }

  return (
    <>
      {formOpen ? (
        <div className="card">
          <h2>Нова витрата</h2>
          <ExpenseForm
            group={group}
            me={me}
            onDone={(g) => {
              onChange(g);
              setFormOpen(false);
              showToast("Витрату додано ✓");
            }}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      ) : (
        <button className="btn" onClick={() => setFormOpen(true)}>
          + Додати витрату
        </button>
      )}

      <div className="card">
        {entries.length === 0 ? (
          <div className="empty">
            <div className="big">🧾</div>
            Поки що витрат немає.
            <br />
            Додайте першу — і поділіться лінком з друзями.
          </div>
        ) : (
          <>
            {entries.map((e) => (
              <div
                className="entry"
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(e)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") setSelected(e);
                }}
              >
                <div className={`icon ${e.type === "settlement" ? "transfer" : ""}`}>
                  {e.type === "settlement" ? "🤝" : "🧾"}
                </div>
                <div className="meta">
                  <div className="title">
                    {e.type === "settlement"
                      ? `${e.paidBy} → ${e.splitAmong[0]}`
                      : e.description}
                  </div>
                  <div className="who">
                    {e.type === "settlement"
                      ? `переказ · ${formatDate(e.createdAt)}`
                      : `заплатив(ла) ${e.paidBy} за ${e.splitAmong.length} ос. · ${formatDate(e.createdAt)}`}
                  </div>
                </div>
                <div className="amount">{formatMoney(e.amount, group.currency)}</div>
                <span className="chev">›</span>
              </div>
            ))}
            <div className="total-line">
              <span>Разом витрачено</span>
              <b>{formatMoney(total, group.currency)}</b>
            </div>
          </>
        )}
      </div>

      {/* Detail popup */}
      <EntryDetailModal
        entry={selected}
        group={group}
        onClose={() => setSelected(null)}
        onEdit={(e) => {
          setSelected(null);
          setEditing(e);
        }}
        onDelete={(e) => {
          setSelected(null);
          setToDelete(e);
        }}
      />

      {/* Edit popup */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Редагувати витрату"
      >
        {editing && (
          <ExpenseForm
            group={group}
            me={me}
            initial={editing}
            onDone={(g) => {
              onChange(g);
              setEditing(null);
              showToast("Зміни збережено ✓");
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={toDelete !== null}
        title="Видалити запис?"
        message={
          toDelete
            ? `«${toDelete.type === "settlement" ? `Переказ ${toDelete.paidBy} → ${toDelete.splitAmong[0]}` : toDelete.description}» на ${formatMoney(toDelete.amount, group.currency)} буде видалено назавжди.`
            : ""
        }
        confirmLabel="Видалити"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

/* ---------------- Entry detail modal ---------------- */

function EntryDetailModal({
  entry,
  group,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: Entry | null;
  group: Group;
  onClose: () => void;
  onEdit: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  const shares = useMemo(() => {
    if (!entry) return [];
    const parts = equalShares(entry.amount, entry.splitAmong.length);
    return entry.splitAmong.map((name, i) => ({ name, share: parts[i] }));
  }, [entry]);

  if (!entry) return null;

  const isTransfer = entry.type === "settlement";

  return (
    <Modal open onClose={onClose} title={isTransfer ? "Переказ" : "Витрата"}>
      <span className={`detail-label ${isTransfer ? "transfer" : ""}`}>
        {isTransfer ? "🤝 переказ" : "🧾 витрата"}
      </span>
      <div className="detail-amount">{formatMoney(entry.amount, group.currency)}</div>
      <div className="detail-desc">
        {isTransfer ? `${entry.paidBy} → ${entry.splitAmong[0]}` : entry.description}
      </div>

      <div className="detail-row">
        <span className="k">{isTransfer ? "Хто переказав" : "Хто заплатив"}</span>
        <span className="v">{entry.paidBy}</span>
      </div>
      {isTransfer && (
        <div className="detail-row">
          <span className="k">Отримувач</span>
          <span className="v">{entry.splitAmong[0]}</span>
        </div>
      )}
      <div className="detail-row">
        <span className="k">Дата</span>
        <span className="v">{formatDateTime(entry.createdAt)}</span>
      </div>
      {entry.updatedAt && (
        <div className="detail-row">
          <span className="k">Змінено</span>
          <span className="v">{formatDateTime(entry.updatedAt)}</span>
        </div>
      )}

      {!isTransfer && (
        <>
          <div className="share-title">
            Поділено порівну між {entry.splitAmong.length} ос.
          </div>
          {shares.map((s) => (
            <div className="detail-row" key={s.name}>
              <span className="k">{s.name}</span>
              <span className="v">{formatMoney(s.share, group.currency)}</span>
            </div>
          ))}
        </>
      )}

      <div className="modal-actions">
        {!isTransfer && (
          <button className="btn secondary" onClick={() => onEdit(entry)}>
            Редагувати
          </button>
        )}
        <button className="btn danger" onClick={() => onDelete(entry)}>
          Видалити
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Expense form (create + edit) ---------------- */

function ExpenseForm({
  group,
  me,
  initial,
  onDone,
  onCancel,
}: {
  group: Group;
  me: string;
  initial?: Entry;
  onDone: (g: Group) => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountStr, setAmountStr] = useState(
    initial ? String(initial.amount / 100).replace(".", ",") : ""
  );
  const [paidBy, setPaidBy] = useState(initial?.paidBy ?? me);
  const [split, setSplit] = useState<Set<string>>(() =>
    initial
      ? new Set(initial.splitAmong)
      : new Set(group.members.map((m) => m.name))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(name: string) {
    setSplit((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = parseAmount(amountStr);
    if (!amount) {
      setError("Вкажіть коректну суму, напр. 450 або 129,50");
      return;
    }
    if (split.size === 0) {
      setError("Оберіть хоча б одного учасника поділу");
      return;
    }
    setBusy(true);
    try {
      const url = initial
        ? `/api/groups/${group.id}/expenses/${initial.id}`
        : `/api/groups/${group.id}/expenses`;
      const res = await fetch(url, {
        method: initial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "expense",
          description,
          amount,
          paidBy,
          splitAmong: Array.from(split),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Щось пішло не так");
        setBusy(false);
        return;
      }
      onDone(data);
    } catch {
      setError("Немає з'єднання. Спробуйте ще раз.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="desc">Опис</label>
      <input
        id="desc"
        type="text"
        placeholder="Напр. Вечеря в ресторані"
        value={description}
        maxLength={80}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <div className="row-2">
        <div>
          <label htmlFor="amount">Сума, {group.currency}</label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="payer">Хто заплатив</label>
          <select
            id="payer"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
          >
            {group.members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name === me ? `${m.name} (ви)` : m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label>Порівну між</label>
      <div className="split-grid">
        {group.members.map((m) => (
          <label
            key={m.name}
            className={`check ${split.has(m.name) ? "on" : ""}`}
          >
            <input
              type="checkbox"
              checked={split.has(m.name)}
              onChange={() => toggle(m.name)}
            />
            {split.has(m.name) ? "✓ " : ""}
            {m.name}
          </label>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Зберігаємо…" : initial ? "Зберегти зміни" : "Зберегти"}
      </button>
      <button
        className="btn ghost"
        type="button"
        style={{ marginTop: 8 }}
        onClick={onCancel}
      >
        Скасувати
      </button>
    </form>
  );
}

/* ---------------- Balances tab ---------------- */

function BalancesTab({
  group,
  me,
  onChange,
  showToast,
}: {
  group: Group;
  me: string;
  onChange: (g: Group) => void;
  showToast: (m: string) => void;
}) {
  const net = useMemo(() => computeNetBalances(group), [group]);
  const transfers = useMemo(() => simplifyDebts(net), [net]);
  const [pending, setPending] = useState<{ from: string; to: string; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = group.members
    .map((m) => ({ name: m.name, balance: net.get(m.name) ?? 0 }))
    .sort((a, b) => b.balance - a.balance);

  async function confirmSettle() {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "settlement",
          description: "Переказ",
          amount: pending.amount,
          paidBy: pending.from,
          splitAmong: [pending.to],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onChange(data);
        showToast("Переказ записано ✓");
      } else {
        showToast(data?.error ?? "Не вдалося записати");
      }
    } catch {
      showToast("Немає з'єднання");
    }
    setBusy(false);
    setPending(null);
  }

  return (
    <>
      <div className="card">
        <h2>Баланс кожного</h2>
        {rows.map((r) => (
          <div className="balance-row" key={r.name}>
            <span className="name">
              {r.name}
              {r.name === me ? " (ви)" : ""}
            </span>
            <span
              className={r.balance > 0 ? "pos" : r.balance < 0 ? "neg" : "zero"}
            >
              {r.balance === 0
                ? "розраховано"
                : (r.balance > 0 ? "+" : "") +
                  formatMoney(r.balance, group.currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Хто кому винен</h2>
        {transfers.length === 0 ? (
          <div className="empty">
            <div className="big">🎉</div>
            Усі розрахувалися!
          </div>
        ) : (
          transfers.map((t) => {
            const key = `${t.from}->${t.to}`;
            return (
              <div className="transfer-row" key={key}>
                <span>
                  <b>{t.from}</b> → <b>{t.to}</b>:{" "}
                  {formatMoney(t.amount, group.currency)}
                </span>
                <button
                  className="btn small secondary"
                  onClick={() => setPending(t)}
                >
                  Сплачено
                </button>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title="Записати переказ?"
        message={
          pending
            ? `${pending.from} платить ${pending.to} ${formatMoney(pending.amount, group.currency)}. Борг буде закрито.`
            : ""
        }
        confirmLabel="Так, сплачено"
        busy={busy}
        onConfirm={confirmSettle}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
