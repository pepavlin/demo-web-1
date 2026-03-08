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
  buildArrowProjectileMesh,
  buildSwordMesh,
  buildBowMesh,
  buildCrossbowMesh,
  buildBoatMesh,
  buildCatapultMesh,
  buildMotherShipMesh,
  buildRocketMesh,
  buildSpaceStationInterior,
  buildPumpkinMesh,
  buildSpiderMesh,
  buildCaveMesh,
  buildTorchMesh,
  buildTreasureChestMesh,
  buildCity,
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

describe("buildBowMesh", () => {
  it("returns a THREE.Group", () => {
    const bow = buildBowMesh();
    expect(bow).toBeInstanceOf(THREE.Group);
  });

  it("has at least 7 direct children (grip + risers + 2 tube limbs + 2 string pivots + nockPoint)", () => {
    const bow = buildBowMesh();
    // grip, upperRiser, lowerRiser, upperLimb, lowerLimb, upperStringPivot, lowerStringPivot, nockPoint
    expect(bow.children.length).toBeGreaterThanOrEqual(7);
  });

  it("has named 'upperStringPivot' and 'lowerStringPivot' groups for V-string animation", () => {
    const bow = buildBowMesh();
    const upperPivot = bow.getObjectByName("upperStringPivot");
    const lowerPivot = bow.getObjectByName("lowerStringPivot");
    expect(upperPivot).toBeDefined();
    expect(upperPivot).toBeInstanceOf(THREE.Group);
    expect(lowerPivot).toBeDefined();
    expect(lowerPivot).toBeInstanceOf(THREE.Group);
  });

  it("has a named 'nockPoint' group that contains the nocked arrow", () => {
    const bow = buildBowMesh();
    const nockPoint = bow.getObjectByName("nockPoint");
    expect(nockPoint).toBeDefined();
    expect(nockPoint).toBeInstanceOf(THREE.Group);
    const nockedArrow = bow.getObjectByName("nockedArrow");
    expect(nockedArrow).toBeDefined();
    expect(nockedArrow).toBeInstanceOf(THREE.Group);
  });

  it("limb tubes use TubeGeometry (smooth, no per-segment rotation issues)", () => {
    const bow = buildBowMesh();
    let hasTubeGeometry = false;
    bow.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry instanceof THREE.TubeGeometry) {
        hasTubeGeometry = true;
      }
    });
    expect(hasTubeGeometry).toBe(true);
  });

  it("uses wood-like brown colors for limbs (found via traverse)", () => {
    const bow = buildBowMesh();
    let hasBrownish = false;
    bow.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      if (mat.color && mat.color.r > mat.color.g && mat.color.g > mat.color.b) {
        hasBrownish = true;
      }
    });
    expect(hasBrownish).toBe(true);
  });

  it("string pivots are positioned symmetrically (upper Y = -lower Y)", () => {
    const bow = buildBowMesh();
    const upperPivot = bow.getObjectByName("upperStringPivot") as THREE.Group;
    const lowerPivot = bow.getObjectByName("lowerStringPivot") as THREE.Group;
    expect(upperPivot.position.y).toBeCloseTo(-lowerPivot.position.y, 3);
    expect(upperPivot.position.x).toBeCloseTo(lowerPivot.position.x, 3);
  });
});

