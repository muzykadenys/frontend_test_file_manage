import type { FilesState, Item } from "@/store/types";

export function sortedVisibleList(files: FilesState): Item[] {
  const q = files.viewMode === "shared" ? "" : files.searchQuery.trim();
  const raw = q ? files.searchResults ?? [] : files.items;
  return [...raw].sort((a, b) => a.sort_order - b.sort_order);
}

export function buildReorderPayload(
  itemsSorted: Item[],
  dragId: string,
  targetId: string,
): { id: string; sortOrder: number }[] | null {
  if (!dragId || dragId === targetId) return null;
  const from = itemsSorted.findIndex((i) => i.id === dragId);
  const to = itemsSorted.findIndex((i) => i.id === targetId);
  if (from < 0 || to < 0) return null;
  const next = [...itemsSorted];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((it, idx) => ({ id: it.id, sortOrder: idx }));
}

export function shareResultAlertVariant(result: string): "default" | "destructive" {
  if (/^https?:\/\//.test(result)) return "default";
  if (
    result === "Share created." ||
    result === "Invitation saved." ||
    result === "Access removed."
  ) {
    return "default";
  }
  return "destructive";
}
