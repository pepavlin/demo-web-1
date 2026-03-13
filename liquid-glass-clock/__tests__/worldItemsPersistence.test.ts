/**
 * Tests for world item persistence: saveWorldItems / loadWorldItems.
 */

// Mock localStorage for save/load tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

import { saveWorldItems, loadWorldItems } from "../lib/worldItemsPersistence";
import type { PlacedWorldItemData } from "../lib/gameTypes";

// ─── saveWorldItems / loadWorldItems ──────────────────────────────────────────

describe("saveWorldItems", () => {
  beforeEach(() => localStorageMock.clear());

  it("persists a pumpkin placement to localStorage", () => {
    const item: PlacedWorldItemData = { type: "pumpkin", x: 10, y: 2.5, z: -8, rotY: 1.2 };
    saveWorldItems([item]);
    expect(localStorageMock.setItem).toHaveBeenCalled();
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe("pumpkin");
    expect(stored[0].x).toBe(10);
  });

  it("persists multiple items", () => {
    const items: PlacedWorldItemData[] = [
      { type: "pumpkin", x: 0, y: 0, z: 0, rotY: 0 },
      { type: "pumpkin", x: 5, y: 0, z: 5, rotY: 1.0 },
    ];
    saveWorldItems(items);
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    expect(stored).toHaveLength(2);
  });

  it("persists an empty list", () => {
    saveWorldItems([]);
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.at(-1)![1]);
    expect(stored).toEqual([]);
  });
});

describe("loadWorldItems", () => {
  beforeEach(() => localStorageMock.clear());

  it("returns empty array when nothing is stored", () => {
    localStorageMock.getItem.mockReturnValueOnce(null);
    expect(loadWorldItems()).toEqual([]);
  });

  it("round-trips a saved pumpkin placement", () => {
    const items: PlacedWorldItemData[] = [
      { type: "pumpkin", x: 12, y: 1.0, z: -7, rotY: 0.5 },
    ];
    saveWorldItems(items);
    // Simulate localStorage returning what was stored
    const saved = localStorageMock.setItem.mock.calls.at(-1)![1];
    localStorageMock.getItem.mockReturnValueOnce(saved);
    const loaded = loadWorldItems();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].type).toBe("pumpkin");
    expect(loaded[0].x).toBe(12);
    expect(loaded[0].z).toBe(-7);
    expect(loaded[0].rotY).toBe(0.5);
  });

  it("filters out entries with unknown item type", () => {
    const raw = JSON.stringify([
      { type: "unknown_item", x: 0, y: 0, z: 0, rotY: 0 },
      { type: "pumpkin", x: 1, y: 0, z: 1, rotY: 0 },
    ]);
    localStorageMock.getItem.mockReturnValueOnce(raw);
    const loaded = loadWorldItems();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].type).toBe("pumpkin");
  });

  it("filters out entries with missing numeric fields", () => {
    const raw = JSON.stringify([
      { type: "pumpkin", x: "not-a-number", y: 0, z: 0, rotY: 0 },
    ]);
    localStorageMock.getItem.mockReturnValueOnce(raw);
    expect(loadWorldItems()).toEqual([]);
  });

  it("returns empty array on invalid JSON", () => {
    localStorageMock.getItem.mockReturnValueOnce("not json {{");
    expect(loadWorldItems()).toEqual([]);
  });
});
