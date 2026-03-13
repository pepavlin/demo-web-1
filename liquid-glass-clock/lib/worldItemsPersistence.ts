/**
 * World item persistence helpers.
 * Saves and loads placed world items (pumpkins, etc.) to/from localStorage.
 */

import type { PlacedWorldItemData, WorldItemType } from "./gameTypes";

const WORLD_ITEMS_STORAGE_KEY = "game3d_world_items_v1";

/** Serialize placed world items to localStorage. */
export function saveWorldItems(items: PlacedWorldItemData[]): void {
  try {
    localStorage.setItem(WORLD_ITEMS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage might be unavailable (private mode, quota exceeded)
  }
}

/** Load placed world items from localStorage. Returns empty array if nothing saved. */
export function loadWorldItems(): PlacedWorldItemData[] {
  const validTypes: WorldItemType[] = ["pumpkin"];
  try {
    const raw = localStorage.getItem(WORLD_ITEMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlacedWorldItemData[];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.z === "number" &&
        typeof item.rotY === "number" &&
        validTypes.includes(item.type)
    );
  } catch {
    return [];
  }
}
