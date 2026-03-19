/**
 * Tests for the harbor system:
 *  - buildHarborDockMesh() — structure and geometry
 *  - buildSailboatMesh()   — structure and exported refs
 *  - findHarborPosition()  — coastal position search
 *  - Sailing constants
 */

import * as THREE from "three";
import {
  buildHarborDockMesh,
  buildSailboatMesh,
  buildMotorboatMesh,
  findHarborPosition,
  SAILBOAT_MAX_SPEED,
  SAILBOAT_ACCEL,
  SAILBOAT_BRAKE,
  SAILBOAT_TURN_SPEED,
  SAILBOAT_BOARD_RADIUS,
  SAILBOAT_CAM_HEIGHT,
  SAILBOAT_CAM_DIST,
  MOTORBOAT_MAX_SPEED,
  MOTORBOAT_ACCEL,
  MOTORBOAT_BRAKE,
  MOTORBOAT_TURN_SPEED,
  MOTORBOAT_BOARD_RADIUS,
  MOTORBOAT_CAM_HEIGHT,
  MOTORBOAT_CAM_DIST,
} from "../lib/harborSystem";

// ─── buildHarborDockMesh ──────────────────────────────────────────────────────

describe("buildHarborDockMesh", () => {
  let dock: THREE.Group;

  beforeEach(() => {
    dock = buildHarborDockMesh();
  });

  it("returns a THREE.Group", () => {
    expect(dock).toBeInstanceOf(THREE.Group);
  });

  it("contains children (deck planks, pillars, bollards, hut, lights)", () => {
    expect(dock.children.length).toBeGreaterThan(10);
  });

  it("contains at least one PointLight for dock lighting", () => {
    const lights: THREE.PointLight[] = [];
    dock.traverse((obj) => {
      if (obj instanceof THREE.PointLight) lights.push(obj);
    });
    expect(lights.length).toBeGreaterThan(0);
  });

  it("contains meshes with cast shadow enabled", () => {
    const shadowCasters: THREE.Mesh[] = [];
    dock.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.castShadow) shadowCasters.push(obj);
    });
    expect(shadowCasters.length).toBeGreaterThan(0);
  });

  it("contains a Torus geometry (bollard ring or chain link)", () => {
    const tori: THREE.Mesh[] = [];
    dock.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.TorusGeometry) tori.push(obj);
    });
    expect(tori.length).toBeGreaterThan(0);
  });

  it("contains cylindrical pillars", () => {
    const cylinders: THREE.Mesh[] = [];
    dock.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) cylinders.push(obj);
    });
    expect(cylinders.length).toBeGreaterThan(2);
  });

  it("has position defaulting to origin (caller sets position)", () => {
    expect(dock.position.x).toBe(0);
    expect(dock.position.y).toBe(0);
    expect(dock.position.z).toBe(0);
  });
});

// ─── buildSailboatMesh ───────────────────────────────────────────────────────

