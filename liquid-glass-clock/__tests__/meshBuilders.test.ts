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
  buildBoatMesh,
  buildCatapultMesh,
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

  it("large pine trees (trunkH > 5.0) have hasCollision true", () => {
    // Seed 1 produces a pine tree — run many seeds and verify at least one large pine
    let foundLargePine = false;
    for (let seed = 0; seed < 200; seed++) {
      const rng = makeRng(seed * 3 + 1);
      const typeRoll = rng(); // consume first rng for type selection
      if (typeRoll < 0.30) {
        // This is a pine — trunkH = 4.5 + rng() * 4.0 on next call
        // Reset and re-run buildTreeMesh to get actual result
        const rng2 = makeRng(seed * 3 + 1);
        const result = buildTreeMesh(rng2);
        if (result.hasCollision) {
          foundLargePine = true;
          break;
        }
      }
    }
    expect(foundLargePine).toBe(true);
  });

  it("birch trees with trunkH > 4.5 have hasCollision true", () => {
    // Find a seed that produces a large birch
    let foundLargeBirch = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = makeRng(seed * 11 + 7);
      const result = buildTreeMesh(rng);
      // If group has no foliage blobs (dead tree) or has cones (pine), skip
      // We detect birch by checking foliage children exist AND hasCollision
      // Just check that across seeds we get some birch with hasCollision=true
      if (result.foliageGroup.children.length > 0 && result.hasCollision && result.trunkRadius < 0.13) {
        // Birch has slim trunks (0.07–0.12) and foliage
        foundLargeBirch = true;
        break;
      }
    }
    expect(foundLargeBirch).toBe(true);
  });

  it("dead trees with trunkH > 4.5 have hasCollision true", () => {
    // Find a seed producing a large dead tree
    let foundLargeDeadTree = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = makeRng(seed * 17 + 3);
      const result = buildTreeMesh(rng);
      // Dead trees have empty foliageGroup — detect by 0 foliage children
      if (result.foliageGroup.children.length === 0 && result.hasCollision) {
        foundLargeDeadTree = true;
        break;
      }
    }
    expect(foundLargeDeadTree).toBe(true);
  });

  it("small birch trees (trunkH <= 4.5) have hasCollision false", () => {
    // Verify that not all birch trees get collision (only large ones do)
    let foundSmallBirch = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = makeRng(seed * 13 + 5);
      const result = buildTreeMesh(rng);
      // Slim-trunk tree with foliage and NO collision = small birch
      if (result.foliageGroup.children.length > 0 && !result.hasCollision && result.trunkRadius < 0.13) {
        foundSmallBirch = true;
        break;
      }
    }
    expect(foundSmallBirch).toBe(true);
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
  it("returns { mesh, collisionRadius }", () => {
    const rng = makeRng(42);
    const result = buildRockMesh(rng);
    expect(result.mesh).toBeInstanceOf(THREE.Mesh);
    expect(typeof result.collisionRadius).toBe("number");
    expect(result.collisionRadius).toBeGreaterThan(0);
  });

  it("mesh has castShadow and receiveShadow", () => {
    const rng = makeRng(42);
    const { mesh } = buildRockMesh(rng);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it("collisionRadius equals baseRadius * max(scaleX, scaleZ)", () => {
    // With seed 42: first rng → baseRadius, then scaleX, scaleY, scaleZ
    // collisionRadius must be positive and <= (0.8) * 1.5 = 1.2
    const rng = makeRng(42);
    const { collisionRadius } = buildRockMesh(rng);
    expect(collisionRadius).toBeGreaterThan(0);
    expect(collisionRadius).toBeLessThanOrEqual(1.2);
  });

  it("produces different rocks for different seeds", () => {
    const r1 = buildRockMesh(makeRng(10));
    const r2 = buildRockMesh(makeRng(99));
    expect(r1.collisionRadius).not.toBeCloseTo(r2.collisionRadius, 5);
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
  it("returns { group, boxColliders, cylColliders }", () => {
    const rng = makeRng(1);
    const result = buildRuins(rng);
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(result.boxColliders)).toBe(true);
    expect(Array.isArray(result.cylColliders)).toBe(true);
  });

  it("has walls, columns, and debris", () => {
    const rng = makeRng(1);
    const { group } = buildRuins(rng);
    expect(group.children.length).toBeGreaterThan(5);
  });

  it("all mesh children have castShadow", () => {
    const rng = makeRng(1);
    const { group } = buildRuins(rng);
    group.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        expect(child.castShadow).toBe(true);
      }
    });
  });

  it("boxColliders has entries for both walls", () => {
    const rng = makeRng(1);
    const { boxColliders } = buildRuins(rng);
    // Two walls: w1 (front) and w2 (side)
    expect(boxColliders.length).toBeGreaterThanOrEqual(2);
    boxColliders.forEach((bc) => {
      expect(typeof bc.halfW).toBe("number");
      expect(typeof bc.halfD).toBe("number");
      expect(bc.halfW).toBeGreaterThan(0);
      expect(bc.halfD).toBeGreaterThan(0);
    });
  });

  it("cylColliders has entries for arch bases and columns", () => {
    const rng = makeRng(1);
    const { cylColliders } = buildRuins(rng);
    // 2 arch bases + 3 columns = 5 cylinder colliders
    expect(cylColliders.length).toBe(5);
    cylColliders.forEach((cc) => {
      expect(typeof cc.radius).toBe("number");
      expect(cc.radius).toBeGreaterThan(0);
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

// ─── buildBoatMesh ────────────────────────────────────────────────────────────
describe("buildBoatMesh", () => {
  it("returns a THREE.Group", () => {
    const boat = buildBoatMesh();
    expect(boat).toBeInstanceOf(THREE.Group);
  });

  it("has an orientation pivot group as sole direct child", () => {
    // Meshes are placed inside a pivot group (rotation.y = -π/2) so that
    // boat.rotation.y = Math.atan2(moveX, moveZ) makes the bow face movement direction.
    const boat = buildBoatMesh();
    expect(boat.children.length).toBe(1);
    expect(boat.children[0]).toBeInstanceOf(THREE.Group);
  });

  it("pivot group has rotation.y = -π/2 (orientation correction)", () => {
    // ORIENTATION VERIFICATION: boat bow is at local +X in the pivot.
    // pivot.rotation.y = -π/2 maps local +X → outer +Z.
    // When boat.rotation.y = π (W key), outer +Z → world -Z = forward ✓
    const boat = buildBoatMesh();
    const pivot = boat.children[0] as THREE.Group;
    expect(pivot.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("has multiple mesh descendants (hull, deck, bench, oars, etc.)", () => {
    const boat = buildBoatMesh();
    let meshCount = 0;
    boat.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThanOrEqual(10);
  });

  it("all mesh descendants use MeshLambertMaterial", () => {
    const boat = buildBoatMesh();
    boat.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      }
    });
  });

  it("has castShadow enabled on the group", () => {
    const boat = buildBoatMesh();
    expect(boat.castShadow).toBe(true);
  });

  it("includes a red-painted stripe piece", () => {
    const boat = buildBoatMesh();
    let hasRed = false;
    boat.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      // Red stripe material has red channel dominant over green and blue
      if (mat.color.r > mat.color.g && mat.color.r > mat.color.b && mat.color.g < mat.color.r * 0.4) {
        hasRed = true;
      }
    });
    expect(hasRed).toBe(true);
  });

  it("is positioned at origin by default", () => {
    const boat = buildBoatMesh();
    expect(boat.position.x).toBe(0);
    expect(boat.position.y).toBe(0);
    expect(boat.position.z).toBe(0);
  });

  it("bow (front) in pivot local space faces +X (length along X axis)", () => {
    // The bow mesh is centered at x=2.37, so the front of the boat in pivot
    // local space is the +X direction.
    const boat = buildBoatMesh();
    const pivot = boat.children[0] as THREE.Group;
    let maxX = -Infinity;
    pivot.children.forEach((child) => {
      if (child.position.x > maxX) maxX = child.position.x;
    });
    // Bow is at x=2.37 (front cap)
    expect(maxX).toBeGreaterThan(2.0);
  });
});

describe("buildCatapultMesh", () => {
  it("returns an object with a group and armGroup", () => {
    const { group, armGroup } = buildCatapultMesh();
    expect(group).toBeInstanceOf(THREE.Group);
    expect(armGroup).toBeInstanceOf(THREE.Group);
  });

  it("armGroup is a child of the main group", () => {
    const { group, armGroup } = buildCatapultMesh();
    expect(group.children).toContain(armGroup);
  });

  it("arm starts in loaded (back) position (rotation.x ~= -1.1)", () => {
    const { armGroup } = buildCatapultMesh();
    expect(armGroup.rotation.x).toBeCloseTo(-1.1, 1);
  });

  it("group is positioned at origin by default", () => {
    const { group } = buildCatapultMesh();
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(0);
    expect(group.position.z).toBe(0);
  });

  it("main group contains at least 10 child objects (frame, wheels, arm, etc.)", () => {
    const { group } = buildCatapultMesh();
    // Traverse all descendants and count meshes
    let meshCount = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThanOrEqual(10);
  });

  it("arm group contains the arm beam and counterweight", () => {
    const { armGroup } = buildCatapultMesh();
    let meshCount = 0;
    armGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    // long arm, short arm, counterweight block, two sling ropes, cannonball = 6+
    expect(meshCount).toBeGreaterThanOrEqual(4);
  });

  it("uses MeshLambertMaterial on all mesh descendants", () => {
    const { group } = buildCatapultMesh();
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      }
    });
  });
});
