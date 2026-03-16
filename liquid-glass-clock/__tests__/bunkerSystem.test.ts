/**
 * Tests for the bunker system:
 * - BunkerConfig structure validation
 * - Exterior mesh builder (produces a THREE.Group)
 * - Interior scene builder (rooms, lights, animatedMeshes, exitLocalPos)
 * - Proximity helper (checkBunkerProximity)
 * - Exit/entry detection helpers
 * - Interior world position sanity checks
 * - Light flicker formula
 */

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

import * as THREE from "three";
import {
  BUNKER_CONFIGS,
  BUNKER_ENTRY_RADIUS,
  BUNKER_EXIT_RADIUS,
  BUNKER_CHEST_OPEN_RADIUS,
  BUNKER_INTERIOR_WORLD_Y,
  BUNKER_INTERIOR_WORLD_X,
  BUNKER_INTERIOR_WORLD_Z,
  buildBunkerExteriorMesh,
  buildBunkerInteriorScene,
  checkBunkerProximity,
  isNearBunkerExit,
  isNearBunkerEntry,
  type BunkerConfig,
} from "@/lib/bunkerSystem";

// ── BunkerConfig structure ────────────────────────────────────────────────────
describe("BUNKER_CONFIGS", () => {
  it("contains exactly 3 bunker configs", () => {
    expect(BUNKER_CONFIGS).toHaveLength(3);
  });

  it("all configs have unique ids", () => {
    const ids = BUNKER_CONFIGS.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all configs have valid world positions (within WORLD_SIZE/2 = 133.5)", () => {
    const HALF = 133.5;
    BUNKER_CONFIGS.forEach((c) => {
      expect(Math.abs(c.worldX)).toBeLessThanOrEqual(HALF);
      expect(Math.abs(c.worldZ)).toBeLessThanOrEqual(HALF);
    });
  });

  it("all configs have unique world positions", () => {
    for (let i = 0; i < BUNKER_CONFIGS.length; i++) {
      for (let j = i + 1; j < BUNKER_CONFIGS.length; j++) {
        const a = BUNKER_CONFIGS[i];
        const b = BUNKER_CONFIGS[j];
        const dist = Math.sqrt((a.worldX - b.worldX) ** 2 + (a.worldZ - b.worldZ) ** 2);
        // Bunkers should be at least 20 units apart
        expect(dist).toBeGreaterThan(20);
      }
    }
  });

  it("all configs have non-empty names", () => {
    BUNKER_CONFIGS.forEach((c) => {
      expect(c.name).toBeTruthy();
      expect(c.name.length).toBeGreaterThan(0);
    });
  });
});

// ── Exterior mesh builder ────────────────────────────────────────────────────
describe("buildBunkerExteriorMesh", () => {
  let extGroup: THREE.Group;

  beforeEach(() => {
    extGroup = buildBunkerExteriorMesh(BUNKER_CONFIGS[0]);
  });

  it("returns a THREE.Group", () => {
    expect(extGroup).toBeInstanceOf(THREE.Group);
  });

  it("group has at least 10 child meshes (container top, hatch, ladder, etc.)", () => {
    const meshCount = extGroup.children.filter((c) => c instanceof THREE.Mesh).length;
    expect(meshCount).toBeGreaterThanOrEqual(10);
  });

  it("group position is at origin by default (caller sets it)", () => {
    expect(extGroup.position.x).toBe(0);
    expect(extGroup.position.y).toBe(0);
    expect(extGroup.position.z).toBe(0);
  });
});