describe("buildSailboatMesh", () => {
  let result: ReturnType<typeof buildSailboatMesh>;

  beforeEach(() => {
    result = buildSailboatMesh();
  });

  it("returns an object with group, sailMesh, and sailGroup", () => {
    expect(result).toHaveProperty("group");
    expect(result).toHaveProperty("sailMesh");
    expect(result).toHaveProperty("sailGroup");
  });

  it("group is a THREE.Group", () => {
    expect(result.group).toBeInstanceOf(THREE.Group);
  });

  it("sailMesh is a THREE.Mesh", () => {
    expect(result.sailMesh).toBeInstanceOf(THREE.Mesh);
  });

  it("sailGroup is a THREE.Group", () => {
    expect(result.sailGroup).toBeInstanceOf(THREE.Group);
  });

  it("sailGroup is a descendant of group", () => {
    let found = false;
    result.group.traverse((obj) => {
      if (obj === result.sailGroup) found = true;
    });
    expect(found).toBe(true);
  });

  it("sailMesh is a descendant of sailGroup", () => {
    let found = false;
    result.sailGroup.traverse((obj) => {
      if (obj === result.sailMesh) found = true;
    });
    expect(found).toBe(true);
  });

  it("has a PlaneGeometry for the main sail", () => {
    expect(result.sailMesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
  });

  it("has many children (hull, mast, cabin, helm, rigging, etc.)", () => {
    const all: THREE.Object3D[] = [];
    result.group.traverse((o) => all.push(o));
    expect(all.length).toBeGreaterThan(20);
  });

  it("has PointLights for navigation lights", () => {
    const lights: THREE.PointLight[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.PointLight) lights.push(obj);
    });
    // port, starboard, and masthead lights
    expect(lights.length).toBeGreaterThanOrEqual(3);
  });

  it("has meshes with cast shadow enabled (hull)", () => {
    const casters: THREE.Mesh[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.castShadow) casters.push(obj);
    });
    expect(casters.length).toBeGreaterThan(0);
  });

  it("has at least one CylinderGeometry (mast, boom, rigging)", () => {
    const cylinders: THREE.Mesh[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) cylinders.push(obj);
    });
    expect(cylinders.length).toBeGreaterThan(0);
  });

  it("has a TorusGeometry (helm wheel rim or rope coil)", () => {
    const tori: THREE.Mesh[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.TorusGeometry) tori.push(obj);
    });
    expect(tori.length).toBeGreaterThan(0);
  });

  it("group starts at origin", () => {
    expect(result.group.position.x).toBe(0);
    expect(result.group.position.y).toBe(0);
    expect(result.group.position.z).toBe(0);
  });
});

// ─── findHarborPosition ───────────────────────────────────────────────────────

describe("findHarborPosition", () => {
  const WATER_LEVEL = -0.5;

  it("returns null when all terrain is underwater", () => {
    const alwaysWater = () => WATER_LEVEL - 2;
    const result = findHarborPosition(alwaysWater, WATER_LEVEL, 90);
    expect(result).toBeNull();
  });

  it("returns null when no water is beyond the search ring", () => {
    const alwaysLand = () => WATER_LEVEL + 5;
    const result = findHarborPosition(alwaysLand, WATER_LEVEL, 90);
    expect(result).toBeNull();
  });

  it("finds a position when land exists at searchDist and water at searchDist+18", () => {
    // Terrain function: land at radius ≤ 90, water at radius > 90
    const coastalTerrain = (x: number, z: number) => {
      const r = Math.sqrt(x * x + z * z);
      return r <= 90 ? WATER_LEVEL + 3 : WATER_LEVEL - 2;
    };
    const result = findHarborPosition(coastalTerrain, WATER_LEVEL, 90);
    expect(result).not.toBeNull();
    if (result) {
      expect(typeof result.x).toBe("number");
      expect(typeof result.z).toBe("number");
      expect(typeof result.angle).toBe("number");
    }
  });

  it("returned position is at approximately the search radius", () => {
    const coastalTerrain = (x: number, z: number) => {
      const r = Math.sqrt(x * x + z * z);
      return r <= 90 ? WATER_LEVEL + 3 : WATER_LEVEL - 2;
    };
    const result = findHarborPosition(coastalTerrain, WATER_LEVEL, 90);
    expect(result).not.toBeNull();
    if (result) {
      const r = Math.sqrt(result.x * result.x + result.z * result.z);
      expect(r).toBeCloseTo(90, 0);
    }
  });

  it("returned angle points roughly from origin toward the found position", () => {
    // Narrow coast only in one quadrant (0°–90°, i.e. +X,+Z)
    const coastalTerrain = (x: number, z: number) => {
      const r = Math.sqrt(x * x + z * z);
      const angle = Math.atan2(z, x) * (180 / Math.PI);
      if (r >= 88 && r <= 92 && angle >= 0 && angle <= 90) return WATER_LEVEL + 3;
      if (r > 92 && angle >= 0 && angle <= 90) return WATER_LEVEL - 2;
      if (r <= 88) return WATER_LEVEL + 3;
      return WATER_LEVEL - 2;
    };
    const result = findHarborPosition(coastalTerrain, WATER_LEVEL, 90);
    // If found, the angle should point roughly toward +X/+Z quadrant
    if (result) {
      expect(result.angle).toBeGreaterThanOrEqual(0);
      expect(result.angle).toBeLessThan(Math.PI / 2 + 0.2);
    }
  });

  it("also works with a different search distance", () => {
    const coastalTerrain = (x: number, z: number) => {
      const r = Math.sqrt(x * x + z * z);
      return r <= 60 ? WATER_LEVEL + 3 : WATER_LEVEL - 2;
    };
    const result = findHarborPosition(coastalTerrain, WATER_LEVEL, 60);
    expect(result).not.toBeNull();
  });
});

