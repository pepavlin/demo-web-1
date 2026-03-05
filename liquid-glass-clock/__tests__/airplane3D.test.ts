/**
 * Tests for the 3D airplane mesh builders and AirplaneData type.
 *
 * Covers:
 *  - buildAirplane3DMesh: structure, propeller, body group
 *  - buildAirstripMesh: structure and geometry
 *  - AirplaneData type compatibility
 */

import * as THREE from "three";
import { buildAirplane3DMesh, buildAirstripMesh, buildAirstripSignMesh } from "../lib/meshBuilders";
import type { AirplaneData } from "../lib/gameTypes";

// ── buildAirplane3DMesh ────────────────────────────────────────────────────────

describe("buildAirplane3DMesh", () => {
  it("returns an object with group, propeller, and bodyGroup", () => {
    const result = buildAirplane3DMesh();
    expect(result).toHaveProperty("group");
    expect(result).toHaveProperty("propeller");
    expect(result).toHaveProperty("bodyGroup");
  });

  it("group is a THREE.Group", () => {
    const { group } = buildAirplane3DMesh();
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("bodyGroup is a THREE.Group", () => {
    const { bodyGroup } = buildAirplane3DMesh();
    expect(bodyGroup).toBeInstanceOf(THREE.Group);
  });

  it("group has children (bodyGroup is child)", () => {
    const { group, bodyGroup } = buildAirplane3DMesh();
    expect(group.children).toContain(bodyGroup);
  });

  it("bodyGroup has multiple children (fuselage, wings, etc.)", () => {
    const { bodyGroup } = buildAirplane3DMesh();
    expect(bodyGroup.children.length).toBeGreaterThan(5);
  });

  it("propeller is contained inside bodyGroup tree", () => {
    const { bodyGroup, propeller } = buildAirplane3DMesh();
    // propeller is a Group cast as Mesh; we check it's in the bodyGroup subtree
    let found = false;
    bodyGroup.traverse((obj) => {
      if (obj === (propeller as unknown as THREE.Object3D)) found = true;
    });
    expect(found).toBe(true);
  });

  it("does not throw on repeated creation", () => {
    expect(() => {
      for (let i = 0; i < 5; i++) {
        buildAirplane3DMesh();
      }
    }).not.toThrow();
  });

  it("each call returns a distinct group", () => {
    const a = buildAirplane3DMesh();
    const b = buildAirplane3DMesh();
    expect(a.group).not.toBe(b.group);
  });

  it("group position defaults to origin", () => {
    const { group } = buildAirplane3DMesh();
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(0);
    expect(group.position.z).toBe(0);
  });

  it("group rotation defaults to zero", () => {
    const { group } = buildAirplane3DMesh();
    expect(group.rotation.x).toBe(0);
    expect(group.rotation.y).toBe(0);
    expect(group.rotation.z).toBe(0);
  });

  it("mesh tree contains at least one Mesh instance", () => {
    const { group } = buildAirplane3DMesh();
    let meshCount = 0;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(0);
  });

  it("mesh tree contains at least 10 distinct Mesh instances (complex model)", () => {
    const { group } = buildAirplane3DMesh();
    const meshes: THREE.Mesh[] = [];
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshes.push(obj);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(10);
  });

  it("at least one mesh has castShadow = true", () => {
    const { group } = buildAirplane3DMesh();
    let shadowCaster = false;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.castShadow) shadowCaster = true;
    });
    expect(shadowCaster).toBe(true);
  });

  it("all materials are MeshLambertMaterial instances", () => {
    const { group } = buildAirplane3DMesh();
    let allLambert = true;
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material;
        if (!Array.isArray(mat) && !(mat instanceof THREE.MeshLambertMaterial)) {
          allLambert = false;
        }
      }
    });
    expect(allLambert).toBe(true);
  });
});

// ── buildAirstripMesh ──────────────────────────────────────────────────────────

describe("buildAirstripMesh", () => {
  it("returns a THREE.Group", () => {
    const strip = buildAirstripMesh();
    expect(strip).toBeInstanceOf(THREE.Group);
  });

  it("has multiple children (runway + markings)", () => {
    const strip = buildAirstripMesh();
    expect(strip.children.length).toBeGreaterThan(2);
  });

  it("contains at least one Mesh", () => {
    const strip = buildAirstripMesh();
    let meshCount = 0;
    strip.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(0);
  });

  it("position defaults to origin", () => {
    const strip = buildAirstripMesh();
    expect(strip.position.x).toBe(0);
    expect(strip.position.y).toBe(0);
    expect(strip.position.z).toBe(0);
  });

  it("does not throw on creation", () => {
    expect(() => buildAirstripMesh()).not.toThrow();
  });
});

// ── buildAirstripSignMesh ──────────────────────────────────────────────────────

describe("buildAirstripSignMesh", () => {
  it("returns a THREE.Group", () => {
    const sign = buildAirstripSignMesh();
    expect(sign).toBeInstanceOf(THREE.Group);
  });

  it("has multiple children (pole, board, arrow, etc.)", () => {
    const sign = buildAirstripSignMesh();
    expect(sign.children.length).toBeGreaterThan(2);
  });

  it("contains at least one Mesh", () => {
    const sign = buildAirstripSignMesh();
    let meshCount = 0;
    sign.traverse((obj) => {
      if (obj instanceof THREE.Mesh) meshCount++;
    });
    expect(meshCount).toBeGreaterThan(0);
  });

  it("does not throw on creation", () => {
    expect(() => buildAirstripSignMesh()).not.toThrow();
  });

  it("each call returns a distinct group", () => {
    const a = buildAirstripSignMesh();
    const b = buildAirstripSignMesh();
    expect(a).not.toBe(b);
  });

  it("position defaults to origin", () => {
    const sign = buildAirstripSignMesh();
    expect(sign.position.x).toBe(0);
    expect(sign.position.y).toBe(0);
    expect(sign.position.z).toBe(0);
  });
});

// ── AirplaneData type compatibility ───────────────────────────────────────────

describe("AirplaneData type", () => {
  it("can be constructed with all required fields (type check at runtime)", () => {
    const { group, propeller } = buildAirplane3DMesh();
    const ad: AirplaneData = {
      mesh: group,
      propeller,
      state: "idle",
      position: new THREE.Vector3(0, 10, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      pitch: 0,
      yaw: 0,
      roll: 0,
      speed: 0,
      groundY: 5,
      spawnX: 50,
      spawnZ: 20,
    };
    expect(ad.state).toBe("idle");
    expect(ad.speed).toBe(0);
  });

  it("supports all valid AirplaneState values", () => {
    const { group, propeller } = buildAirplane3DMesh();
    const base: Omit<AirplaneData, "state"> = {
      mesh: group, propeller,
      position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      pitch: 0, yaw: 0, roll: 0, speed: 0, groundY: 0, spawnX: 0, spawnZ: 0,
    };
    const states: AirplaneData["state"][] = ["idle", "boarded", "flying"];
    states.forEach((state) => {
      const ad: AirplaneData = { ...base, state };
      expect(ad.state).toBe(state);
    });
  });

  it("position is a mutable THREE.Vector3", () => {
    const { group, propeller } = buildAirplane3DMesh();
    const ad: AirplaneData = {
      mesh: group, propeller, state: "flying",
      position: new THREE.Vector3(1, 2, 3),
      velocity: new THREE.Vector3(),
      pitch: 0.1, yaw: 0.2, roll: 0.05,
      speed: 30, groundY: 5, spawnX: 50, spawnZ: 20,
    };
    ad.position.y += 10;
    expect(ad.position.y).toBe(12);
  });
});
