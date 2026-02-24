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
  buildBushMesh,
  buildRockMesh,
  buildCoinMesh,
  buildWindmill,
  buildHouse,
  buildRuins,
  buildLighthouse,
  buildBulletMesh,
  buildWeaponMesh,
  buildSwordMesh,
  buildSniperMesh,
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
  it("returns an object with group and foliageGroup", () => {
    const rng = makeRng(42);
    const result = buildTreeMesh(rng);
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.foliageGroup).toBeInstanceOf(THREE.Group);
  });

  it("group has trunk and foliageGroup as children", () => {
    const rng = makeRng(42);
    const result = buildTreeMesh(rng);
    // group must contain at least a trunk mesh + foliageGroup
    expect(result.group.children.length).toBeGreaterThanOrEqual(2);
  });

  it("exposes trunkRadius > 0 and hasCollision boolean", () => {
    const rng = makeRng(42);
    const result = buildTreeMesh(rng);
    expect(typeof result.trunkRadius).toBe("number");
    expect(result.trunkRadius).toBeGreaterThan(0);
    expect(typeof result.hasCollision).toBe("boolean");
  });

  it("foliageGroup is a child of the main group", () => {
    const rng = makeRng(42);
    const result = buildTreeMesh(rng);
    let found = false;
    result.group.traverse((child) => {
      if (child === result.foliageGroup) found = true;
    });
    expect(found).toBe(true);
  });

  it("produces different trees for different seeds", () => {
    const rng1 = makeRng(1);
    const rng2 = makeRng(99);
    const tree1 = buildTreeMesh(rng1);
    const tree2 = buildTreeMesh(rng2);
    // Different seeds → different child counts or trunk radii
    const same =
      tree1.group.children.length === tree2.group.children.length &&
      tree1.trunkRadius === tree2.trunkRadius;
    expect(same).toBe(false);
  });

  it("generates all tree types across different RNG seeds (coverage)", () => {
    // Run many trees to ensure we exercise all branches without crashing
    for (let seed = 0; seed < 30; seed++) {
      const rng = makeRng(seed * 7 + 3);
      const result = buildTreeMesh(rng);
      expect(result.group).toBeInstanceOf(THREE.Group);
      expect(result.foliageGroup).toBeInstanceOf(THREE.Group);
    }
  });
});

describe("buildBushMesh", () => {
  it("returns an object with group and foliageGroup", () => {
    const rng = makeRng(42);
    const result = buildBushMesh(rng);
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.foliageGroup).toBeInstanceOf(THREE.Group);
  });

  it("foliageGroup is the same object as group (bushes sway as a whole)", () => {
    const rng = makeRng(42);
    const result = buildBushMesh(rng);
    expect(result.foliageGroup).toBe(result.group);
  });

  it("has blob children", () => {
    const rng = makeRng(42);
    const result = buildBushMesh(rng);
    expect(result.group.children.length).toBeGreaterThanOrEqual(3);
  });

  it("produces different bushes for different seeds", () => {
    const rng1 = makeRng(10);
    const rng2 = makeRng(200);
    const b1 = buildBushMesh(rng1);
    const b2 = buildBushMesh(rng2);
    const same = b1.group.children.length === b2.group.children.length &&
      b1.group.children[0].position.x === b2.group.children[0].position.x;
    expect(same).toBe(false);
  });

  it("does not crash across many seeds (berry variant coverage)", () => {
    for (let seed = 0; seed < 40; seed++) {
      const rng = makeRng(seed * 13 + 5);
      const result = buildBushMesh(rng);
      expect(result.group).toBeInstanceOf(THREE.Group);
    }
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
  it("returns { group, beamPivot, lighthouseLight }", () => {
    const result = buildLighthouse();
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.beamPivot).toBeInstanceOf(THREE.Group);
    expect(result.lighthouseLight).toBeInstanceOf(THREE.PointLight);
  });

  it("group has multiple band segments, a lantern, beam pivot and light", () => {
    const { group } = buildLighthouse();
    expect(group.children.length).toBeGreaterThan(5);
  });

  it("beamPivot is a child of group", () => {
    const { group, beamPivot } = buildLighthouse();
    let found = false;
    group.traverse((child) => {
      if (child === beamPivot) found = true;
    });
    expect(found).toBe(true);
  });

  it("beamPivot has two cone meshes (outer glow + inner core)", () => {
    const { beamPivot } = buildLighthouse();
    expect(beamPivot.children.length).toBe(2);
    beamPivot.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("lighthouseLight is a PointLight with warm colour", () => {
    const { lighthouseLight } = buildLighthouse();
    expect(lighthouseLight.color.r).toBeGreaterThan(0.9);
    expect(lighthouseLight.color.g).toBeGreaterThan(0.8);
    expect(lighthouseLight.distance).toBeGreaterThan(50);
  });

  it("beam cones use additive blending for glow effect", () => {
    const { beamPivot } = buildLighthouse();
    beamPivot.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      expect(mat.blending).toBe(THREE.AdditiveBlending);
      expect(mat.transparent).toBe(true);
    });
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

describe("buildSwordMesh", () => {
  it("returns a THREE.Group", () => {
    const sword = buildSwordMesh();
    expect(sword).toBeInstanceOf(THREE.Group);
  });

  it("has multiple parts (blade, guard, grip, pommel, etc.)", () => {
    const sword = buildSwordMesh();
    expect(sword.children.length).toBeGreaterThanOrEqual(5);
  });

  it("all parts are THREE.Mesh instances", () => {
    const sword = buildSwordMesh();
    sword.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("blade material has a light blue-white color", () => {
    const sword = buildSwordMesh();
    // First child is the blade
    const blade = sword.children[0] as THREE.Mesh;
    const mat = blade.material as THREE.MeshLambertMaterial;
    // THREE.js stores color in linear space; 0xd0e8ff ≈ 0.63 in linear red
    // Just check it's a relatively light color (r + g + b > 1.5)
    const brightness = mat.color.r + mat.color.g + mat.color.b;
    expect(brightness).toBeGreaterThan(1.5);
  });
});

describe("buildSniperMesh", () => {
  it("returns a THREE.Group", () => {
    const sniper = buildSniperMesh();
    expect(sniper).toBeInstanceOf(THREE.Group);
  });

  it("has many parts (barrel, body, scope, stock, grip, bipod, etc.)", () => {
    const sniper = buildSniperMesh();
    expect(sniper.children.length).toBeGreaterThanOrEqual(10);
  });

  it("all parts are THREE.Mesh instances", () => {
    const sniper = buildSniperMesh();
    sniper.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("includes a glowing scope lens (emissive material)", () => {
    const sniper = buildSniperMesh();
    let hasEmissive = false;
    sniper.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
      if (mat.emissive && (mat.emissive.r > 0 || mat.emissive.g > 0 || mat.emissive.b > 0)) {
        hasEmissive = true;
      }
    });
    expect(hasEmissive).toBe(true);
  });
});
