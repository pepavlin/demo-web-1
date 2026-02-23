/**
 * Tests for mesh builder functions.
 * THREE.js geometry/material creation works in jsdom (no WebGL needed).
 */

// Mock THREE.js WebGL renderer to avoid WebGL context errors
jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: document.createElement("canvas"),
      shadowMap: { enabled: false, type: null },
      toneMapping: null,
      toneMappingExposure: 1,
    })),
  };
});

import {
  buildSheepMesh,
  buildFoxMesh,
  buildTreeMesh,
  buildRockMesh,
  buildCoinMesh,
  buildWindmill,
  buildHouse,
  buildRuins,
  buildLighthouse,
  buildBulletMesh,
  buildWeaponMesh,
} from "@/lib/meshBuilders";
import * as THREE from "three";

// Seeded RNG for deterministic tests
function makeRng(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

describe("buildSheepMesh", () => {
  it("returns an object with a group, legPivots, headGroup, bodyGroup, tailGroup", () => {
    const parts = buildSheepMesh();
    expect(parts.group).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(parts.legPivots)).toBe(true);
    expect(parts.legPivots.length).toBe(4);
    expect(parts.headGroup).toBeInstanceOf(THREE.Group);
    expect(parts.bodyGroup).toBeInstanceOf(THREE.Group);
    expect(parts.tailGroup).toBeInstanceOf(THREE.Group);
  });

  it("group has children (body parts)", () => {
    const { group } = buildSheepMesh();
    expect(group.children.length).toBeGreaterThan(0);
  });

  it("group has castShadow enabled", () => {
    const { group } = buildSheepMesh();
    expect(group.castShadow).toBe(true);
  });

  it("group is scaled", () => {
    const { group } = buildSheepMesh();
    // Scale was changed to 0.82 for the improved model
    expect(group.scale.x).toBeGreaterThan(0.7);
    expect(group.scale.x).toBeLessThan(1.0);
  });

  it("all four leg pivots are THREE.Group instances", () => {
    const { legPivots } = buildSheepMesh();
    legPivots.forEach((pivot) => {
      expect(pivot).toBeInstanceOf(THREE.Group);
    });
  });

  it("each leg pivot has a mesh child (leg + hoof)", () => {
    const { legPivots } = buildSheepMesh();
    legPivots.forEach((pivot) => {
      expect(pivot.children.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("buildFoxMesh", () => {
  it("returns a THREE.Group", () => {
    const mesh = buildFoxMesh();
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it("has multiple children (body parts)", () => {
    const mesh = buildFoxMesh();
    expect(mesh.children.length).toBeGreaterThan(5);
  });

  it("has castShadow enabled", () => {
    const mesh = buildFoxMesh();
    expect(mesh.castShadow).toBe(true);
  });
});

describe("buildTreeMesh", () => {
  it("returns a THREE.Group", () => {
    const rng = makeRng(42);
    const mesh = buildTreeMesh(rng);
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it("has trunk and at least one leaf layer", () => {
    const rng = makeRng(42);
    const mesh = buildTreeMesh(rng);
    expect(mesh.children.length).toBeGreaterThanOrEqual(3);
  });

  it("produces different trees for different seeds", () => {
    const rng1 = makeRng(1);
    const rng2 = makeRng(99);
    const tree1 = buildTreeMesh(rng1);
    const tree2 = buildTreeMesh(rng2);
    // Different seeds → different child counts or positions
    const same =
      tree1.children.length === tree2.children.length &&
      (tree1.children[0] as THREE.Mesh).position.y ===
        (tree2.children[0] as THREE.Mesh).position.y;
    expect(same).toBe(false);
  });
});

describe("buildRockMesh", () => {
  it("returns a THREE.Mesh", () => {
    const rng = makeRng(42);
    const mesh = buildRockMesh(rng);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it("has castShadow and receiveShadow", () => {
    const rng = makeRng(42);
    const mesh = buildRockMesh(rng);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });
});

describe("buildCoinMesh", () => {
  it("returns a THREE.Mesh", () => {
    const mesh = buildCoinMesh();
    expect(mesh).toBeInstanceOf(THREE.Mesh);
  });

  it("uses a gold-ish color", () => {
    const mesh = buildCoinMesh();
    const mat = mesh.material as THREE.MeshLambertMaterial;
    // Three.js stores colors in linear space; 0xffd700 red channel is 0xff=255 → linear ~1.0
    // The green channel 0xd7=215 → sRGB ~0.84 → linear ~0.68 (gamma 2.2 conversion)
    // We verify red > green > blue to confirm a warm gold-like hue
    expect(mat.color.r).toBeGreaterThan(mat.color.g);
    expect(mat.color.g).toBeGreaterThan(mat.color.b);
    expect(mat.color.r).toBeGreaterThan(0.9);
  });
});

describe("buildWindmill", () => {
  it("returns group and blades", () => {
    const { group, blades } = buildWindmill();
    expect(group).toBeInstanceOf(THREE.Group);
    expect(blades).toBeInstanceOf(THREE.Group);
  });

  it("blades are part of the group", () => {
    const { group, blades } = buildWindmill();
    // blades should be in the group's children tree
    let found = false;
    group.traverse((child) => {
      if (child === blades) found = true;
    });
    expect(found).toBe(true);
  });

  it("blades have 4 children (one per arm)", () => {
    const { blades } = buildWindmill();
    expect(blades.children.length).toBe(4);
  });

  it("tower has castShadow", () => {
    const { group } = buildWindmill();
    const meshes = group.children.filter((c) => c instanceof THREE.Mesh);
    const hasCastShadow = meshes.some((m) => (m as THREE.Mesh).castShadow);
    expect(hasCastShadow).toBe(true);
  });
});

describe("buildHouse", () => {
  it("returns a THREE.Group", () => {
    const rng = makeRng(1);
    const house = buildHouse(rng);
    expect(house).toBeInstanceOf(THREE.Group);
  });

  it("has walls, roof, and details", () => {
    const rng = makeRng(1);
    const house = buildHouse(rng);
    expect(house.children.length).toBeGreaterThan(3);
  });
});

describe("buildRuins", () => {
  it("returns a THREE.Group", () => {
    const rng = makeRng(1);
    const ruins = buildRuins(rng);
    expect(ruins).toBeInstanceOf(THREE.Group);
  });

  it("has walls, columns, and debris", () => {
    const rng = makeRng(1);
    const ruins = buildRuins(rng);
    expect(ruins.children.length).toBeGreaterThan(5);
  });

  it("all mesh children have castShadow", () => {
    const rng = makeRng(1);
    const ruins = buildRuins(rng);
    ruins.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        expect(child.castShadow).toBe(true);
      }
    });
  });
});

describe("buildLighthouse", () => {
  it("returns a THREE.Group", () => {
    const lighthouse = buildLighthouse();
    expect(lighthouse).toBeInstanceOf(THREE.Group);
  });

  it("has multiple band segments and a lantern", () => {
    const lighthouse = buildLighthouse();
    expect(lighthouse.children.length).toBeGreaterThan(5);
  });
});

describe("buildBulletMesh", () => {
  it("returns a THREE.Mesh", () => {
    const bullet = buildBulletMesh();
    expect(bullet).toBeInstanceOf(THREE.Mesh);
  });

  it("uses a bright yellow MeshBasicMaterial", () => {
    const bullet = buildBulletMesh();
    const mat = bullet.material as THREE.MeshBasicMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    // Yellow: red high, green high, blue low
    expect(mat.color.r).toBeGreaterThan(0.8);
    expect(mat.color.g).toBeGreaterThan(0.8);
    expect(mat.color.b).toBeLessThan(0.3);
  });

  it("has a small sphere geometry (radius ~0.07)", () => {
    const bullet = buildBulletMesh();
    const geo = bullet.geometry as THREE.SphereGeometry;
    expect(geo).toBeInstanceOf(THREE.SphereGeometry);
    // SphereGeometry parameters property holds the initial args
    expect(geo.parameters.radius).toBeCloseTo(0.07, 2);
  });
});

describe("buildWeaponMesh", () => {
  it("returns a THREE.Group", () => {
    const weapon = buildWeaponMesh();
    expect(weapon).toBeInstanceOf(THREE.Group);
  });

  it("has multiple parts (slide, barrel, grip, guard, sight)", () => {
    const weapon = buildWeaponMesh();
    expect(weapon.children.length).toBeGreaterThanOrEqual(5);
  });

  it("all parts are THREE.Mesh instances", () => {
    const weapon = buildWeaponMesh();
    weapon.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("uses dark material colors (grey/black gun finish)", () => {
    const weapon = buildWeaponMesh();
    // Every material color should be dark (max channel < 0.35)
    weapon.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
      const maxChannel = Math.max(mat.color.r, mat.color.g, mat.color.b);
      expect(maxChannel).toBeLessThan(0.35);
    });
  });
});
