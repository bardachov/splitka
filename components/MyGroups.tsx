"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forgetGroup,
  getRecentGroups,
  type RecentGroup,
} from "@/lib/recentGroups";
import { formatDate } from "@/lib/money";

export default function MyGroups() {
  const router = useRouter();
  const [groups, setGroups] = useState<RecentGroup[] | null>(null);

  useEffect(() => {
    setGroups(getRecentGroups());
  }, []);

  if (!groups || groups.length === 0) return null;

  return (
    <div className="card">
      <h2>Мої групи</h2>
      {groups.map((g) => (
        <div
          className="entry"
          key={g.id}
          role="button"
          tabIndex={0}
          onClick={() => router.push(`/g/${g.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") router.push(`/g/${g.id}`);
          }}
        >
          <div className="icon">👥</div>
          <div className="meta">
            <div className="title">{g.name}</div>
            <div className="who">
              {g.me ? `ви — ${g.me} · ` : ""}
              {formatDate(g.lastVisited)}
            </div>
          </div>
          <button
            className="del"
            title="Прибрати зі списку"
            aria-label={`Прибрати «${g.name}» зі списку`}
            onClick={(e) => {
              e.stopPropagation();
              forgetGroup(g.id);
              setGroups(getRecentGroups());
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="total-line" style={{ marginTop: 6 }}>
        <span>Список зберігається на цьому пристрої</span>
      </div>
    </div>
  );
}
