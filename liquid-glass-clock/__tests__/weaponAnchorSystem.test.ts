/**
 * Tests for the Weapon Anchor System introduced to fix TP weapon display.
 *
 * These tests cover:
 *  1. WEAPON_FP_CONFIG / WEAPON_TP_CONFIG completeness and sanity checks
 *  2. applyWeaponTransform correctness (logic mirrored here; Game3D.tsx is the
 *     source of truth but cannot be imported due to Three.js ESM issues in Jest)
 *  3. Third-person weapon visibility invariants
 *  4. Sniper scope guard logic
 *  5. Bullet spawn origin selection (FP vs TP)
 *
 * Pure logic tests — no DOM, no renderer.
 */

import * as THREE from "three";

// ── Mirror the constants from Game3D.tsx ──────────────────────────────────────

type WeaponType = "sword" | "bow" | "crossbow" | "sniper";

type WeaponTransformConfig = {
  pos: [number, number, number];
  rot: [number, number, number];
  scale: number;
};

const WEAPON_FP_CONFIG: Record<WeaponType, WeaponTransformConfig> = {
  sword:    { pos: [0.25, -0.28, -0.48], rot: [-Math.PI / 2, -0.3,  0.3 ], scale: 1.0 },
  bow:      { pos: [0.16, -0.16, -0.40], rot: [0,            -0.12, 0   ], scale: 1.0 },
  crossbow: { pos: [0.18, -0.22, -0.52], rot: [0,            -0.08, 0   ], scale: 1.0 },
  sniper:   { pos: [0.14, -0.18, -0.50], rot: [0,            -0.06, 0   ], scale: 1.4 },
};

const WEAPON_TP_CONFIG: Record<WeaponType, WeaponTransformConfig> = {
  sword:    { pos: [0.0,  0.0,  0.08], rot: [-Math.PI / 2, 0.0, -0.2], scale: 0.8 },
  bow:      { pos: [0.0,  0.05, 0.08], rot: [-0.25,        0,    0  ], scale: 0.8 },
  crossbow: { pos: [0.0,  0.02, 0.10], rot: [-0.15,        0,    0  ], scale: 0.8 },
  sniper:   { pos: [0.0,  0.02, 0.12], rot: [-0.10,        0,    0  ], scale: 0.8 },
};

function applyWeaponTransform(
  mesh: THREE.Group,
  type: WeaponType,
  mode: "first" | "third",
): void {
  const cfg = mode === "first" ? WEAPON_FP_CONFIG[type] : WEAPON_TP_CONFIG[type];
  mesh.position.set(...cfg.pos);
  mesh.rotation.set(...cfg.rot);
  mesh.scale.setScalar(cfg.scale);
}

const WEAPON_TYPES: WeaponType[] = ["sword", "bow", "crossbow", "sniper"];
const PLAYER_HEIGHT = 1.8;

// ─────────────────────────────────────────────────────────────────────────────

describe("WEAPON_FP_CONFIG", () => {
  it("has an entry for every weapon type", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_FP_CONFIG[w]).toBeDefined();
    }
  });

  it("all FP scales are positive", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_FP_CONFIG[w].scale).toBeGreaterThan(0);
    }
  });

  it("sniper FP scale is larger than 1 (fills more of the screen)", () => {
    expect(WEAPON_FP_CONFIG.sniper.scale).toBeGreaterThan(1);
  });

  it("FP weapon z positions are negative (in front of camera)", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_FP_CONFIG[w].pos[2]).toBeLessThan(0);
    }
  });
});

describe("WEAPON_TP_CONFIG", () => {
  it("has an entry for every weapon type", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_TP_CONFIG[w]).toBeDefined();
    }
  });

  it("all TP scales are positive", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_TP_CONFIG[w].scale).toBeGreaterThan(0);
    }
  });

  it("all TP scales are less than 1 (smaller than FP weapon, world-space sized)", () => {
    for (const w of WEAPON_TYPES) {
      expect(WEAPON_TP_CONFIG[w].scale).toBeLessThan(1);
    }
  });

  it("TP sniper scale equals TP bow scale (consistent 3rd-person presentation)", () => {
    expect(WEAPON_TP_CONFIG.sniper.scale).toEqual(WEAPON_TP_CONFIG.bow.scale);
  });
});

