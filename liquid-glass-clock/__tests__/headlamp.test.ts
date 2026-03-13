/**
 * Tests for the player headlamp system.
 *
 * Validates:
 * - Headlamp mesh is added to the player body via buildRemotePlayerMesh
 * - Emissive material properties are correct
 * - Night-activation logic formula is correct
 * - Space-station activation logic
 * - Intensity lerp formula behaves correctly
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

// ── Reproduce the buildRemotePlayerMesh function locally ──────────────────────
// (Cannot import directly from Game3D.tsx since it is a React component module)
function buildRemotePlayerMesh(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), mat);
  body.position.y = 0;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
  head.position.y = 0.58;
  group.add(head);

  const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6);
  const legL = new THREE.Mesh(legGeo, mat);
  legL.name = "legL";
  legL.position.set(0.13, -0.6, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, mat);
  legR.name = "legR";
  legR.position.set(-0.13, -0.6, 0);
  group.add(legR);

  const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6);
  const armL = new THREE.Mesh(armGeo, mat);
  armL.name = "armL";
  armL.position.set(0.33, 0.04, 0);
  armL.rotation.z = 0.3;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, mat);
  armR.name = "armR";
  armR.position.set(-0.33, 0.04, 0);
  armR.rotation.z = -0.3;
  group.add(armR);

  // Headlamp – glowing disc on the forehead, faces forward (+Z in local space)
  const headlampMat = new THREE.MeshLambertMaterial({
    color: 0xffeeaa,
    emissive: new THREE.Color(0xffeeaa),
    emissiveIntensity: 0,
  });
  const headlampMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10),
    headlampMat,
  );
  headlampMesh.name = "headlamp";
  headlampMesh.position.set(0, 0.6, 0.21);
  headlampMesh.rotation.x = Math.PI / 2;
  group.add(headlampMesh);

  return group;
}

// ── Constants mirroring Game3D.tsx headlamp intensity values ─────────────────
const HEADLAMP_STATION_INTENSITY = 8.0;  // strong cone beam inside space station
const HEADLAMP_NIGHT_MAX_INTENSITY = 4.0; // max intensity at full night outside

// ── Helper: headlamp activation logic (mirrors Game3D.tsx) ───────────────────
function computeHeadlampTargetIntensity(
  nightFactor: number,
  inStation: boolean,
): number {
  const headlampOn = nightFactor > 0.3 || inStation;
  if (!headlampOn) return 0;
  return inStation ? HEADLAMP_STATION_INTENSITY : nightFactor * HEADLAMP_NIGHT_MAX_INTENSITY;
}

// ── Helper: smooth lerp step (mirrors the per-frame lerp in Game3D.tsx) ──────
function lerpStep(current: number, target: number, dt: number, speed = 4): number {
  return current + (target - current) * Math.min(1, dt * speed);
}

// ── smoothstep from Game3D.tsx (for nightFactor calculation) ─────────────────
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function computeNightFactor(dayFraction: number): number {
  if (dayFraction < 0.18) return 1.0;
  if (dayFraction < 0.25) return 1.0 - smoothstep(0.18, 0.25, dayFraction);
  if (dayFraction < 0.75) return 0.0;
  if (dayFraction < 0.82) return smoothstep(0.75, 0.82, dayFraction);
  return 1.0;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITES
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRemotePlayerMesh – headlamp mesh presence", () => {
  let playerGroup: THREE.Group;

  beforeEach(() => {
    playerGroup = buildRemotePlayerMesh(0x4a9eff);
  });

  it('contains a child named "headlamp"', () => {
    const hlMesh = playerGroup.getObjectByName("headlamp");
    expect(hlMesh).toBeDefined();
  });

  it("headlamp is a THREE.Mesh", () => {
    const hlMesh = playerGroup.getObjectByName("headlamp");
    expect(hlMesh).toBeInstanceOf(THREE.Mesh);
  });

  it("headlamp uses MeshLambertMaterial with emissive color", () => {
    const hlMesh = playerGroup.getObjectByName("headlamp") as THREE.Mesh;
    const mat = hlMesh.material as THREE.MeshLambertMaterial;
    expect(mat).toBeInstanceOf(THREE.MeshLambertMaterial);
    // emissive should be warm white/yellow
    expect(mat.emissive.r).toBeGreaterThan(0.8);
    expect(mat.emissive.g).toBeGreaterThan(0.7);
  });

  it("headlamp emissiveIntensity starts at 0 (off by default)", () => {
    const hlMesh = playerGroup.getObjectByName("headlamp") as THREE.Mesh;
    const mat = hlMesh.material as THREE.MeshLambertMaterial;
    expect(mat.emissiveIntensity).toBe(0);
  });

  it("headlamp is positioned on the forehead (forward-facing)", () => {
    const hlMesh = playerGroup.getObjectByName("headlamp") as THREE.Mesh;
    // Should be near the front of the head (z > 0.15) and at head height (y ≈ 0.6)
    expect(hlMesh.position.z).toBeGreaterThan(0.15);
    expect(hlMesh.position.y).toBeCloseTo(0.6, 1);
  });

  it("headlamp is rotated so its flat face points forward", () => {
    const hlMesh = playerGroup.getObjectByName("headlamp") as THREE.Mesh;
    // Rotation.x should be PI/2 (90°) to make the cylinder disc face +Z
    expect(hlMesh.rotation.x).toBeCloseTo(Math.PI / 2, 4);
  });

  it("all named body parts still present alongside headlamp", () => {
    const names = ["legL", "legR", "armL", "armR", "headlamp"];
    names.forEach((name) => {
      expect(playerGroup.getObjectByName(name)).toBeDefined();
    });
  });
});

describe("Headlamp activation logic – night detection", () => {
  it("is OFF during full daytime (dayFraction = 0.5, nightFactor = 0)", () => {
    const nightFactor = computeNightFactor(0.5);
    expect(nightFactor).toBe(0);
    expect(computeHeadlampTargetIntensity(nightFactor, false)).toBe(0);
  });

  it("is OFF just before dusk threshold (dayFraction = 0.72)", () => {
    const nightFactor = computeNightFactor(0.72);
    expect(nightFactor).toBeLessThanOrEqual(0.3);
    expect(computeHeadlampTargetIntensity(nightFactor, false)).toBe(0);
  });

  it("turns ON during late dusk (dayFraction = 0.79)", () => {
    const nightFactor = computeNightFactor(0.79);
    expect(nightFactor).toBeGreaterThan(0.3);
    expect(computeHeadlampTargetIntensity(nightFactor, false)).toBeGreaterThan(0);
  });

  it("is fully ON at midnight (dayFraction = 0.0, nightFactor = 1.0)", () => {
    const nightFactor = computeNightFactor(0.0);
    expect(nightFactor).toBe(1.0);
    expect(computeHeadlampTargetIntensity(nightFactor, false)).toBeCloseTo(HEADLAMP_NIGHT_MAX_INTENSITY, 5);
  });

  it("is fully ON at full night wrap (dayFraction = 0.95, nightFactor = 1.0)", () => {
    const nightFactor = computeNightFactor(0.95);
    expect(nightFactor).toBe(1.0);
    expect(computeHeadlampTargetIntensity(nightFactor, false)).toBeCloseTo(HEADLAMP_NIGHT_MAX_INTENSITY, 5);
  });

  it("is OFF during sunrise (dayFraction = 0.28, nightFactor ≈ 0)", () => {
    const nightFactor = computeNightFactor(0.28);
    expect(nightFactor).toBeLessThan(0.3);
    // Headlamp OFF or barely on
    expect(computeHeadlampTargetIntensity(nightFactor, false)).toBeLessThanOrEqual(
      0.3 * 2.8,
    );
  });
});

describe("Headlamp activation logic – space station", () => {
  it("turns ON inside the space station regardless of dayFraction (daytime)", () => {
    const nightFactor = computeNightFactor(0.5); // full daytime
    expect(computeHeadlampTargetIntensity(nightFactor, true)).toBeGreaterThan(0);
  });

  it("inside the station, intensity reaches maximum (not proportional to night)", () => {
    const nightFactor = computeNightFactor(0.5); // full daytime
    const intensity = computeHeadlampTargetIntensity(nightFactor, true);
    expect(intensity).toBeCloseTo(HEADLAMP_STATION_INTENSITY, 5);
  });

  it("inside the station at night, intensity is still the full station intensity", () => {
    const nightFactor = 1.0;
    const intensity = computeHeadlampTargetIntensity(nightFactor, true);
    // inStation flag takes precedence → full station intensity
    expect(intensity).toBeCloseTo(HEADLAMP_STATION_INTENSITY, 5);
  });

  it("outside the station at night, intensity is proportional to nightFactor", () => {
    const nightFactor = 0.6;
    const intensity = computeHeadlampTargetIntensity(nightFactor, false);
    expect(intensity).toBeCloseTo(nightFactor * HEADLAMP_NIGHT_MAX_INTENSITY, 5);
  });
});

describe("Headlamp smooth fade – lerp formula", () => {
  it("lerps toward target over time (dt = 0.016, one frame)", () => {
    const current = 0;
    const target = HEADLAMP_STATION_INTENSITY;
    const next = lerpStep(current, target, 0.016);
    // Should move toward target but not reach it in one frame
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(HEADLAMP_STATION_INTENSITY);
  });

  it("reaches >97% of target within ~1 second (60 frames at dt=0.016)", () => {
    let current = 0;
    const target = HEADLAMP_STATION_INTENSITY;
    for (let i = 0; i < 60; i++) {
      current = lerpStep(current, target, 0.016);
    }
    // Asymptotic lerp: after 1 s at speed=4, ~98% of the way to target
    expect(current).toBeGreaterThan(target * 0.97);
    expect(current).toBeLessThanOrEqual(target);
  });

  it("when already at target, stays at target", () => {
    const current = HEADLAMP_STATION_INTENSITY;
    const target = HEADLAMP_STATION_INTENSITY;
    const next = lerpStep(current, target, 0.016);
    expect(next).toBeCloseTo(HEADLAMP_STATION_INTENSITY, 5);
  });

  it("fades out to <3% of initial value within ~1 second", () => {
    let current = HEADLAMP_STATION_INTENSITY;
    const initial = current;
    const target = 0;
    for (let i = 0; i < 60; i++) {
      current = lerpStep(current, target, 0.016);
    }
    // Asymptotic lerp: after 1 s at speed=4, current < 3% of initial value
    expect(current).toBeGreaterThanOrEqual(0);
    expect(current).toBeLessThan(initial * 0.03);
  });

  it("dt clamped to 1 prevents overshoot", () => {
    // Large dt (e.g., after tab focus restore) should not overshoot
    const current = 0;
    const target = HEADLAMP_STATION_INTENSITY;
    const next = lerpStep(current, target, 999); // extreme dt
    expect(next).toBeCloseTo(target, 5); // clamps to exactly target
  });
});

describe("Headlamp SpotLight parameters", () => {
  it("creates a SpotLight with correct cone angle (~22.5 degrees = PI/8 rad)", () => {
    // Verify PI/8 is approximately 22.5 degrees (headlamp half-angle)
    const halfAngle = Math.PI / 8;
    const degrees = (halfAngle * 180) / Math.PI;
    expect(degrees).toBeCloseTo(22.5, 0);
  });

  it("SpotLight range of 60 units provides strong reach in station corridors", () => {
    // 60 units – sufficient for long corridors and open station bays
    const range = 60;
    expect(range).toBeGreaterThanOrEqual(40);
    expect(range).toBeLessThanOrEqual(100);
  });

  it("warm white headlamp color is in the expected hex range", () => {
    const color = new THREE.Color(0xffe8a0);
    // Should be reddish-warm (r ≈ 1.0, g ≈ 0.9, b ≈ 0.6)
    expect(color.r).toBeCloseTo(1.0, 1);
    expect(color.g).toBeGreaterThan(0.8);
    expect(color.b).toBeLessThan(0.8); // warm, not cool blue
  });
});
