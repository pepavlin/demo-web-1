/**
 * Tests for the building system: mesh builders, grid snapping, persistence.
 */

// Mock three.js before all imports
jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return actual;
});

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

import {
  buildBlockMesh,
  buildGhostMesh,
  buildSculptIndicator,
  updateGhostMaterial,
  snapToGrid,
  getPlacementPosition,
  blockKey,
  saveBlocks,
  loadBlocks,
  saveWorldItems,
  loadWorldItems,
} from "../lib/buildingSystem";
import type { PlacedWorldItemData } from "../lib/gameTypes";
import {
  BLOCK_DEFS,
  BLOCK_MATERIAL_ORDER,
  BlockMaterial,
  PlacedBlockData,
  BLOCK_SIZE,
  BLOCKS_STORAGE_KEY,
} from "../lib/buildingTypes";
import * as THREE from "three";

// ─── buildBlockMesh ───────────────────────────────────────────────────────────

describe("buildBlockMesh", () => {
  it("returns a THREE.Mesh with correct userData", () => {
    const mesh = buildBlockMesh("wood");
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.isPlacedBlock).toBe(true);
    expect(mesh.userData.blockMaterial).toBe("wood");
  });

  it("sets castShadow and receiveShadow", () => {
    const mesh = buildBlockMesh("stone");
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it("uses the correct colour for each material", () => {
    BLOCK_MATERIAL_ORDER.forEach((mat) => {
      const mesh = buildBlockMesh(mat);
      const material = mesh.material as THREE.MeshLambertMaterial;
      const expectedColor = new THREE.Color(BLOCK_DEFS[mat].color);
      expect(material.color.r).toBeCloseTo(expectedColor.r, 4);
      expect(material.color.g).toBeCloseTo(expectedColor.g, 4);
      expect(material.color.b).toBeCloseTo(expectedColor.b, 4);
    });
  });

  it("sets transparent material for glass", () => {
    const mesh = buildBlockMesh("glass");
    const mat = mesh.material as THREE.MeshLambertMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
  });

  it("sets transparent material for crystal", () => {
    const mesh = buildBlockMesh("crystal");
    const mat = mesh.material as THREE.MeshLambertMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
  });

  it("sets emissive for crystal", () => {
    const mesh = buildBlockMesh("crystal");
    const mat = mesh.material as THREE.MeshLambertMaterial;
    const emissive = new THREE.Color(BLOCK_DEFS.crystal.emissive!);
    expect(mat.emissive.r).toBeCloseTo(emissive.r, 4);
  });

  it("creates a box-shaped geometry (6 groups or BoxGeometry)", () => {
    const mesh = buildBlockMesh("brick");
    // BoxGeometry has position attribute with 24 vertices
    expect(mesh.geometry.attributes.position.count).toBe(24);
  });
});

// ─── buildGhostMesh ───────────────────────────────────────────────────────────

describe("buildGhostMesh", () => {
  it("returns a mesh with isGhost userData", () => {
    const ghost = buildGhostMesh("wood");
    expect(ghost).toBeInstanceOf(THREE.Mesh);
    expect(ghost.userData.isGhost).toBe(true);
  });

  it("starts invisible", () => {
    const ghost = buildGhostMesh("stone");
    expect(ghost.visible).toBe(false);
  });

  it("uses transparent material with low opacity", () => {
    const ghost = buildGhostMesh("dirt");
    const mat = ghost.material as THREE.MeshLambertMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.6);
  });
});

// ─── buildSculptIndicator ─────────────────────────────────────────────────────