// ─── buildMotorboatMesh ───────────────────────────────────────────────────────

describe("buildMotorboatMesh", () => {
  let result: ReturnType<typeof buildMotorboatMesh>;

  beforeEach(() => {
    result = buildMotorboatMesh();
  });

  it("returns an object with group, propellerGroup, and engineGroup", () => {
    expect(result).toHaveProperty("group");
    expect(result).toHaveProperty("propellerGroup");
    expect(result).toHaveProperty("engineGroup");
  });

  it("group is a THREE.Group", () => {
    expect(result.group).toBeInstanceOf(THREE.Group);
  });

  it("propellerGroup is a THREE.Group", () => {
    expect(result.propellerGroup).toBeInstanceOf(THREE.Group);
  });

  it("engineGroup is a THREE.Group", () => {
    expect(result.engineGroup).toBeInstanceOf(THREE.Group);
  });

  it("propellerGroup is a descendant of group", () => {
    let found = false;
    result.group.traverse((obj) => {
      if (obj === result.propellerGroup) found = true;
    });
    expect(found).toBe(true);
  });

  it("engineGroup is a descendant of group", () => {
    let found = false;
    result.group.traverse((obj) => {
      if (obj === result.engineGroup) found = true;
    });
    expect(found).toBe(true);
  });

  it("propellerGroup is a descendant of engineGroup", () => {
    let found = false;
    result.engineGroup.traverse((obj) => {
      if (obj === result.propellerGroup) found = true;
    });
    expect(found).toBe(true);
  });

  it("has many children (hull, deck, motor, seats, windshield, etc.)", () => {
    const all: THREE.Object3D[] = [];
    result.group.traverse((o) => all.push(o));
    expect(all.length).toBeGreaterThan(20);
  });

  it("has PointLights for navigation lights", () => {
    const lights: THREE.PointLight[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.PointLight) lights.push(obj);
    });
    // port, starboard, and stern lights
    expect(lights.length).toBeGreaterThanOrEqual(3);
  });

  it("has meshes with cast shadow enabled (hull)", () => {
    const casters: THREE.Mesh[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.castShadow) casters.push(obj);
    });
    expect(casters.length).toBeGreaterThan(0);
  });

  it("has at least one CylinderGeometry (motor shaft, lower unit, etc.)", () => {
    const cylinders: THREE.Mesh[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.CylinderGeometry) cylinders.push(obj);
    });
    expect(cylinders.length).toBeGreaterThan(0);
  });

  it("has a TorusGeometry (steering wheel rim)", () => {
    const tori: THREE.Mesh[] = [];
    result.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry instanceof THREE.TorusGeometry) tori.push(obj);
    });
    expect(tori.length).toBeGreaterThan(0);
  });

  it("propellerGroup contains at least 3 blade meshes plus a hub", () => {
    const meshes: THREE.Mesh[] = [];
    result.propellerGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshes.push(obj);
    });
    // 3 blades + 1 hub = 4
    expect(meshes.length).toBeGreaterThanOrEqual(4);
  });

  it("group starts at origin", () => {
    expect(result.group.position.x).toBe(0);
    expect(result.group.position.y).toBe(0);
    expect(result.group.position.z).toBe(0);
  });
});

// ─── Sailing constants ────────────────────────────────────────────────────────

