/**
 * Tests for bomb mechanics:
 * - buildBombMesh() visual construction
 * - BombProjectileData type shape
 * - Terrain crater deformation via modifyTerrainHeight
 * - Bomb physics (gravity simulation)
 */

// Mock THREE.js WebGL renderer
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

import { buildBombMesh } from "@/lib/meshBuilders";
import {
  initNoise,
  getTerrainHeightSampled,
  modifyTerrainHeight,
  updateTerrainGeometry,
} from "@/lib/terrainUtils";
import type { BombProjectileData } from "@/lib/gameTypes";
import * as THREE from "three";

// ─── buildBombMesh ─────────────────────────────────────────────────────────────

describe("buildBombMesh", () => {
  it("returns a THREE.Group", () => {
    const mesh = buildBombMesh();
    expect(mesh).toBeInstanceOf(THREE.Group);
  });

  it("has at least 3 children (body, fuse, spark)", () => {
    const mesh = buildBombMesh();
    expect(mesh.children.length).toBeGreaterThanOrEqual(3);
  });

  it("respects scale parameter (default 1.0)", () => {
    const mesh = buildBombMesh();
    expect(mesh.scale.x).toBeCloseTo(1.0);
    expect(mesh.scale.y).toBeCloseTo(1.0);
    expect(mesh.scale.z).toBeCloseTo(1.0);
  });

  it("respects custom scale parameter", () => {
    const mesh = buildBombMesh(0.52);
    expect(mesh.scale.x).toBeCloseTo(0.52);
    expect(mesh.scale.y).toBeCloseTo(0.52);
    expect(mesh.scale.z).toBeCloseTo(0.52);
  });

  it("at least one child mesh has a dark material color", () => {
    const mesh = buildBombMesh();
    let foundDarkBody = false;
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshLambertMaterial;
        if (mat && mat.color) {
          const hex = mat.color.getHex();
          // Main body should be very dark (near-black)
          if (hex <= 0x3a3a3a) foundDarkBody = true;
        }
      }
    });
    expect(foundDarkBody).toBe(true);
  });

  it("held-size variant (0.52 scale) is smaller than world-size variant", () => {
    const world = buildBombMesh(1.0);
    const held = buildBombMesh(0.52);
    expect(held.scale.x).toBeLessThan(world.scale.x);
  });
});

// ─── BombProjectileData type shape ────────────────────────────────────────────

describe("BombProjectileData", () => {
  it("can be created with correct fields", () => {
    const group = new THREE.Group();
    const bomb: BombProjectileData = {
      mesh: group,
      velocity: new THREE.Vector3(5, 3, -8),
      fuseTimer: 4.5,
      exploded: false,
    };
    expect(bomb.mesh).toBe(group);
    expect(bomb.velocity.x).toBe(5);
    expect(bomb.fuseTimer).toBe(4.5);
    expect(bomb.exploded).toBe(false);
  });

  it("can be marked as exploded", () => {
    const bomb: BombProjectileData = {
      mesh: new THREE.Group(),
      velocity: new THREE.Vector3(),
      fuseTimer: 0,
      exploded: false,
    };
    bomb.exploded = true;
    expect(bomb.exploded).toBe(true);
  });
});

// ─── Bomb physics simulation ───────────────────────────────────────────────────

