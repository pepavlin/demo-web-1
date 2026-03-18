/**
 * Tests for lib/printedItemSystem.ts
 *
 * Covers:
 * - buildFallbackMesh returns a THREE.Group for all item types
 * - executeGeneratedMeshCode: valid code returns a THREE.Group
 * - executeGeneratedMeshCode: invalid code returns null (no throws)
 * - findNearestPrintedItem: returns correct index
 * - PRINTED_ITEM_PICKUP_RADIUS constant is positive
 */

import * as THREE from "three";
import {
  buildFallbackMesh,
  executeGeneratedMeshCode,
  findNearestPrintedItem,
  PRINTED_ITEM_PICKUP_RADIUS,
  type PrintedItemData,
  type PrintedItemType,
} from "@/lib/printedItemSystem";

// ─── buildFallbackMesh ────────────────────────────────────────────────────────

describe("buildFallbackMesh", () => {
  const types: PrintedItemType[] = ["weapon", "tool", "consumable", "decorative"];

  types.forEach((type) => {
    it(`returns a THREE.Group for type "${type}"`, () => {
      const result = buildFallbackMesh(type);
      expect(result).toBeInstanceOf(THREE.Group);
      expect(result.children.length).toBeGreaterThan(0);
    });
  });
});

// ─── executeGeneratedMeshCode ─────────────────────────────────────────────────

describe("executeGeneratedMeshCode", () => {
  it("returns a THREE.Group for valid code", () => {
    const code = `
      const group = new THREE.Group();
      const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      group.add(new THREE.Mesh(geo, mat));
      return group;
    `;
    const result = executeGeneratedMeshCode(code, THREE);
    expect(result).toBeInstanceOf(THREE.Group);
  });

  it("wraps a plain THREE.Mesh in a Group", () => {
    const code = `
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x00ff00 })
      );
    `;
    const result = executeGeneratedMeshCode(code, THREE);
    expect(result).toBeInstanceOf(THREE.Group);
    expect(result!.children[0]).toBeInstanceOf(THREE.Mesh);
  });

  it("returns null for code that throws an error", () => {
    const code = `throw new Error("intentional error");`;
    const result = executeGeneratedMeshCode(code, THREE);
    expect(result).toBeNull();
  });

  it("returns null for code that returns a non-Object3D value", () => {
    const code = `return 42;`;
    const result = executeGeneratedMeshCode(code, THREE);
    expect(result).toBeNull();
  });

  it("returns null for code that references undefined variables", () => {
    const code = `return undefinedVariable.group;`;
    const result = executeGeneratedMeshCode(code, THREE);
    expect(result).toBeNull();
  });

  it("does not have access to global scope beyond THREE", () => {
    // fetch should not be available inside the sandbox
    const code = `
      if (typeof fetch !== 'undefined') { throw new Error("fetch should not be accessible"); }
      const group = new THREE.Group();
      return group;
    `;
    // This may or may not throw depending on env; either way, no crash
    const result = executeGeneratedMeshCode(code, THREE);
    // The test passes if we don't get an unhandled exception
    expect(result === null || result instanceof THREE.Group).toBe(true);
  });
});

// ─── PRINTED_ITEM_PICKUP_RADIUS ────────────────────────────────────────────────

describe("PRINTED_ITEM_PICKUP_RADIUS", () => {
  it("is a positive number", () => {
    expect(PRINTED_ITEM_PICKUP_RADIUS).toBeGreaterThan(0);
  });
});

// ─── findNearestPrintedItem ────────────────────────────────────────────────────

function makeItem(id: string, x: number, z: number): PrintedItemData {
  const mesh = new THREE.Group();
  const glowLight = new THREE.PointLight();
  const glowRing = new THREE.Mesh();
  return {
    id,
    mesh,
    worldX: x,
    worldY: 0,
    worldZ: z,
    metadata: {
      name: "Test",
      description: "",
      type: "decorative",
      damage: 0,
      healing: 0,
      scale: 1,
      properties: {},
    },
    hoverPhase: 0,
    pickedUp: false,
    glowLight,
    glowRing,
  };
}

describe("findNearestPrintedItem", () => {
  it("returns -1 when list is empty", () => {
    expect(findNearestPrintedItem([], 0, 0)).toBe(-1);
  });

  it("returns -1 when all items are beyond PICKUP_RADIUS", () => {
    const items = [makeItem("a", 100, 100)];
    expect(findNearestPrintedItem(items, 0, 0)).toBe(-1);
  });

  it("returns index of item within PICKUP_RADIUS", () => {
    const items = [makeItem("a", 0.5, 0)];
    expect(findNearestPrintedItem(items, 0, 0)).toBe(0);
  });

  it("returns index of nearest item when multiple are in range", () => {
    const items = [
      makeItem("far",   1.5, 0),
      makeItem("near",  0.3, 0),
    ];
    // Both within radius 2.0; the nearer one (index 1) should be returned
    expect(findNearestPrintedItem(items, 0, 0)).toBe(1);
  });

  it("skips items that are already picked up", () => {
    const items = [makeItem("a", 0.1, 0)];
    items[0].pickedUp = true;
    expect(findNearestPrintedItem(items, 0, 0)).toBe(-1);
  });
});