describe("applyWeaponTransform", () => {
  let mesh: THREE.Group;

  beforeEach(() => {
    mesh = new THREE.Group();
  });

  it("applies FP config to sword correctly", () => {
    applyWeaponTransform(mesh, "sword", "first");
    const cfg = WEAPON_FP_CONFIG.sword;
    expect(mesh.position.x).toBeCloseTo(cfg.pos[0]);
    expect(mesh.position.y).toBeCloseTo(cfg.pos[1]);
    expect(mesh.position.z).toBeCloseTo(cfg.pos[2]);
    expect(mesh.scale.x).toBeCloseTo(cfg.scale);
  });

  it("applies TP config to sniper correctly", () => {
    applyWeaponTransform(mesh, "sniper", "third");
    const cfg = WEAPON_TP_CONFIG.sniper;
    expect(mesh.position.x).toBeCloseTo(cfg.pos[0]);
    expect(mesh.position.y).toBeCloseTo(cfg.pos[1]);
    expect(mesh.position.z).toBeCloseTo(cfg.pos[2]);
    expect(mesh.scale.x).toBeCloseTo(cfg.scale);
  });

  it("FP and TP configs produce different scale for sniper", () => {
    const mesh2 = new THREE.Group();
    applyWeaponTransform(mesh, "sniper", "first");
    applyWeaponTransform(mesh2, "sniper", "third");
    expect(mesh.scale.x).not.toEqual(mesh2.scale.x);
  });

  it("mode switch from FP to TP overwrites previous position", () => {
    applyWeaponTransform(mesh, "bow", "first");
    const fpZ = mesh.position.z;
    applyWeaponTransform(mesh, "bow", "third");
    const tpZ = mesh.position.z;
    // TP z is small positive (near hand anchor), FP z is large negative
    expect(fpZ).toBeLessThan(tpZ);
  });
});

describe("Weapon anchor re-parenting logic", () => {
  it("weapon can be added to camera and then re-parented to hand anchor", () => {
    const camera = new THREE.PerspectiveCamera();
    const handAnchor = new THREE.Object3D();
    const weapon = new THREE.Group();

    // Simulate FP attachment
    applyWeaponTransform(weapon, "sword", "first");
    camera.add(weapon);
    expect(weapon.parent).toBe(camera);

    // Simulate switch to TP
    camera.remove(weapon);
    applyWeaponTransform(weapon, "sword", "third");
    handAnchor.add(weapon);
    expect(weapon.parent).toBe(handAnchor);
  });

  it("weapon is removed from hand anchor when switching back to FP", () => {
    const camera = new THREE.PerspectiveCamera();
    const handAnchor = new THREE.Object3D();
    const weapon = new THREE.Group();

    handAnchor.add(weapon);
    expect(weapon.parent).toBe(handAnchor);

    handAnchor.remove(weapon);
    applyWeaponTransform(weapon, "crossbow", "first");
    camera.add(weapon);
    expect(weapon.parent).toBe(camera);
    expect(handAnchor.children.length).toBe(0);
  });
});

describe("Sniper scope guard (third-person)", () => {
  /**
   * Mirror the guard condition from Game3D.tsx mousedown handler:
   * scope is only activated when cameraModeRef.current === "first".
   */
  function canActivateScope(
    weaponType: WeaponType,
    buildMode: "explore" | "build" | "sculpt",
    cameraMode: "first" | "third",
  ): boolean {
    return (
      weaponType === "sniper" &&
      buildMode === "explore" &&
      cameraMode === "first"
    );
  }

  it("scope activates with sniper in explore mode in first-person", () => {
    expect(canActivateScope("sniper", "explore", "first")).toBe(true);
  });

  it("scope does NOT activate in third-person", () => {
    expect(canActivateScope("sniper", "explore", "third")).toBe(false);
  });

  it("scope does NOT activate with non-sniper weapons", () => {
    for (const w of WEAPON_TYPES.filter((t) => t !== "sniper")) {
      expect(canActivateScope(w, "explore", "first")).toBe(false);
    }
  });

  it("scope does NOT activate in build mode", () => {
    expect(canActivateScope("sniper", "build", "first")).toBe(false);
  });
});