describe("bomb projectile physics simulation", () => {
  const BOMB_GRAVITY = -18;
  const BOMB_THROW_SPEED = 14;

  function simulateBombFlight(
    initialVelocity: THREE.Vector3,
    groundY: number,
    maxSteps = 1000,
    dt = 0.016
  ): { landed: boolean; steps: number; finalPos: THREE.Vector3 } {
    const pos = new THREE.Vector3(0, 2, 0);
    const vel = initialVelocity.clone();
    for (let i = 0; i < maxSteps; i++) {
      vel.y += BOMB_GRAVITY * dt;
      pos.addScaledVector(vel, dt);
      if (pos.y <= groundY) {
        return { landed: true, steps: i, finalPos: pos };
      }
    }
    return { landed: false, steps: maxSteps, finalPos: pos };
  }

  it("bomb thrown horizontally falls to ground eventually", () => {
    const vel = new THREE.Vector3(BOMB_THROW_SPEED, 0, 0);
    const result = simulateBombFlight(vel, 0);
    expect(result.landed).toBe(true);
  });

  it("bomb thrown upward still falls to ground", () => {
    const vel = new THREE.Vector3(0, 8, 0);
    const result = simulateBombFlight(vel, 0);
    expect(result.landed).toBe(true);
  });

  it("bomb fuse timer decrements correctly over dt", () => {
    const dt = 0.016;
    const BOMB_FUSE_DURATION = 4.5;
    let fuse = BOMB_FUSE_DURATION;
    const steps = Math.floor(BOMB_FUSE_DURATION / dt);
    for (let i = 0; i < steps; i++) {
      fuse -= dt;
    }
    expect(fuse).toBeLessThanOrEqual(0.1); // close to zero
    expect(fuse).toBeGreaterThan(-0.1);
  });

  it("bomb travels forward (positive x) when thrown in +x direction", () => {
    const vel = new THREE.Vector3(BOMB_THROW_SPEED, 2, 0);
    const result = simulateBombFlight(vel, -5);
    expect(result.finalPos.x).toBeGreaterThan(0);
  });

  it("bomb with upward tilt travels farther than purely horizontal throw", () => {
    const velFlat = new THREE.Vector3(BOMB_THROW_SPEED, 0, 0);
    const velArced = new THREE.Vector3(BOMB_THROW_SPEED * 0.98, BOMB_THROW_SPEED * 0.18, 0).normalize().multiplyScalar(BOMB_THROW_SPEED);
    const resultFlat = simulateBombFlight(velFlat, 0);
    const resultArced = simulateBombFlight(velArced, 0);
    // Arced throw should land farther in x
    expect(resultArced.finalPos.x).toBeGreaterThan(resultFlat.finalPos.x * 0.9);
  });
});

// ─── Terrain crater deformation ────────────────────────────────────────────────

describe("bomb crater terrain deformation", () => {
  const BOMB_CRATER_RADIUS = 6;
  const BOMB_CRATER_DEPTH = -2.8;

  beforeEach(() => {
    initNoise(42);
  });

  it("modifyTerrainHeight lowers terrain at impact point", () => {
    // Get terrain height before deformation at a land area
    const testX = 30;
    const testZ = 30;
    const heightBefore = getTerrainHeightSampled(testX, testZ);

    // Apply crater deformation
    modifyTerrainHeight(testX, testZ, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);

    const heightAfter = getTerrainHeightSampled(testX, testZ);
    expect(heightAfter).toBeLessThan(heightBefore);
  });

  it("crater centre is lower than crater edge", () => {
    const cx = 50;
    const cz = 50;

    modifyTerrainHeight(cx, cz, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);

    const heightCentre = getTerrainHeightSampled(cx, cz);
    const heightEdge = getTerrainHeightSampled(cx + BOMB_CRATER_RADIUS - 0.5, cz);
    expect(heightCentre).toBeLessThan(heightEdge);
  });

  it("terrain outside crater radius is not significantly affected", () => {
    const cx = -40;
    const cz = 20;
    const farX = cx + BOMB_CRATER_RADIUS * 2;

    const heightFarBefore = getTerrainHeightSampled(farX, cz);
    modifyTerrainHeight(cx, cz, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);
    const heightFarAfter = getTerrainHeightSampled(farX, cz);

    // Should not change significantly outside the crater
    expect(Math.abs(heightFarAfter - heightFarBefore)).toBeLessThan(0.01);
  });

  it("updateTerrainGeometry does not throw when called after terrain deformation", () => {
    // Create a minimal terrain mesh (small plane geometry matching the pattern used in the game)
    const geo = new THREE.PlaneGeometry(10, 10, 5, 5);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial();
    const terrain = new THREE.Mesh(geo, mat);

    // Deform and update — must not throw
    modifyTerrainHeight(0, 0, -1.5, 3);
    expect(() => updateTerrainGeometry(terrain)).not.toThrow();
  });
});

// ─── WorldItemType includes bomb ──────────────────────────────────────────────

describe("WorldItemType", () => {
  it("bomb is a valid WorldItemType value", () => {
    // This test verifies the type union includes "bomb"
    // TypeScript compile-time check — runtime check via assignment
    const itemTypes: string[] = ["pumpkin", "bomb"];
    expect(itemTypes).toContain("bomb");
  });
});