describe("buildSculptIndicator", () => {
  it("returns a mesh and starts invisible", () => {
    const ring = buildSculptIndicator(5);
    expect(ring).toBeInstanceOf(THREE.Mesh);
    expect(ring.visible).toBe(false);
  });

  it("rotates flat (rotation.x = -PI/2)", () => {
    const ring = buildSculptIndicator(5);
    expect(ring.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
  });
});

// ─── updateGhostMaterial ──────────────────────────────────────────────────────

describe("updateGhostMaterial", () => {
  it("changes ghost mesh colour to match the target material", () => {
    const ghost = buildGhostMesh("wood");
    updateGhostMaterial(ghost, "stone");
    const mat = ghost.material as THREE.MeshLambertMaterial;
    const expected = new THREE.Color(BLOCK_DEFS.stone.color);
    expect(mat.color.r).toBeCloseTo(expected.r, 4);
    expect(mat.color.g).toBeCloseTo(expected.g, 4);
    expect(mat.color.b).toBeCloseTo(expected.b, 4);
  });
});

// ─── snapToGrid ───────────────────────────────────────────────────────────────

describe("snapToGrid", () => {
  it("rounds to nearest grid cell", () => {
    const [x, y, z] = snapToGrid(0.4, 0.6, -0.3);
    expect(x).toBeCloseTo(0, 9);
    expect(y).toBeCloseTo(BLOCK_SIZE, 9);
    expect(z).toBeCloseTo(0, 9);
  });

  it("snaps negative positions correctly", () => {
    const [x, y, z] = snapToGrid(-1.6, -0.4, -2.8);
    expect(x).toBeCloseTo(-2 * BLOCK_SIZE, 9);
    expect(y).toBeCloseTo(0, 9);
    expect(z).toBeCloseTo(-3 * BLOCK_SIZE, 9);
  });

  it("exact integer multiples remain unchanged", () => {
    const [x, y, z] = snapToGrid(3, 5, -2);
    expect(x).toBe(3);
    expect(y).toBe(5);
    expect(z).toBe(-2);
  });
});

// ─── getPlacementPosition ─────────────────────────────────────────────────────

describe("getPlacementPosition", () => {
  it("places block above a terrain hit with an upward normal", () => {
    const hitPoint = new THREE.Vector3(0, 2, 0);
    const normal = new THREE.Vector3(0, 1, 0);
    const pos = getPlacementPosition(hitPoint, normal);
    expect(pos.y).toBeGreaterThan(hitPoint.y);
    expect(pos.x).toBe(0);
    expect(pos.z).toBe(0);
  });

  it("places block to the side when normal is horizontal", () => {
    const hitPoint = new THREE.Vector3(1.5, 0, 0);
    const normal = new THREE.Vector3(1, 0, 0);
    const pos = getPlacementPosition(hitPoint, normal);
    // Should snap rightward
    expect(pos.x).toBeGreaterThan(hitPoint.x);
    expect(pos.y).toBe(0);
    expect(pos.z).toBe(0);
  });

  it("returns a grid-aligned position", () => {
    const hitPoint = new THREE.Vector3(0.3, 1.8, -0.2);
    const normal = new THREE.Vector3(0, 1, 0);
    const pos = getPlacementPosition(hitPoint, normal);
    expect(pos.x % BLOCK_SIZE).toBeCloseTo(0, 5);
    expect(pos.y % BLOCK_SIZE).toBeCloseTo(0, 5);
    expect(pos.z % BLOCK_SIZE).toBeCloseTo(0, 5);
  });
});

// ─── blockKey ─────────────────────────────────────────────────────────────────

describe("blockKey", () => {
  it("produces a unique string for each position", () => {
    const k1 = blockKey(1, 2, 3);
    const k2 = blockKey(1, 2, 4);
    const k3 = blockKey(1, 2, 3);
    expect(k1).not.toBe(k2);
    expect(k1).toBe(k3);
  });

  it("handles negative coordinates", () => {
    const k = blockKey(-5, 0, -10);
    expect(k).toBe("-5,0,-10");
  });
});

// ─── saveBlocks / loadBlocks ──────────────────────────────────────────────────

describe("saveBlocks / loadBlocks", () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it("returns empty array when nothing is saved", () => {
    expect(loadBlocks()).toEqual([]);
  });

  it("saves and reloads blocks correctly", () => {
    const blocks: PlacedBlockData[] = [
      { x: 0, y: 1, z: 0, material: "wood" },
      { x: 2, y: 1, z: -3, material: "stone" },
      { x: -1, y: 2, z: 5, material: "crystal" },
    ];
    saveBlocks(blocks);
    const loaded = loadBlocks();
    expect(loaded).toHaveLength(3);
    expect(loaded[0]).toEqual({ x: 0, y: 1, z: 0, material: "wood" });
    expect(loaded[1]).toEqual({ x: 2, y: 1, z: -3, material: "stone" });
    expect(loaded[2]).toEqual({ x: -1, y: 2, z: 5, material: "crystal" });
  });

  it("saves all 8 material types correctly", () => {
    const blocks: PlacedBlockData[] = BLOCK_MATERIAL_ORDER.map((mat, i) => ({
      x: i,
      y: 0,
      z: 0,
      material: mat,
    }));
    saveBlocks(blocks);
    const loaded = loadBlocks();
    expect(loaded).toHaveLength(8);
    loaded.forEach((b, i) => {
      expect(b.material).toBe(BLOCK_MATERIAL_ORDER[i]);
    });
  });

  it("uses the correct localStorage key", () => {
    saveBlocks([{ x: 0, y: 0, z: 0, material: "wood" }]);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      BLOCKS_STORAGE_KEY,
      expect.any(String)
    );
  });

  it("returns empty array if localStorage contains invalid JSON", () => {
    localStorageMock.getItem.mockReturnValueOnce("this is not valid JSON {{");
    expect(loadBlocks()).toEqual([]);
  });

  it("filters out entries with invalid material index", () => {
    // Manually store compact data with an out-of-range material index
    const invalid = JSON.stringify([[0, 0, 0, 99]]);
    localStorageMock.getItem.mockReturnValueOnce(invalid);
    expect(loadBlocks()).toEqual([]);
  });

  it("handles empty block list", () => {
    saveBlocks([]);
    expect(loadBlocks()).toEqual([]);
  });
});

// ─── BLOCK_DEFS completeness ──────────────────────────────────────────────────

describe("BLOCK_DEFS", () => {
  it("defines every material in BLOCK_MATERIAL_ORDER", () => {
    BLOCK_MATERIAL_ORDER.forEach((mat) => {
      expect(BLOCK_DEFS[mat]).toBeDefined();
      expect(BLOCK_DEFS[mat].label).toBeTruthy();
      expect(typeof BLOCK_DEFS[mat].color).toBe("number");
    });
  });

  it("all 8 materials are present", () => {
    expect(BLOCK_MATERIAL_ORDER).toHaveLength(8);
  });
});

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