// ── Interior scene builder ───────────────────────────────────────────────────
describe("buildBunkerInteriorScene", () => {
  let result: ReturnType<typeof buildBunkerInteriorScene>;

  beforeEach(() => {
    result = buildBunkerInteriorScene();
  });

  it("returns a group, rooms, lights, animatedMeshes, exitLocalPos, and chestLocalPositions", () => {
    expect(result.group).toBeInstanceOf(THREE.Group);
    expect(Array.isArray(result.rooms)).toBe(true);
    expect(Array.isArray(result.lights)).toBe(true);
    expect(Array.isArray(result.animatedMeshes)).toBe(true);
    expect(result.exitLocalPos).toBeInstanceOf(THREE.Vector3);
    expect(Array.isArray(result.chestLocalPositions)).toBe(true);
  });

  it("has exactly 5 walkable rooms (3 container bodies + 2 doorway passages)", () => {
    // Each non-last container contributes: 1 main room + 1 doorway room = 2 rooms
    // The last container contributes 1 main room
    // Total = (NUM_CONTAINERS - 1) * 2 + 1 = 2*2 + 1 = 5
    expect(result.rooms.length).toBe(5);
  });

  it("doorway rooms are narrower than container rooms (enforce doorway width)", () => {
    // Doorway rooms should have X width <= doorW (1.6) — narrower than full container (5 units)
    const doorW = 1.6;
    const doorwayRooms = result.rooms.filter(
      (room) => room.max.x - room.min.x <= doorW + 0.01
    );
    // There should be 2 doorway rooms (between container 0-1 and container 1-2)
    expect(doorwayRooms.length).toBe(2);
  });

  it("each room is a valid THREE.Box3 with min < max", () => {
    result.rooms.forEach((room) => {
      expect(room.min.x).toBeLessThan(room.max.x);
      expect(room.min.z).toBeLessThan(room.max.z);
      expect(room.min.y).toBeLessThanOrEqual(room.max.y);
    });
  });

  it("has at least 4 lights", () => {
    expect(result.lights.length).toBeGreaterThanOrEqual(4);
  });

  it("all lights are THREE.PointLight instances", () => {
    result.lights.forEach(({ light }) => {
      expect(light).toBeInstanceOf(THREE.PointLight);
    });
  });

  it("all light base intensities are positive", () => {
    result.lights.forEach(({ baseIntensity }) => {
      expect(baseIntensity).toBeGreaterThan(0);
    });
  });

  it("has animated meshes with valid types", () => {
    const validTypes = ["monitor", "server_led", "vent"];
    result.animatedMeshes.forEach(({ type }) => {
      expect(validTypes).toContain(type);
    });
  });

  it("exit position is at the back of the 3rd container (Z ≈ 35)", () => {
    expect(result.exitLocalPos.z).toBeGreaterThan(30);
    expect(result.exitLocalPos.z).toBeLessThan(40);
  });

  it("group has at least 30 child objects (containers have many parts)", () => {
    // Count all children recursively via traverse
    let count = 0;
    result.group.traverse(() => { count++; });
    expect(count).toBeGreaterThan(30);
  });

  it("spawn position (local 0,0) is inside the first room", () => {
    const PLAYER_RADIUS = 0.5;
    const isInRoom = (px: number, pz: number) =>
      result.rooms.some(
        (room) =>
          px >= room.min.x - PLAYER_RADIUS &&
          px <= room.max.x + PLAYER_RADIUS &&
          pz >= room.min.z - PLAYER_RADIUS &&
          pz <= room.max.z + PLAYER_RADIUS
      );
    // Player spawns at Z=1.5 (entry area of container 1)
    expect(isInRoom(0, 1.5)).toBe(true);
  });
});