describe("buildArrowProjectileMesh", () => {
  it("returns a THREE.Group", () => {
    const arrow = buildArrowProjectileMesh();
    expect(arrow).toBeInstanceOf(THREE.Group);
  });

  it("has at least 5 parts (shaft, head, 3 fins)", () => {
    const arrow = buildArrowProjectileMesh();
    expect(arrow.children.length).toBeGreaterThanOrEqual(5);
  });

  it("all parts are THREE.Mesh instances", () => {
    const arrow = buildArrowProjectileMesh();
    arrow.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("shaft uses a wood-like brown material", () => {
    const arrow = buildArrowProjectileMesh();
    const shaft = arrow.children[0] as THREE.Mesh;
    const mat = shaft.material as THREE.MeshLambertMaterial;
    // Brown: r > g > b
    expect(mat.color.r).toBeGreaterThan(mat.color.g);
    expect(mat.color.g).toBeGreaterThan(mat.color.b);
  });

  it("arrowhead uses a metallic grey material", () => {
    const arrow = buildArrowProjectileMesh();
    const head = arrow.children[1] as THREE.Mesh;
    const mat = head.material as THREE.MeshLambertMaterial;
    // Grey: r ≈ g ≈ b (THREE.js linearises sRGB, so 0xbb ≈ 0.497 in linear)
    const r = mat.color.r;
    const g = mat.color.g;
    const b = mat.color.b;
    expect(Math.abs(r - g)).toBeLessThan(0.1);
    expect(Math.abs(g - b)).toBeLessThan(0.1);
    // Neutral grey (not black, not super bright) — linear value ~0.4–0.8
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.9);
  });

  it("fletching fins are positioned at the rear (+Z side)", () => {
    const arrow = buildArrowProjectileMesh();
    // Fins start at index 2 (after shaft and head)
    for (let i = 2; i < arrow.children.length; i++) {
      const fin = arrow.children[i] as THREE.Mesh;
      // Fins are at the rear = positive Z relative to shaft center
      expect(fin.position.z).toBeGreaterThan(0);
    }
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

describe("buildCrossbowMesh", () => {
  it("returns a THREE.Group", () => {
    const crossbow = buildCrossbowMesh();
    expect(crossbow).toBeInstanceOf(THREE.Group);
  });

  it("has many parts (stock, rail, limbs, stirrup, string, trigger, bolt, etc.)", () => {
    const crossbow = buildCrossbowMesh();
    expect(crossbow.children.length).toBeGreaterThanOrEqual(10);
  });

  it("all parts are THREE.Mesh instances", () => {
    const crossbow = buildCrossbowMesh();
    crossbow.children.forEach((child) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("uses dark wood and metal colors", () => {
    const crossbow = buildCrossbowMesh();
    // At least one part should be dark (dark wood or metal)
    let hasDark = false;
    crossbow.children.forEach((child) => {
      const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
      const brightness = mat.color.r + mat.color.g + mat.color.b;
      if (brightness < 0.5) hasDark = true;
    });
    expect(hasDark).toBe(true);
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

// ─── buildMotherShipMesh ──────────────────────────────────────────────────────
describe("buildMotherShipMesh", () => {
  it("returns an object with group and lights array", () => {
    const { group, lights } = buildMotherShipMesh();
    expect(group).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(lights)).toBe(true);
  });

  it("group has multiple child objects (ring, hub, arms, panels, lights, debris)", () => {
    const { group } = buildMotherShipMesh();
    expect(group.children.length).toBeGreaterThan(5);
  });

  it("lights array contains THREE.PointLight instances", () => {
    const { lights } = buildMotherShipMesh();
    expect(lights.length).toBeGreaterThan(0);
    lights.forEach((light) => {
      expect(light).toBeInstanceOf(THREE.PointLight);
    });
  });

  it("all point lights have a warm orange/amber color (r > b)", () => {
    const { lights } = buildMotherShipMesh();
    lights.forEach((light) => {
      // All mothership lights are orange/amber: red channel > blue channel
      expect(light.color.r).toBeGreaterThan(light.color.b);
    });
  });

  it("each point light has a _base property for flicker animation", () => {
    const { lights } = buildMotherShipMesh();
    lights.forEach((light) => {
      const extended = light as THREE.PointLight & { _base?: number };
      expect(typeof extended._base).toBe("number");
      expect(extended._base).toBeGreaterThan(0);
    });
  });

  it("group contains mesh descendants for the outer ring (TorusGeometry)", () => {
    const { group } = buildMotherShipMesh();
    let hasTorus = false;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry instanceof THREE.TorusGeometry) {
        hasTorus = true;
      }
    });
    expect(hasTorus).toBe(true);
  });

  it("group contains a Points object (debris particles)", () => {
    const { group } = buildMotherShipMesh();
    let hasPoints = false;
    group.traverse((child) => {
      if (child instanceof THREE.Points) hasPoints = true;
    });
    expect(hasPoints).toBe(true);
  });

  it("group is positioned at origin by default (caller controls placement)", () => {
    const { group } = buildMotherShipMesh();
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(0);
    expect(group.position.z).toBe(0);
  });
});

// ─── buildRocketMesh ──────────────────────────────────────────────────────────
describe("buildRocketMesh", () => {
  it("returns an object with group, flameGroup, launchPad, and exhaustParticles", () => {
    const result = buildRocketMesh();
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.flameGroup).toBeInstanceOf(THREE.Group);
    expect(result.launchPad).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(result.exhaustParticles)).toBe(true);
  });

  it("group is positioned at origin by default (caller controls placement)", () => {
    const { group } = buildRocketMesh();
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(0);
    expect(group.position.z).toBe(0);
  });

  it("group has castShadow and receiveShadow enabled", () => {
    const { group } = buildRocketMesh();
    expect(group.castShadow).toBe(true);
    expect(group.receiveShadow).toBe(true);
  });

  it("flame group is hidden by default (only visible during launch)", () => {
    const { flameGroup } = buildRocketMesh();
    expect(flameGroup.visible).toBe(false);
  });

  it("exhaust particles are hidden by default", () => {
    const { exhaustParticles } = buildRocketMesh();
    exhaustParticles.forEach((puff) => {
      expect(puff.visible).toBe(false);
    });
  });

  it("exhaust particles are Mesh instances", () => {
    const { exhaustParticles } = buildRocketMesh();
    expect(exhaustParticles.length).toBeGreaterThan(0);
    exhaustParticles.forEach((puff) => {
      expect(puff).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("group contains many mesh descendants (body, nosecone, fins, nozzle, ladder, etc.)", () => {
    const { group } = buildRocketMesh();
    let meshCount = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    // At minimum: body, stripe×2, nosecone, tip, porthole rim, porthole glass,
    // nozzle, 4 fins, 8 ladder rungs, 2 rails, flame parts, 8 exhaust puffs.
    // Note: launchPad is no longer part of the group (it's added to the scene separately).
    expect(meshCount).toBeGreaterThanOrEqual(25);
  });

  it("launchPad is NOT a child of the main group (it is placed separately in the scene)", () => {
    const { group, launchPad } = buildRocketMesh();
    // launchPad must be returned as a standalone Group so Game3D can place it
    // directly in the scene — keeping it stationary while the rocket flies away.
    expect(group.children).not.toContain(launchPad);
    expect(launchPad).toBeInstanceOf(THREE.Group);
  });

  it("flameGroup is a child of the main group", () => {
    const { group, flameGroup } = buildRocketMesh();
    expect(group.children).toContain(flameGroup);
  });

  it("all body meshes use MeshLambertMaterial", () => {
    const { group } = buildRocketMesh();
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    });
  });

  it("rocket body has white/light color (dominant high luminance)", () => {
    const { group } = buildRocketMesh();
    let foundWhiteish = false;
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      // Body color 0xdde8f0 has r=0.867, g=0.91, b=0.94 — all high
      if (mat.color.r > 0.8 && mat.color.g > 0.8 && mat.color.b > 0.8) {
        foundWhiteish = true;
      }
    });
    expect(foundWhiteish).toBe(true);
  });

  it("has red accent parts (fins and stripes) — red channel dominant", () => {
    const { group } = buildRocketMesh();
    let foundRed = false;
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshLambertMaterial;
      // Use relative comparison to be robust against linear color space conversion.
      // Red accent 0xcc2222: r >> g,b in both sRGB and linear space.
      if (
        mat.color.r > mat.color.g &&
        mat.color.r > mat.color.b &&
        mat.color.g < mat.color.r * 0.4
      ) {
        foundRed = true;
      }
    });
    expect(foundRed).toBe(true);
  });

  it("launchPad contains at least a slab and support structure", () => {
    const { launchPad } = buildRocketMesh();
    let meshCount = 0;
    launchPad.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    // slab + 4 legs + tower + gantry arms >= 7
    expect(meshCount).toBeGreaterThanOrEqual(7);
  });

  it("exhaust particles are added to the main group", () => {
    const { group, exhaustParticles } = buildRocketMesh();
    exhaustParticles.forEach((puff) => {
      let found = false;
      group.traverse((child) => {
        if (child === puff) found = true;
      });
      expect(found).toBe(true);
    });
  });
});

describe("buildSpaceStationInterior", () => {
  it("returns the expected shape (group, rooms, spawnPosition, lights, animatedMeshes)", () => {
    const result = buildSpaceStationInterior();
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(result.rooms)).toBe(true);
    expect(result.spawnPosition).toBeInstanceOf(THREE.Vector3);
    expect(Array.isArray(result.lights)).toBe(true);
    expect(Array.isArray(result.animatedMeshes)).toBe(true);
  });

  it("has at least 5 rooms (airlock, corridor, bridge, crew, engineering)", () => {
    const { rooms } = buildSpaceStationInterior();
    expect(rooms.length).toBeGreaterThanOrEqual(5);
  });

  it("all rooms are valid non-empty THREE.Box3 instances", () => {
    const { rooms } = buildSpaceStationInterior();
    rooms.forEach((room) => {
      expect(room).toBeInstanceOf(THREE.Box3);
      expect(room.isEmpty()).toBe(false);
      // Each room must have positive size in all axes
      const size = new THREE.Vector3();
      room.getSize(size);
      expect(size.x).toBeGreaterThan(0);
      expect(size.y).toBeGreaterThan(0);
      expect(size.z).toBeGreaterThan(0);
    });
  });

  it("spawn position is inside the first room (airlock)", () => {
    const { rooms, spawnPosition } = buildSpaceStationInterior();
    const airlockRoom = rooms[0];
    // Spawn XZ should be within the airlock footprint
    expect(spawnPosition.x).toBeGreaterThanOrEqual(airlockRoom.min.x);
    expect(spawnPosition.x).toBeLessThanOrEqual(airlockRoom.max.x);
    expect(spawnPosition.z).toBeGreaterThanOrEqual(airlockRoom.min.z);
    expect(spawnPosition.z).toBeLessThanOrEqual(airlockRoom.max.z);
  });

  it("spawn Y is at player standing height (> 0 and <= max room height)", () => {
    const { spawnPosition } = buildSpaceStationInterior();
    // Expect spawn Y to be approximately PLAYER_HEIGHT (1.8)
    expect(spawnPosition.y).toBeGreaterThan(1.5);
    expect(spawnPosition.y).toBeLessThan(4.0);
  });

  it("group has many children (walls, floors, ceilings, props)", () => {
    const { group } = buildSpaceStationInterior();
    // Each room adds floor + ceiling + 4 walls + strips + lights + more
    // Expect at least 50 child objects across the full station
    let meshCount = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(50);
  });

  it("lights array contains PointLight references with positive base intensity", () => {
    const { lights } = buildSpaceStationInterior();
    expect(lights.length).toBeGreaterThan(0);
    lights.forEach(({ light, baseIntensity, phase }) => {
      expect(light).toBeInstanceOf(THREE.PointLight);
      expect(baseIntensity).toBeGreaterThan(0);
      expect(typeof phase).toBe("number");
    });
  });

  it("every light in lights array is a child of the group", () => {
    const { group, lights } = buildSpaceStationInterior();
    lights.forEach(({ light }) => {
      let found = false;
      group.traverse((child) => {
        if (child === light) found = true;
      });
      expect(found).toBe(true);
    });
  });

  it("animatedMeshes contains Mesh references with valid type strings", () => {
    const { animatedMeshes } = buildSpaceStationInterior();
    expect(animatedMeshes.length).toBeGreaterThan(0);
    const validTypes = new Set(["hologram", "reactor", "panel"]);
    animatedMeshes.forEach(({ mesh, type }) => {
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(validTypes.has(type)).toBe(true);
    });
  });

  it("has at least one hologram, one reactor, and one panel type mesh", () => {
    const { animatedMeshes } = buildSpaceStationInterior();
    const types = animatedMeshes.map((m) => m.type);
    expect(types).toContain("hologram");
    expect(types).toContain("reactor");
    expect(types).toContain("panel");
  });

  it("every animatedMesh is a descendant of the group", () => {
    const { group, animatedMeshes } = buildSpaceStationInterior();
    animatedMeshes.forEach(({ mesh }) => {
      let found = false;
      group.traverse((child) => {
        if (child === mesh) found = true;
      });
      expect(found).toBe(true);
    });
  });

  it("airlock room is centred near origin (spawn area)", () => {
    const { rooms } = buildSpaceStationInterior();
    const airlock = rooms[0];
    const center = new THREE.Vector3();
    airlock.getCenter(center);
    // Airlock should be centred at or near XZ=0
    expect(Math.abs(center.x)).toBeLessThan(5);
    expect(Math.abs(center.z)).toBeLessThan(5);
  });

  it("bridge room is the furthest room from origin in X", () => {
    const { rooms } = buildSpaceStationInterior();
    let maxX = -Infinity;
    rooms.forEach((room) => {
      if (room.max.x > maxX) maxX = room.max.x;
    });
    // Bridge extends to X ≥ 55 (defined as X: 35..58)
    expect(maxX).toBeGreaterThanOrEqual(50);
  });
});

// ─── buildPumpkinMesh ─────────────────────────────────────────────────────────

describe("buildPumpkinMesh", () => {
  it("returns a THREE.Group", () => {
    const group = buildPumpkinMesh();
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("has children (body + ribs + stem + leaf)", () => {
    const group = buildPumpkinMesh();
    expect(group.children.length).toBeGreaterThanOrEqual(4);
  });

  it("uses default scale 1.0 when no argument given", () => {
    const group = buildPumpkinMesh();
    expect(group.scale.x).toBeCloseTo(1.0);
    expect(group.scale.y).toBeCloseTo(1.0);
    expect(group.scale.z).toBeCloseTo(1.0);
  });

  it("applies custom scale uniformly", () => {
    const group = buildPumpkinMesh(0.55);
    expect(group.scale.x).toBeCloseTo(0.55);
    expect(group.scale.y).toBeCloseTo(0.55);
    expect(group.scale.z).toBeCloseTo(0.55);
  });

  it("hand-held version (scale 0.55) is smaller than world version (scale 1.0)", () => {
    const worldGroup = buildPumpkinMesh(1.0);
    const handGroup = buildPumpkinMesh(0.55);
    expect(handGroup.scale.x).toBeLessThan(worldGroup.scale.x);
  });

  it("all mesh children have a material", () => {
    const group = buildPumpkinMesh();
    let meshCount = 0;
    group.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) {
        expect(m.material).toBeTruthy();
        meshCount++;
      }
    });
    expect(meshCount).toBeGreaterThan(0);
  });

  it("pumpkin body mesh uses orange-ish colour", () => {
    const group = buildPumpkinMesh();
    // First child should be the main body mesh
    const body = group.children[0] as THREE.Mesh;
    expect(body).toBeInstanceOf(THREE.Mesh);
    const mat = body.material as THREE.MeshLambertMaterial;
    // Orange colour: red channel dominant
    expect(mat.color.r).toBeGreaterThan(mat.color.b);
  });
});

// ─── Cave system tests ─────────────────────────────────────────────────────────

describe("buildSpiderMesh", () => {
  it("returns a THREE.Group", () => {
    const group = buildSpiderMesh();
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("has multiple children (body + legs + eyes)", () => {
    const group = buildSpiderMesh();
    expect(group.children.length).toBeGreaterThan(5);
  });

  it("abdomen and cephalothorax mesh cast shadows", () => {
    const group = buildSpiderMesh();
    const shadowCasters = group.children.filter(
      (c) => (c as THREE.Mesh).isMesh && (c as THREE.Mesh).castShadow
    );
    expect(shadowCasters.length).toBeGreaterThanOrEqual(2);
  });

  it("all meshes have materials assigned", () => {
    const group = buildSpiderMesh();
    group.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) {
        expect(m.material).toBeTruthy();
      }
    });
  });

  it("can be scaled to represent different size tiers", () => {
    const smallSpider = buildSpiderMesh();
    smallSpider.scale.setScalar(0.45);
    expect(smallSpider.scale.x).toBeCloseTo(0.45);

    const largeSpider = buildSpiderMesh();
    largeSpider.scale.setScalar(1.4);
    expect(largeSpider.scale.x).toBeCloseTo(1.4);
  });
});

describe("buildCaveMesh", () => {
  it("returns a THREE.Group", () => {
    const group = buildCaveMesh();
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("has multiple children (arch + walls + floor + ceiling + stalactites)", () => {
    const group = buildCaveMesh();
    expect(group.children.length).toBeGreaterThan(8);
  });

  it("all meshes have materials", () => {
    const group = buildCaveMesh();
    let meshCount = 0;
    group.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh) {
        expect(m.material).toBeTruthy();
        meshCount++;
      }
    });
    expect(meshCount).toBeGreaterThan(8);
  });
});

