export type RecentGroup = {
  id: string;
  name: string;
  me?: string;
  lastVisited: number;
};

const KEY = "splitka:groups";
const MAX_RECENT = 30;

export function getRecentGroups(): RecentGroup[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (g): g is RecentGroup =>
          !!g && typeof g.id === "string" && typeof g.name === "string"
      )
      .sort((a, b) => (b.lastVisited ?? 0) - (a.lastVisited ?? 0));
  } catch {
    return [];
  }
}

export function rememberGroup(id: string, name: string, me?: string): void {
  try {
    const rest = getRecentGroups().filter((g) => g.id !== id);
    const next: RecentGroup[] = [
      { id, name, me, lastVisited: Date.now() },
      ...rest,
    ].slice(0, MAX_RECENT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function forgetGroup(id: string): void {
  try {
    const next = getRecentGroups().filter((g) => g.id !== id);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