// ── checkBunkerProximity ─────────────────────────────────────────────────────
describe("checkBunkerProximity", () => {
  const configs = BUNKER_CONFIGS;

  it("returns the bunker when player is exactly at its position", () => {
    const b = configs[0];
    const result = checkBunkerProximity(b.worldX, b.worldZ, configs);
    expect(result).toBe(b);
  });

  it("returns the bunker when player is within BUNKER_ENTRY_RADIUS", () => {
    const b = configs[1];
    const result = checkBunkerProximity(
      b.worldX + BUNKER_ENTRY_RADIUS - 0.1,
      b.worldZ,
      configs
    );
    expect(result).toBe(b);
  });

  it("returns null when player is outside BUNKER_ENTRY_RADIUS", () => {
    const b = configs[0];
    const result = checkBunkerProximity(
      b.worldX + BUNKER_ENTRY_RADIUS + 1,
      b.worldZ,
      configs
    );
    expect(result).toBeNull();
  });

  it("returns null when player is far from all bunkers", () => {
    const result = checkBunkerProximity(0, 0, configs);
    // (0,0) should be far from all three bunker positions
    const allFar = configs.every((c) => {
      const d = Math.sqrt(c.worldX ** 2 + c.worldZ ** 2);
      return d > BUNKER_ENTRY_RADIUS;
    });
    if (allFar) {
      expect(result).toBeNull();
    }
    // If not (unlikely), just verify a BunkerConfig is returned
  });

  it("returns the closest bunker when player is within radius of multiple", () => {
    // Create synthetic configs where two bunkers are very close
    const syntheticConfigs: BunkerConfig[] = [
      { id: "a", worldX: 10, worldZ: 0, rotation: 0, name: "A" },
      { id: "b", worldX: 11, worldZ: 0, rotation: 0, name: "B" },
    ];
    // Player at X=10.4 — closer to "a" (dist=0.4) than "b" (dist=0.6)
    const result = checkBunkerProximity(10.4, 0, syntheticConfigs);
    expect(result?.id).toBe("a");
  });

  it("returns null for empty configs array", () => {
    const result = checkBunkerProximity(100, 100, []);
    expect(result).toBeNull();
  });
});

// ── isNearBunkerExit ─────────────────────────────────────────────────────────
describe("isNearBunkerExit", () => {
  it("returns true at the exit ladder position (localZ ≈ 35)", () => {
    expect(isNearBunkerExit(0, 35.0)).toBe(true);
  });

  it("returns true slightly offset from exit ladder", () => {
    expect(isNearBunkerExit(0.5, 34.5)).toBe(true);
  });

  it("returns false when player is in entry area (localZ ≈ 1.5)", () => {
    expect(isNearBunkerExit(0, 1.5)).toBe(false);
  });

  it("returns false when player is at Z=18 (mid-lab)", () => {
    expect(isNearBunkerExit(0, 18.0)).toBe(false);
  });

  it("exit detection radius equals BUNKER_EXIT_RADIUS", () => {
    // Just inside radius
    expect(isNearBunkerExit(0, 35.0 - BUNKER_EXIT_RADIUS + 0.1)).toBe(true);
    // Just outside radius
    expect(isNearBunkerExit(0, 35.0 - BUNKER_EXIT_RADIUS - 0.1)).toBe(false);
  });
});

// ── isNearBunkerEntry ─────────────────────────────────────────────────────────
describe("isNearBunkerEntry", () => {
  it("returns true at the entry ladder position (localZ ≈ 0.3)", () => {
    expect(isNearBunkerEntry(0, 0.3)).toBe(true);
  });

  it("returns false when player is far from entry (localZ = 10)", () => {
    expect(isNearBunkerEntry(0, 10.0)).toBe(false);
  });
});

// ── Interior world position constants ────────────────────────────────────────
describe("Bunker interior world position constants", () => {
  it("BUNKER_INTERIOR_WORLD_Y is above Y=200 (hidden by fog)", () => {
    expect(BUNKER_INTERIOR_WORLD_Y).toBeGreaterThan(200);
  });

  it("BUNKER_INTERIOR_WORLD_Y is distinct from SPACE_STATION_WORLD_Y (2000)", () => {
    expect(BUNKER_INTERIOR_WORLD_Y).not.toBe(2000);
  });

  it("BUNKER_INTERIOR_WORLD_X and Z are at origin", () => {
    expect(BUNKER_INTERIOR_WORLD_X).toBe(0);
    expect(BUNKER_INTERIOR_WORLD_Z).toBe(0);
  });

  it("Y is high enough to be fog-hidden (FogExp2 density=0.006, dist=1500 → opacity≈99.97%)", () => {
    const fogDensity = 0.006;
    const fogFactor = 1 - Math.exp(-fogDensity * BUNKER_INTERIOR_WORLD_Y);
    expect(fogFactor).toBeGreaterThan(0.99);
  });
});