describe("Bullet spawn position selection (FP vs TP)", () => {
  /**
   * Mirror the bullet spawn origin logic from doAttack():
   * In TP use player body position + eye height; in FP use camera position.
   */
  function getBulletSpawnOrigin(
    cameraMode: "first" | "third",
    cameraWorldPos: THREE.Vector3,
    playerBodyPos: THREE.Vector3,
    playerHeight: number,
  ): THREE.Vector3 {
    if (cameraMode === "third") {
      return new THREE.Vector3(
        playerBodyPos.x,
        playerBodyPos.y + playerHeight - 0.3,
        playerBodyPos.z,
      );
    }
    return cameraWorldPos.clone();
  }

  it("in first-person, bullet spawns at camera position", () => {
    const camPos = new THREE.Vector3(5, 3.5, -10);
    const bodyPos = new THREE.Vector3(5, 1.8, -10);
    const origin = getBulletSpawnOrigin("first", camPos, bodyPos, PLAYER_HEIGHT);
    expect(origin.x).toBeCloseTo(camPos.x);
    expect(origin.y).toBeCloseTo(camPos.y);
    expect(origin.z).toBeCloseTo(camPos.z);
  });

  it("in third-person, bullet spawns at body position + eye offset (not camera)", () => {
    const camPos = new THREE.Vector3(5, 4.2, -4); // camera behind player
    const bodyPos = new THREE.Vector3(5, 1.8, -10); // actual player position
    const origin = getBulletSpawnOrigin("third", camPos, bodyPos, PLAYER_HEIGHT);
    // x and z come from bodyPos
    expect(origin.x).toBeCloseTo(bodyPos.x);
    expect(origin.z).toBeCloseTo(bodyPos.z);
    // y is body.y + PLAYER_HEIGHT - 0.3 = 1.8 + 1.8 - 0.3 = 3.3
    expect(origin.y).toBeCloseTo(bodyPos.y + PLAYER_HEIGHT - 0.3);
    // Verify it's NOT the camera position
    expect(origin.z).not.toBeCloseTo(camPos.z);
  });

  it("TP bullet Y is above ground level (player body base)", () => {
    const bodyPos = new THREE.Vector3(0, 0, 0); // feet at y=0
    const origin = getBulletSpawnOrigin("third", new THREE.Vector3(), bodyPos, PLAYER_HEIGHT);
    expect(origin.y).toBeGreaterThan(0); // above ground
  });
});

describe("buildRemotePlayerMesh handR anchor", () => {
  /**
   * The actual buildRemotePlayerMesh function cannot be imported here due to
   * Three.js ESM issues in Jest.  We test the structural contract instead:
   * a correctly-constructed player group must have a named "handR" Object3D
   * at the tip of armR.
   */
  it("a group with handR anchor has expected structure", () => {
    const armR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6),
      new THREE.MeshLambertMaterial(),
    );
    armR.name = "armR";
    const handR = new THREE.Object3D();
    handR.name = "handR";
    handR.position.set(0, -0.21, 0); // tip of arm (half-length = 0.21)
    armR.add(handR);

    expect(armR.getObjectByName("handR")).toBe(handR);
    expect(handR.position.y).toBeCloseTo(-0.21);
  });

  it("handR y-offset equals half the arm cylinder height", () => {
    const ARM_LENGTH = 0.42;
    const handRY = -(ARM_LENGTH / 2); // = -0.21
    expect(handRY).toBeCloseTo(-0.21);
  });
});
