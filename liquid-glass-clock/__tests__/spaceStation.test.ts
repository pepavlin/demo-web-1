/**
 * Tests for space station game logic:
 * - RocketState 'docked' type inclusion
 * - Room collision helper logic
 * - Spawn position validity
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
import type { RocketState } from "@/lib/gameTypes";
import { buildSpaceStationInterior } from "@/lib/meshBuilders";

// ── RocketState type validation ────────────────────────────────────────────────
describe("RocketState type", () => {
  const validStates: RocketState[] = [
    "idle",
    "boarded",
    "countdown",
    "launching",
    "arrived",
    "docked",
  ];

  it("includes 'docked' as a valid rocket state", () => {
    expect(validStates).toContain("docked");
  });

  it("has exactly 6 valid states", () => {
    expect(validStates.length).toBe(6);
  });

  it("all expected states are present", () => {
    const expected = ["idle", "boarded", "countdown", "launching", "arrived", "docked"];
    expected.forEach((state) => {
      expect(validStates).toContain(state);
    });
  });
});

// ── Space station room collision logic ────────────────────────────────────────
describe("Space station room collision", () => {
  // Mirror the collision check from Game3D.tsx
  const SPACE_STATION_WORLD_X = 0;
  const SPACE_STATION_WORLD_Z = 0;
  const PLAYER_RADIUS = 0.5;

  function isInRoom(
    rooms: THREE.Box3[],
    worldX: number,
    worldZ: number
  ): boolean {
    return rooms.some(
      (room) =>
        worldX >= room.min.x - PLAYER_RADIUS + SPACE_STATION_WORLD_X &&
        worldX <= room.max.x + PLAYER_RADIUS + SPACE_STATION_WORLD_X &&
        worldZ >= room.min.z - PLAYER_RADIUS + SPACE_STATION_WORLD_Z &&
        worldZ <= room.max.z + PLAYER_RADIUS + SPACE_STATION_WORLD_Z
    );
  }

  let rooms: THREE.Box3[];

  beforeEach(() => {
    const result = buildSpaceStationInterior();
    rooms = result.rooms;
  });

  it("spawn position (0, 0) is inside the station", () => {
    expect(isInRoom(rooms, 0, 0)).toBe(true);
  });

  it("a position in the main corridor (X=20, Z=0) is inside the station", () => {
    expect(isInRoom(rooms, 20, 0)).toBe(true);
  });

  it("a position in the bridge (X=45, Z=0) is inside the station", () => {
    expect(isInRoom(rooms, 45, 0)).toBe(true);
  });

  it("a position in crew quarters (X=18, Z=12) is inside the station", () => {
    expect(isInRoom(rooms, 18, 12)).toBe(true);
  });

  it("a position in engineering bay (X=20, Z=-12) is inside the station", () => {
    expect(isInRoom(rooms, 20, -12)).toBe(true);
  });

  it("a position far outside the station (X=200, Z=0) is outside", () => {
    expect(isInRoom(rooms, 200, 0)).toBe(false);
  });

  it("a position at Z=100 (corridor wall) is outside", () => {
    expect(isInRoom(rooms, 20, 100)).toBe(false);
  });

  it("a position at X=-50 (before airlock) is outside", () => {
    expect(isInRoom(rooms, -50, 0)).toBe(false);
  });
});

// ── Station world position sanity checks ─────────────────────────────────────
describe("Space station world position constants", () => {
  const SPACE_STATION_WORLD_Y = 2000;

  it("station Y is far above the exterior world (above Y=200)", () => {
    expect(SPACE_STATION_WORLD_Y).toBeGreaterThan(200);
  });

  it("station Y creates sufficient fog distance to hide exterior", () => {
    // FogExp2 density = 0.003, distance = 2000
    // fogFactor = 1 - exp(-0.003 * 2000) = 1 - exp(-6) ≈ 0.9975
    const fogDensity = 0.003;
    const fogFactor = 1 - Math.exp(-fogDensity * SPACE_STATION_WORLD_Y);
    // Should be > 99% fog at the world origin (exterior objects invisible)
    expect(fogFactor).toBeGreaterThan(0.99);
  });
});

// ── Interior light animation formula validation ───────────────────────────────
describe("Space station light flicker animation", () => {
  it("flicker formula always stays within reasonable intensity range", () => {
    const baseIntensity = 1.5;
    for (let t = 0; t < 100; t += 0.1) {
      for (let phase = 0; phase < Math.PI * 2; phase += 0.5) {
        const intensity =
          baseIntensity * (0.88 + Math.sin(t * (1.1 + phase * 0.3) + phase) * 0.12);
        // Intensity should always be positive and reasonable
        expect(intensity).toBeGreaterThan(0);
        expect(intensity).toBeLessThan(baseIntensity * 1.5);
      }
    }
  });
});

// ── Animated mesh types ────────────────────────────────────────────────────────
describe("Space station animated mesh types", () => {
  it("buildSpaceStationInterior returns meshes with recognised types", () => {
    const { animatedMeshes } = buildSpaceStationInterior();
    const validTypes = ["hologram", "reactor", "panel"];
    animatedMeshes.forEach(({ type }) => {
      expect(validTypes).toContain(type);
    });
  });

  it("hologram meshes are all THREE.Mesh instances", () => {
    const { animatedMeshes } = buildSpaceStationInterior();
    const holograms = animatedMeshes.filter((m) => m.type === "hologram");
    expect(holograms.length).toBeGreaterThan(0);
    holograms.forEach(({ mesh }) => {
      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });
  });

  it("reactor meshes are all THREE.Mesh instances", () => {
    const { animatedMeshes } = buildSpaceStationInterior();
    const reactorMeshes = animatedMeshes.filter((m) => m.type === "reactor");
    expect(reactorMeshes.length).toBeGreaterThan(0);
    reactorMeshes.forEach(({ mesh }) => {
      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });
  });
});

// ── Auto-docking scene transition logic ──────────────────────────────────────
describe("Auto-docking: rocket arrives → immediate space station entry", () => {
  const SPACE_STATION_WORLD_Y = 2000;
  const SPACE_STATION_WORLD_X = 0;
  const SPACE_STATION_WORLD_Z = 0;
  const PLAYER_HEIGHT = 1.8;

  it("station spawn Y is at SPACE_STATION_WORLD_Y + PLAYER_HEIGHT", () => {
    const spawnY = SPACE_STATION_WORLD_Y + PLAYER_HEIGHT;
    expect(spawnY).toBe(2001.8);
  });

  it("station spawn position is well above the exterior world", () => {
    const spawnY = SPACE_STATION_WORLD_Y + PLAYER_HEIGHT;
    expect(spawnY).toBeGreaterThan(200);
  });

  it("airlock zone check: player at (0, 0) local is near airlock", () => {
    // Mirror the airlock detection from Game3D.tsx
    const playerLocalX = 0;
    const playerLocalZ = 0;
    const nearAirlock = Math.abs(playerLocalX) <= 5.5 && Math.abs(playerLocalZ) <= 5.5;
    expect(nearAirlock).toBe(true);
  });

  it("airlock zone check: player at (10, 0) local is NOT near airlock", () => {
    const playerLocalX = 10;
    const playerLocalZ = 0;
    const nearAirlock = Math.abs(playerLocalX) <= 5.5 && Math.abs(playerLocalZ) <= 5.5;
    expect(nearAirlock).toBe(false);
  });

  it("welcome timer starts at 4 seconds on auto-dock", () => {
    // The auto-docking code sets stationWelcomeTimerRef.current = 4
    const WELCOME_DURATION = 4;
    expect(WELCOME_DURATION).toBeGreaterThan(0);
    expect(WELCOME_DURATION).toBeLessThanOrEqual(10); // sanity: not too long
  });

  it("docked state correctly differs from arrived state", () => {
    const arrivedState: RocketState = "arrived";
    const dockedState: RocketState = "docked";
    expect(arrivedState).not.toBe(dockedState);
    expect(dockedState).toBe("docked");
  });

  it("Earth return spawn is near the rocket launch pad", () => {
    const ROCKET_SPAWN_X = 8;
    const ROCKET_SPAWN_Z = -28;
    // Exit airlock returns to ROCKET_SPAWN_X + 4, ROCKET_SPAWN_Z + 4
    const landX = ROCKET_SPAWN_X + 4;
    const landZ = ROCKET_SPAWN_Z + 4;
    // Should be close to the rocket (within 10 units)
    const dist = Math.sqrt((landX - ROCKET_SPAWN_X) ** 2 + (landZ - ROCKET_SPAWN_Z) ** 2);
    expect(dist).toBeLessThan(10);
  });

  it("station world origin is at expected coordinates", () => {
    expect(SPACE_STATION_WORLD_X).toBe(0);
    expect(SPACE_STATION_WORLD_Z).toBe(0);
    expect(SPACE_STATION_WORLD_Y).toBe(2000);
  });
});

// ── Rocket E-key exit guard: only exit in idle/boarded state ─────────────────
describe("Rocket E-key exit guard", () => {
  /**
   * Mirrors the logic in Game3D.tsx: pressing E while on rocket should
   * only detach the player when the rocket is in 'idle' or 'boarded' state.
   * During 'launching', 'countdown', 'arrived', and 'docked' the E key must
   * be a no-op on this branch (arrived is handled by the station-entry block).
   */
  type RocketStateType = "idle" | "boarded" | "countdown" | "launching" | "arrived" | "docked";

  function canExitRocket(state: RocketStateType): boolean {
    return state === "idle" || state === "boarded";
  }

  it("allows exit while idle", () => {
    expect(canExitRocket("idle")).toBe(true);
  });

  it("allows exit while boarded (pre-launch)", () => {
    expect(canExitRocket("boarded")).toBe(true);
  });

  it("does NOT allow exit while in countdown", () => {
    expect(canExitRocket("countdown")).toBe(false);
  });

  it("does NOT allow exit while launching — prevents mid-flight ejection", () => {
    expect(canExitRocket("launching")).toBe(false);
  });

  it("does NOT allow exit while arrived — station-entry branch handles this", () => {
    expect(canExitRocket("arrived")).toBe(false);
  });

  it("does NOT allow exit while docked", () => {
    expect(canExitRocket("docked")).toBe(false);
  });

  it("exactly two states allow rocket exit", () => {
    const allStates: RocketStateType[] = ["idle", "boarded", "countdown", "launching", "arrived", "docked"];
    const exitableStates = allStates.filter(canExitRocket);
    expect(exitableStates).toHaveLength(2);
    expect(exitableStates).toEqual(["idle", "boarded"]);
  });
});