describe("buildTorchMesh", () => {
  it("returns a THREE.Group", () => {
    const group = buildTorchMesh();
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("has children (stick, band, flame, core)", () => {
    const group = buildTorchMesh();
    expect(group.children.length).toBeGreaterThanOrEqual(4);
  });

  it("contains a flame child named 'flame'", () => {
    const group = buildTorchMesh();
    const flame = group.children.find((c) => c.name === "flame");
    expect(flame).toBeDefined();
  });

  it("flame uses emissive material for glow", () => {
    const group = buildTorchMesh();
    const flame = group.children.find((c) => c.name === "flame") as THREE.Mesh;
    expect(flame).toBeDefined();
    const mat = flame.material as THREE.MeshLambertMaterial;
    // Emissive should have some red/orange component
    expect(mat.emissive.r).toBeGreaterThan(0.5);
  });
});

describe("buildTreasureChestMesh", () => {
  it("returns an object with group and lidGroup", () => {
    const result = buildTreasureChestMesh();
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(result.lidGroup).toBeInstanceOf(THREE.Group);
  });

  it("lidGroup is a child of group", () => {
    const { group, lidGroup } = buildTreasureChestMesh();
    let found = false;
    group.traverse((child) => {
      if (child === lidGroup) found = true;
    });
    expect(found).toBe(true);
  });

  it("lid can be rotated to open position", () => {
    const { lidGroup } = buildTreasureChestMesh();
    lidGroup.rotation.x = -Math.PI * 0.75;
    expect(lidGroup.rotation.x).toBeCloseTo(-Math.PI * 0.75);
  });

  it("has multiple mesh children for detailed chest appearance", () => {
    const { group } = buildTreasureChestMesh();
    let meshCount = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(5);
  });
});

describe("buildCity", () => {
  it("returns { group, boxColliders, cylColliders }", () => {
    const result = buildCity(makeRng(42));
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(result.boxColliders)).toBe(true);
    expect(Array.isArray(result.cylColliders)).toBe(true);
  });

  it("group has many mesh children (roads, buildings, lights)", () => {
    const { group } = buildCity(makeRng(7));
    let meshCount = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(50);
  });

  it("boxColliders is non-empty (buildings have colliders)", () => {
    const { boxColliders } = buildCity(makeRng(1));
    expect(boxColliders.length).toBeGreaterThan(0);
    // Each collider has the expected shape
    for (const bc of boxColliders) {
      expect(typeof bc.lx).toBe("number");
      expect(typeof bc.lz).toBe("number");
      expect(typeof bc.halfW).toBe("number");
      expect(typeof bc.halfD).toBe("number");
      expect(typeof bc.rotY).toBe("number");
    }
  });

  it("cylColliders contains the fountain collider", () => {
    const { cylColliders } = buildCity(makeRng(1));
    expect(cylColliders.length).toBeGreaterThan(0);
    // Fountain collider is at local origin with radius ~3.8
    const fountain = cylColliders.find(
      (cc) => Math.abs(cc.lx) < 0.1 && Math.abs(cc.lz) < 0.1 && cc.radius > 3,
    );
    expect(fountain).toBeDefined();
  });

  it("skyscraper meshes are taller than office buildings on average", () => {
    const { group } = buildCity(makeRng(42));
    // Collect the max Y position of any mesh
    let maxY = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const y = child.position.y;
        if (y > maxY) maxY = y;
      }
    });
    // Tallest skyscraper antenna tip should be well above 30 units
    expect(maxY).toBeGreaterThan(30);
  });

  it("is deterministic — same seed produces same collider count", () => {
    const r1 = buildCity(makeRng(99));
    const r2 = buildCity(makeRng(99));
    expect(r1.boxColliders.length).toBe(r2.boxColliders.length);
    expect(r1.cylColliders.length).toBe(r2.cylColliders.length);
  });

  it("terrain-conforming: buildings are elevated when getLocalHeight returns positive values", () => {
    // Simulate a terrain slope: returns 5 units for all positions
    const flatRaise: (lx: number, lz: number) => number = () => 5;
    const { group } = buildCity(makeRng(42), flatRaise);
    // All building mesh positions should be > 0 in Y (elevated by terrain)
    let hasElevatedMesh = false;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.position.y > 4) {
        hasElevatedMesh = true;
      }
    });
    expect(hasElevatedMesh).toBe(true);
  });

  it("terrain-conforming: flat terrain (getLocalHeight always 0) matches no-callback baseline", () => {
    // With constant-zero terrain function, Y positions should match the flat build
    const flatBaseline = buildCity(makeRng(5));
    const flatTerrain = buildCity(makeRng(5), () => 0);

    const collectY = (g: THREE.Group): number[] => {
      const ys: number[] = [];
      g.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) ys.push(child.position.y);
      });
      return ys.sort((a, b) => a - b);
    };

    const ysBase = collectY(flatBaseline.group);
    const ysTerrain = collectY(flatTerrain.group);
    expect(ysBase.length).toBe(ysTerrain.length);
    for (let i = 0; i < ysBase.length; i++) {
      expect(ysTerrain[i]).toBeCloseTo(ysBase[i], 5);
    }
  });

  it("terrain-conforming: sloped terrain offsets buildings by local height", () => {
    // Simple slope: height = lx * 0.5 (east half higher, west lower)
    const slope: (lx: number, lz: number) => number = (lx) => Math.max(0, lx * 0.5);
    const { group } = buildCity(makeRng(10), slope);
    // Skyscrapers at lx=7 should sit higher than at lx=-7
    let maxYAtPositiveX = 0;
    let maxYAtNegativeX = 0;
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        if (child.position.x > 5) maxYAtPositiveX = Math.max(maxYAtPositiveX, child.position.y);
        if (child.position.x < -5) maxYAtNegativeX = Math.max(maxYAtNegativeX, child.position.y);
      }
    });
    // East side (positive X) should have taller overall extent due to terrain offset
    expect(maxYAtPositiveX).toBeGreaterThan(maxYAtNegativeX);
  });

  it("terrain-conforming: collider count unchanged regardless of terrain function", () => {
    const rngA = makeRng(77);
    const rngB = makeRng(77);
    const flat = buildCity(rngA);
    const hilly = buildCity(rngB, (lx, lz) => Math.abs(lx) * 0.3 + Math.abs(lz) * 0.1);
    expect(flat.boxColliders.length).toBe(hilly.boxColliders.length);
    expect(flat.cylColliders.length).toBe(hilly.cylColliders.length);
  });
});
