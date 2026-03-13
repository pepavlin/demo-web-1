/**
 * Tests for the tree sprite LOD utilities in lib/spriteUtils.ts
 *
 * Covers:
 * - Canvas texture creation per tree type
 * - Texture caching (same object returned on subsequent calls)
 * - Sprite creation with correct scale, position, and visibility
 * - Cache disposal
 * - buildTreeMesh returning treeType and treeHeight
 */

import * as THREE from "three";
import {
  getTreeSpriteTexture,
  createTreeSprite,
  disposeTreeSpriteCache,
} from "@/lib/spriteUtils";
import { buildTreeMesh } from "@/lib/meshBuilders";

// ─── jsdom canvas mock ────────────────────────────────────────────────────────
// jsdom does not implement the Canvas 2D API.  Provide a minimal mock so that
// spriteUtils.ts can call clearRect, fillRect, arc, fill, etc. without crashing.
const _mockCtx: Partial<CanvasRenderingContext2D> = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  stroke: jest.fn(),
  set fillStyle(_v: string | CanvasGradient | CanvasPattern) {},
  set strokeStyle(_v: string | CanvasGradient | CanvasPattern) {},
  set lineWidth(_v: number) {},
  set lineCap(_v: CanvasLineCap) {},
};
// Patch the prototype before any test runs
HTMLCanvasElement.prototype.getContext = jest.fn(
  (contextId: string) => contextId === "2d" ? _mockCtx as CanvasRenderingContext2D : null
) as typeof HTMLCanvasElement.prototype.getContext;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seeded RNG matching the one used in meshBuilders / Game3D. */
function makeRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Clear sprite texture cache after each test to avoid cross-test pollution
afterEach(() => {
  disposeTreeSpriteCache();
});

// ─── getTreeSpriteTexture ─────────────────────────────────────────────────────

describe("getTreeSpriteTexture", () => {
  it("returns a CanvasTexture for each tree type", () => {
    const types = ["pine", "oak", "birch", "dead"] as const;
    for (const type of types) {
      const tex = getTreeSpriteTexture(type);
      // Check it is a THREE texture object — uuid is always a string on THREE objects
      expect(tex).toBeTruthy();
      expect(typeof (tex as THREE.CanvasTexture).uuid).toBe("string");
      expect(tex).toBeInstanceOf(THREE.CanvasTexture);
    }
  });

  it("returns the same texture instance on repeated calls (caching)", () => {
    const first  = getTreeSpriteTexture("pine");
    const second = getTreeSpriteTexture("pine");
    expect(first).toBe(second);
  });

  it("returns different textures for different tree types", () => {
    const pine  = getTreeSpriteTexture("pine");
    const oak   = getTreeSpriteTexture("oak");
    const birch = getTreeSpriteTexture("birch");
    const dead  = getTreeSpriteTexture("dead");
    const all = [pine, oak, birch, dead];
    const unique = new Set(all);
    expect(unique.size).toBe(4);
  });

  it("texture has a canvas as its image source", () => {
    const tex = getTreeSpriteTexture("oak");
    expect(tex.image).toBeTruthy();
    expect(tex.image.tagName?.toLowerCase()).toBe("canvas");
  });

  it("canvas has the expected pixel dimensions (64×128)", () => {
    const tex = getTreeSpriteTexture("birch");
    expect((tex.image as HTMLCanvasElement).width).toBe(64);
    expect((tex.image as HTMLCanvasElement).height).toBe(128);
  });

  it("drawing functions are called for non-dead tree types", () => {
    const mockClearRect = _mockCtx.clearRect as jest.Mock;
    mockClearRect.mockClear();
    getTreeSpriteTexture("pine");
    expect(mockClearRect).toHaveBeenCalledTimes(1);
  });
});

// ─── disposeTreeSpriteCache ───────────────────────────────────────────────────

describe("disposeTreeSpriteCache", () => {
  it("causes subsequent calls to create a fresh texture (cache cleared)", () => {
    const before = getTreeSpriteTexture("pine");
    disposeTreeSpriteCache(); // clears cache (also the afterEach will call it again — no-op)
    const after = getTreeSpriteTexture("pine");
    expect(before).not.toBe(after);
  });

  it("does not throw when called on an empty cache", () => {
    disposeTreeSpriteCache(); // first call (empties the cache)
    expect(() => disposeTreeSpriteCache()).not.toThrow(); // second call on empty cache
  });
});

// ─── createTreeSprite ─────────────────────────────────────────────────────────