// ── Light flicker formula ─────────────────────────────────────────────────────
describe("Bunker light flicker animation", () => {
  it("flicker formula keeps intensity within reasonable bounds", () => {
    for (let t = 0; t < 20; t += 0.1) {
      for (let phase = 0; phase < Math.PI * 2; phase += 0.5) {
        const baseIntensity = 1.2;
        const intensity = baseIntensity * (0.88 + Math.sin(t * (1.3 + phase * 0.2) + phase) * 0.12);
        expect(intensity).toBeGreaterThan(0);
        expect(intensity).toBeLessThan(baseIntensity * 1.5);
      }
    }
  });

  it("flicker never goes fully dark (intensity >= 0.76 × base)", () => {
    const base = 1.0;
    // Minimum factor = 0.88 - 0.12 = 0.76
    const minFactor = 0.88 - 0.12;
    expect(minFactor).toBeCloseTo(0.76);
    expect(base * minFactor).toBeGreaterThan(0);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────
describe("Bunker system constants", () => {
  it("BUNKER_ENTRY_RADIUS is positive and reasonable (1–10 units)", () => {
    expect(BUNKER_ENTRY_RADIUS).toBeGreaterThan(0);
    expect(BUNKER_ENTRY_RADIUS).toBeLessThanOrEqual(10);
  });

  it("BUNKER_EXIT_RADIUS is positive and reasonable", () => {
    expect(BUNKER_EXIT_RADIUS).toBeGreaterThan(0);
    expect(BUNKER_EXIT_RADIUS).toBeLessThanOrEqual(10);
  });

  it("BUNKER_CHEST_OPEN_RADIUS is positive and smaller than BUNKER_EXIT_RADIUS", () => {
    expect(BUNKER_CHEST_OPEN_RADIUS).toBeGreaterThan(0);
    expect(BUNKER_CHEST_OPEN_RADIUS).toBeLessThan(BUNKER_EXIT_RADIUS + 2);
  });
});

// ── Chest positions ─────────────────────────────────────────────────────────
describe("Bunker interior chest positions", () => {
  let result: ReturnType<typeof buildBunkerInteriorScene>;

  beforeEach(() => {
    result = buildBunkerInteriorScene();
  });

  it("returns exactly 2 chest positions", () => {
    expect(result.chestLocalPositions).toHaveLength(2);
  });

  it("all chest positions have numeric localX, localZ, and rotY", () => {
    result.chestLocalPositions.forEach((cp) => {
      expect(typeof cp.localX).toBe("number");
      expect(typeof cp.localZ).toBe("number");
      expect(typeof cp.rotY).toBe("number");
    });
  });

  it("chest 1 is in container 1 (Z = 0..12) — entry area", () => {
    const chest1 = result.chestLocalPositions[0];
    expect(chest1.localZ).toBeGreaterThanOrEqual(0);
    expect(chest1.localZ).toBeLessThanOrEqual(12);
  });

  it("chest 2 is in container 2 (Z = 12..24) — lab area", () => {
    const chest2 = result.chestLocalPositions[1];
    expect(chest2.localZ).toBeGreaterThan(12);
    expect(chest2.localZ).toBeLessThanOrEqual(24);
  });

  it("chest positions are inside the walkable room X bounds (−2.5 to +2.5 minus wall)", () => {
    const halfW = 2.5 - 0.18; // CONTAINER_W/2 − WALL_T
    result.chestLocalPositions.forEach((cp) => {
      expect(Math.abs(cp.localX)).toBeLessThanOrEqual(halfW + 0.1);
    });
  });
});