describe("sailing constants", () => {
  it("SAILBOAT_MAX_SPEED is a positive number", () => {
    expect(SAILBOAT_MAX_SPEED).toBeGreaterThan(0);
  });

  it("SAILBOAT_ACCEL is less than MAX_SPEED (takes time to reach max)", () => {
    expect(SAILBOAT_ACCEL).toBeLessThan(SAILBOAT_MAX_SPEED);
  });

  it("SAILBOAT_BRAKE is positive", () => {
    expect(SAILBOAT_BRAKE).toBeGreaterThan(0);
  });

  it("SAILBOAT_TURN_SPEED is a positive number", () => {
    expect(SAILBOAT_TURN_SPEED).toBeGreaterThan(0);
  });

  it("SAILBOAT_BOARD_RADIUS is a positive number", () => {
    expect(SAILBOAT_BOARD_RADIUS).toBeGreaterThan(0);
  });

  it("SAILBOAT_CAM_HEIGHT is a positive number", () => {
    expect(SAILBOAT_CAM_HEIGHT).toBeGreaterThan(0);
  });

  it("SAILBOAT_CAM_DIST is a positive number", () => {
    expect(SAILBOAT_CAM_DIST).toBeGreaterThan(0);
  });

  it("SAILBOAT_BRAKE > SAILBOAT_ACCEL (decelerates faster than accelerates for nautical feel)", () => {
    expect(SAILBOAT_BRAKE).toBeGreaterThan(SAILBOAT_ACCEL);
  });
});

// ─── Motorboat constants ──────────────────────────────────────────────────────

describe("motorboat constants", () => {
  it("MOTORBOAT_MAX_SPEED is a positive number", () => {
    expect(MOTORBOAT_MAX_SPEED).toBeGreaterThan(0);
  });

  it("MOTORBOAT_MAX_SPEED is significantly faster than SAILBOAT_MAX_SPEED", () => {
    expect(MOTORBOAT_MAX_SPEED).toBeGreaterThan(SAILBOAT_MAX_SPEED * 2);
  });

  it("MOTORBOAT_ACCEL is positive", () => {
    expect(MOTORBOAT_ACCEL).toBeGreaterThan(0);
  });

  it("MOTORBOAT_ACCEL is greater than SAILBOAT_ACCEL (snappier throttle)", () => {
    expect(MOTORBOAT_ACCEL).toBeGreaterThan(SAILBOAT_ACCEL);
  });

  it("MOTORBOAT_BRAKE is positive", () => {
    expect(MOTORBOAT_BRAKE).toBeGreaterThan(0);
  });

  it("MOTORBOAT_BRAKE > MOTORBOAT_ACCEL (hard braking)", () => {
    expect(MOTORBOAT_BRAKE).toBeGreaterThan(MOTORBOAT_ACCEL);
  });

  it("MOTORBOAT_TURN_SPEED is positive", () => {
    expect(MOTORBOAT_TURN_SPEED).toBeGreaterThan(0);
  });

  it("MOTORBOAT_TURN_SPEED is greater than SAILBOAT_TURN_SPEED (more agile)", () => {
    expect(MOTORBOAT_TURN_SPEED).toBeGreaterThan(SAILBOAT_TURN_SPEED);
  });

  it("MOTORBOAT_BOARD_RADIUS is a positive number", () => {
    expect(MOTORBOAT_BOARD_RADIUS).toBeGreaterThan(0);
  });

  it("MOTORBOAT_CAM_HEIGHT is a positive number", () => {
    expect(MOTORBOAT_CAM_HEIGHT).toBeGreaterThan(0);
  });

  it("MOTORBOAT_CAM_HEIGHT is less than SAILBOAT_CAM_HEIGHT (lower profile boat)", () => {
    expect(MOTORBOAT_CAM_HEIGHT).toBeLessThan(SAILBOAT_CAM_HEIGHT);
  });

  it("MOTORBOAT_CAM_DIST is a positive number", () => {
    expect(MOTORBOAT_CAM_DIST).toBeGreaterThan(0);
  });
});