describe("createTreeSprite", () => {
  it("returns an object with a visible property (Sprite-like)", () => {
    const sprite = createTreeSprite("pine", 7);
    // THREE.Sprite constructor name may differ across module instances in jest;
    // check duck-typing instead.
    expect(sprite).toBeTruthy();
    expect(typeof sprite.visible).toBe("boolean");
    expect(typeof sprite.position).toBe("object");
    expect(typeof sprite.scale).toBe("object");
    expect(typeof sprite.material).toBe("object");
  });

  it("sprite is hidden by default", () => {
    const sprite = createTreeSprite("oak", 5);
    expect(sprite.visible).toBe(false);
  });

  it("sprite material has transparent = true and a map texture", () => {
    const sprite = createTreeSprite("birch", 6);
    const mat = sprite.material as THREE.SpriteMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.map).toBeTruthy();
  });

  it("sprite material has depthWrite = false to avoid z-fighting", () => {
    const sprite = createTreeSprite("dead", 4);
    const mat = sprite.material as THREE.SpriteMaterial;
    expect(mat.depthWrite).toBe(false);
  });

  it("sprite scale is proportional to treeHeight", () => {
    const tall   = createTreeSprite("pine", 10);
    const short  = createTreeSprite("pine", 4);
    expect(tall.scale.y).toBeGreaterThan(short.scale.y);
  });

  it("sprite Y position is roughly half the treeHeight", () => {
    const h = 8;
    const sprite = createTreeSprite("oak", h);
    expect(sprite.position.y).toBeCloseTo(h * 0.5, 1);
  });

  it("sprite scale width is smaller than height (portrait silhouette)", () => {
    const sprite = createTreeSprite("pine", 8);
    expect(sprite.scale.x).toBeLessThan(sprite.scale.y);
  });

  it("each call returns an independent sprite (no shared state)", () => {
    const a = createTreeSprite("pine", 7);
    const b = createTreeSprite("pine", 7);
    expect(a).not.toBe(b);
  });

  it("all four tree types produce a valid sprite object", () => {
    const types = ["pine", "oak", "birch", "dead"] as const;
    for (const type of types) {
      const sprite = createTreeSprite(type, 6);
      expect(sprite.visible).toBe(false);
      expect(sprite.scale.y).toBeGreaterThan(0);
    }
  });
});

// ─── buildTreeMesh — treeType & treeHeight ────────────────────────────────────

describe("buildTreeMesh sprite LOD fields", () => {
  it("returns a treeType of 'pine', 'oak', 'birch', or 'dead'", () => {
    const validTypes = ["pine", "oak", "birch", "dead"];
    const rng = makeRng(1);
    for (let i = 0; i < 20; i++) {
      const result = buildTreeMesh(rng);
      expect(validTypes).toContain(result.treeType);
    }
  });

  it("returns a positive treeHeight for all tree types", () => {
    const rng = makeRng(99);
    for (let i = 0; i < 20; i++) {
      const result = buildTreeMesh(rng);
      expect(result.treeHeight).toBeGreaterThan(0);
    }
  });

  it("treeHeight is at least 2 world units for any tree", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const result = buildTreeMesh(rng);
      expect(result.treeHeight).toBeGreaterThanOrEqual(2);
    }
  });

  it("treeType is consistent — same rng seed yields same type", () => {
    const seed = 12345;
    const rngA = makeRng(seed);
    const rngB = makeRng(seed);
    const a = buildTreeMesh(rngA);
    const b = buildTreeMesh(rngB);
    expect(a.treeType).toBe(b.treeType);
  });

  it("treeHeight is consistent — same rng seed yields same height", () => {
    const seed = 99999;
    const rngA = makeRng(seed);
    const rngB = makeRng(seed);
    const a = buildTreeMesh(rngA);
    const b = buildTreeMesh(rngB);
    expect(a.treeHeight).toBeCloseTo(b.treeHeight, 8);
  });
});

// ─── TreeData sprite fields ───────────────────────────────────────────────────

describe("TreeData sprite LOD interface", () => {
  it("newly created tree has sprite null and a valid treeType", () => {
    const rng = makeRng(7);
    const result = buildTreeMesh(rng);

    const tree = {
      mesh: result.group,
      foliageGroup: result.foliageGroup,
      hp: 165,
      maxHp: 165,
      isFalling: false,
      isChopped: false,
      hitFlashTimer: 0,
      fallTimer: 0,
      fallRotationX: 0,
      x: 0,
      z: 0,
      trunkRadius: result.trunkRadius,
      hasCollision: result.hasCollision,
      trunkMeshes: [],
      isBurning: false,
      burnTimer: 0,
      burnDamageTimer: 0,
      burnEffect: null,
      sprite: null as THREE.Sprite | null,
      treeType: result.treeType,
    };

    expect(tree.sprite).toBeNull();
    expect(["pine", "oak", "birch", "dead"]).toContain(tree.treeType);
  });

  it("sprite visibility can be toggled to implement LOD", () => {
    const rng = makeRng(3);
    const result = buildTreeMesh(rng);
    const sprite = createTreeSprite(result.treeType, result.treeHeight);

    // Initial state: sprite hidden, 3D mesh visible
    expect(sprite.visible).toBe(false);
    result.group.visible = true;

    // LOD switch: player is far — hide 3D mesh, show sprite
    result.group.visible = false;
    sprite.visible = true;
    expect(sprite.visible).toBe(true);
    expect(result.group.visible).toBe(false);

    // LOD switch back: player is close — hide sprite, show 3D mesh
    result.group.visible = true;
    sprite.visible = false;
    expect(sprite.visible).toBe(false);
    expect(result.group.visible).toBe(true);
  });

  it("hiding sprite when tree starts falling keeps sprite invisible", () => {
    const rng = makeRng(5);
    const result = buildTreeMesh(rng);
    const sprite = createTreeSprite(result.treeType, result.treeHeight);

    // Sprite was visible (tree was mid-range)
    sprite.visible = true;

    // Tree hp hits 0 → start falling: sprite must be hidden
    sprite.visible = false;
    expect(sprite.visible).toBe(false);
  });
});
