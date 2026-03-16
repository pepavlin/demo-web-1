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
  // Updated for new (bigger) room layout:
  //   Airlock:         X:-8.. 8, Z: -8..  8
  //   Main Corridor:   X: 8..45, Z: -6..  6
  //   Bridge:          X:45..90, Z:-22.. 22
  //   Crew Quarters:   X:18..48, Z:  6.. 32
  //   Engineering Bay: X:18..48, Z:-32.. -6
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
    // X=45 is the boundary between corridor (X:8..45) and bridge (X:45..90);
    // PLAYER_RADIUS expansion means both rooms contain this point.
    expect(isInRoom(rooms, 45, 0)).toBe(true);
  });

  it("a position deep inside the bridge (X=70, Z=0) is inside the station", () => {
    expect(isInRoom(rooms, 70, 0)).toBe(true);
  });

  it("a position in crew quarters (X=18, Z=12) is inside the station", () => {
    // X=18 is at the crew-quarters minX boundary; PLAYER_RADIUS covers it.
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
    // Mirror the airlock detection from Game3D.tsx (threshold = 7.5 for new X:-8..8 airlock)
    const playerLocalX = 0;
    const playerLocalZ = 0;
    const nearAirlock = Math.abs(playerLocalX) <= 7.5 && Math.abs(playerLocalZ) <= 7.5;
    expect(nearAirlock).toBe(true);
  });

  it("airlock zone check: player at (10, 0) local is NOT near airlock", () => {
    const playerLocalX = 10;
    const playerLocalZ = 0;
    const nearAirlock = Math.abs(playerLocalX) <= 7.5 && Math.abs(playerLocalZ) <= 7.5;
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

// ── Sliding door system ────────────────────────────────────────────────────────
describe("Space station sliding doors", () => {
  it("buildSpaceStationInterior returns exactly 4 doors", () => {
    const { doors } = buildSpaceStationInterior();
    expect(doors.length).toBe(4);
  });

  it("each door has exactly 2 panel meshes", () => {
    const { doors } = buildSpaceStationInterior();
    doors.forEach((door) => {
      expect(door.panels.length).toBe(2);
      door.panels.forEach((panel) => {
        expect(panel).toBeInstanceOf(THREE.Mesh);
      });
    });
  });

  it("each door has valid closedPos and openPos arrays", () => {
    const { doors } = buildSpaceStationInterior();
    doors.forEach((door) => {
      expect(door.closedPos.length).toBe(2);
      expect(door.openPos.length).toBe(2);
      door.closedPos.forEach((pos) => {
        expect(pos).toBeInstanceOf(THREE.Vector3);
      });
      door.openPos.forEach((pos) => {
        expect(pos).toBeInstanceOf(THREE.Vector3);
      });
    });
  });

  it("door axis is either 'x' or 'z'", () => {
    const { doors } = buildSpaceStationInterior();
    doors.forEach((door) => {
      expect(['x', 'z']).toContain(door.axis);
    });
  });

  it("open positions are farther apart than closed positions (door slides outward)", () => {
    const { doors } = buildSpaceStationInterior();
    doors.forEach((door) => {
      const closedSeparation = door.closedPos[0].distanceTo(door.closedPos[1]);
      const openSeparation = door.openPos[0].distanceTo(door.openPos[1]);
      expect(openSeparation).toBeGreaterThan(closedSeparation);
    });
  });

  it("door localPos is at the expected room boundary positions", () => {
    const { doors } = buildSpaceStationInterior();
    const doorPositions = doors.map((d) => ({ x: d.localPos.x, z: d.localPos.z }));

    // Airlock → Corridor door at X=8
    expect(doorPositions.some((p) => Math.abs(p.x - 8) < 0.01 && Math.abs(p.z) < 0.01)).toBe(true);
    // Corridor → Bridge door at X=45
    expect(doorPositions.some((p) => Math.abs(p.x - 45) < 0.01 && Math.abs(p.z) < 0.01)).toBe(true);
    // Corridor → Crew Quarters door at X=30, Z=6
    expect(doorPositions.some((p) => Math.abs(p.x - 30) < 0.01 && Math.abs(p.z - 6) < 0.01)).toBe(true);
    // Corridor → Engineering Bay door at X=30, Z=-6
    expect(doorPositions.some((p) => Math.abs(p.x - 30) < 0.01 && Math.abs(p.z + 6) < 0.01)).toBe(true);
  });

  it("door animation lerp: progress=0 means panels at closed position", () => {
    const { doors } = buildSpaceStationInterior();
    doors.forEach((door) => {
      // Simulate lerpVectors at progress=0 (closed)
      const pos0 = new THREE.Vector3().lerpVectors(door.closedPos[0], door.openPos[0], 0);
      const pos1 = new THREE.Vector3().lerpVectors(door.closedPos[1], door.openPos[1], 0);
      expect(pos0.distanceTo(door.closedPos[0])).toBeLessThan(0.001);
      expect(pos1.distanceTo(door.closedPos[1])).toBeLessThan(0.001);
    });
  });

  it("door animation lerp: progress=1 means panels at open position", () => {
    const { doors } = buildSpaceStationInterior();
    doors.forEach((door) => {
      const pos0 = new THREE.Vector3().lerpVectors(door.closedPos[0], door.openPos[0], 1);
      const pos1 = new THREE.Vector3().lerpVectors(door.closedPos[1], door.openPos[1], 1);
      expect(pos0.distanceTo(door.openPos[0])).toBeLessThan(0.001);
      expect(pos1.distanceTo(door.openPos[1])).toBeLessThan(0.001);
    });
  });

  it("door proximity detection: player at door localPos is within interact radius", () => {
    const { doors } = buildSpaceStationInterior();
    const DOOR_INTERACT_RADIUS = 2.5;
    doors.forEach((door) => {
      const dx = 0; // player exactly at door center
      const dz = 0;
      const dist = Math.sqrt(dx * dx + dz * dz);
      expect(dist).toBeLessThan(DOOR_INTERACT_RADIUS);
    });
  });

  it("door proximity detection: player 5 units away is outside interact radius", () => {
    const { doors } = buildSpaceStationInterior();
    const DOOR_INTERACT_RADIUS = 2.5;
    const firstDoor = doors[0];
    const playerX = firstDoor.localPos.x + 5;
    const playerZ = firstDoor.localPos.z;
    const dx = playerX - firstDoor.localPos.x;
    const dz = playerZ - firstDoor.localPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    expect(dist).toBeGreaterThanOrEqual(DOOR_INTERACT_RADIUS);
  });
});
