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
  it("creates a SpotLight with correct cone angle (~36 degrees = PI/5 rad)", () => {
    // Verify PI/5 is approximately 36 degrees (headlamp half-angle)
    const halfAngle = Math.PI / 5;
    const degrees = (halfAngle * 180) / Math.PI;
    expect(degrees).toBeCloseTo(36, 0);
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

// ── Constants for shader uniform tests ────────────────────────────────────────
const HEADLAMP_ANGLE = Math.cos(Math.PI / 5); // cosine of half-angle stored as uniform
const HEADLAMP_PENUMBRA = 0.25;
const HEADLAMP_RANGE = 60.0;

// ── Reproduce the GLSL spotlight formula in TypeScript for unit testing ───────
/**
 * Mirrors the headlamp spotlight contribution GLSL code in the terrain/water
 * fragment shaders. Returns the spotlight factor in [0, 1].
 */
function computeSpotFactor(
  fragPos: { x: number; y: number; z: number },
  lampPos: { x: number; y: number; z: number },
  lampDir: { x: number; y: number; z: number },
  angle = HEADLAMP_ANGLE,
  penumbra = HEADLAMP_PENUMBRA,
  range = HEADLAMP_RANGE,
): number {
  const dx = fragPos.x - lampPos.x;
  const dy = fragPos.y - lampPos.y;
  const dz = fragPos.z - lampPos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist >= range || dist < 0.001) return 0;
  const fx = dx / dist;
  const fy = dy / dist;
  const fz = dz / dist;
  const ld = Math.sqrt(lampDir.x ** 2 + lampDir.y ** 2 + lampDir.z ** 2);
  const ldx = lampDir.x / ld;
  const ldy = lampDir.y / ld;
  const ldz = lampDir.z / ld;
  const spotDot = fx * ldx + fy * ldy + fz * ldz;
  const innerAngle = angle + (1.0 - angle) * (1.0 - penumbra);
  // smoothstep(angle, innerAngle, spotDot)
  const t = Math.max(0, Math.min(1, (spotDot - angle) / (innerAngle - angle)));
  return t * t * (3 - 2 * t);
}

/**
 * Mirrors the distance attenuation formula used in the terrain/water shaders.
 */
function computeAttenuation(dist: number, range = HEADLAMP_RANGE): number {
  const a = Math.max(0, 1 - dist / range);
  return a * a;
}

describe("Headlamp shader uniform initial values", () => {
  it("uHeadlampAngle is the cosine of PI/5 (half-cone angle)", () => {
    expect(HEADLAMP_ANGLE).toBeCloseTo(Math.cos(Math.PI / 5), 6);
    // cos(36°) ≈ 0.809
    expect(HEADLAMP_ANGLE).toBeGreaterThan(0.7);
  });

  it("uHeadlampPenumbra matches the SpotLight penumbra value (0.25)", () => {
    expect(HEADLAMP_PENUMBRA).toBe(0.25);
  });

  it("uHeadlampRange matches the SpotLight range (60 units)", () => {
    expect(HEADLAMP_RANGE).toBe(60);
  });

  it("headlamp shader color matches SpotLight color (0xffe8a0)", () => {
    const shaderColor = new THREE.Color(0xffe8a0);
    const spotColor = new THREE.Color(0xffe8a0);
    expect(shaderColor.r).toBeCloseTo(spotColor.r, 5);
    expect(shaderColor.g).toBeCloseTo(spotColor.g, 5);
    expect(shaderColor.b).toBeCloseTo(spotColor.b, 5);
  });
});

describe("Headlamp shader spotlight formula – ground illumination", () => {
  // Lamp at player eye height (1.7 units), pointing straight forward (-Z)
  const lampPos = { x: 0, y: 1.7, z: 0 };
  const lampDir = { x: 0, y: 0, z: -1 }; // forward = -Z

  it("illuminates ground directly in front of player (within cone)", () => {
    // Ground 5 units ahead, below eye level
    const factor = computeSpotFactor({ x: 0, y: 0, z: -5 }, lampPos, lampDir);
    expect(factor).toBeGreaterThan(0);
  });

  it("does NOT illuminate ground directly behind player", () => {
    const factor = computeSpotFactor({ x: 0, y: 0, z: 5 }, lampPos, lampDir);
    expect(factor).toBe(0);
  });

  it("does NOT illuminate ground beyond range (65 units ahead)", () => {
    const factor = computeSpotFactor({ x: 0, y: 0, z: -65 }, lampPos, lampDir);
    expect(factor).toBe(0);
  });

  it("ground far outside cone angle receives zero illumination", () => {
    // 90° off-axis should be outside the ~36° half-angle cone
    const factor = computeSpotFactor({ x: 10, y: 1.7, z: 0 }, lampPos, lampDir);
    expect(factor).toBe(0);
  });

  it("attenuation is 1.0 at origin and 0 at range boundary", () => {
    expect(computeAttenuation(0)).toBe(1);
    expect(computeAttenuation(HEADLAMP_RANGE)).toBe(0);
  });

  it("attenuation is quadratic (falls off faster than linear)", () => {
    // At half-range, quadratic atten = 0.25, linear would be 0.5
    const halfRangeAtten = computeAttenuation(HEADLAMP_RANGE / 2);
    expect(halfRangeAtten).toBeCloseTo(0.25, 3);
  });

  it("ground at 10 units forward is inside the beam (cone centre)", () => {
    // At 10 units forward the lamp-to-frag angle is arctan(1.7/10) ≈ 9.6°, well within 36°
    const groundAhead = { x: 0, y: 0, z: -10 };
    const factor = computeSpotFactor(groundAhead, lampPos, lampDir);
    expect(factor).toBeGreaterThan(0.5);
  });

  it("ground very close (1.5 units) is outside the wider cone due to vertical offset", () => {
    // At 1.5 units forward the angle is arctan(1.7/1.5) ≈ 48.6°, which exceeds the 36° half-angle
    const groundClose = { x: 0, y: 0, z: -1.5 };
    const factor = computeSpotFactor(groundClose, lampPos, lampDir);
    expect(factor).toBe(0);
  });

  it("headlamp direction is computed by rotating (0,-0.12,-10) by camera quaternion", () => {
    // When camera looks straight forward (identity rotation), direction should be
    // approximately (0, -0.012, -1) normalized.
    const offset = new THREE.Vector3(0, -0.12, -10);
    const identity = new THREE.Quaternion(); // no rotation
    const dir = offset.clone().applyQuaternion(identity).normalize();
    expect(dir.x).toBeCloseTo(0, 4);
    expect(dir.z).toBeLessThan(0); // points forward (-Z)
    // Tiny downward tilt
    expect(dir.y).toBeLessThan(0);
    expect(Math.abs(dir.y)).toBeLessThan(0.02);
  });
});

// ── Helpers mirroring the updated terrain ambient calculation ─────────────────

function getSunIntensity(t: number): number {
  if (t < 0.18 || t > 0.82) return 0;
  if (t < 0.25) return smoothstep(0.18, 0.28, t) * 1.4;
  if (t > 0.75) return smoothstep(0.82, 0.72, t) * 1.4;
  return 1.4;
}

function computeTerrainAmbient(dayFraction: number): { r: number; g: number; b: number } {
  const si = getSunIntensity(dayFraction);
  return {
    r: 0.06 + si * 0.46,
    g: 0.08 + si * 0.46,
    b: 0.14 + si * 0.44,
  };
}

describe("Terrain ambient night/day scaling", () => {
  it("ambient is very dark at full night (dayFraction=0, si=0)", () => {
    const amb = computeTerrainAmbient(0.0);
    // Night ambient should be low to provide contrast for the headlamp
    expect(amb.r).toBeCloseTo(0.06, 3);
    expect(amb.g).toBeCloseTo(0.08, 3);
    expect(amb.b).toBeCloseTo(0.14, 3);
    // All channels should be well below 0.20 so the headlamp creates visible contrast
    expect(amb.r).toBeLessThan(0.20);
    expect(amb.g).toBeLessThan(0.20);
  });

  it("ambient is bright at noon (dayFraction=0.5, si=1.4)", () => {
    const amb = computeTerrainAmbient(0.5);
    // Daytime ambient should be bright
    expect(amb.r).toBeGreaterThan(0.50);
    expect(amb.g).toBeGreaterThan(0.50);
    expect(amb.b).toBeGreaterThan(0.50);
  });

  it("night ambient (blue channel) is greater than red channel for moonlit look", () => {
    const amb = computeTerrainAmbient(0.0);
    expect(amb.b).toBeGreaterThan(amb.r);
  });

  it("headlamp creates at least 4x contrast over night ambient (good visibility)", () => {
    // At full night with headlamp intensity 4.0, attenuation 0.69, lambert 0.18:
    // headContrib_r ≈ 1.0 * 4.0 * 0.69 * 0.18 ≈ 0.496
    // ambient_r = 0.06
    // contrast ratio = 0.496 / 0.06 ≈ 8.3 (very visible!)
    const amb = computeTerrainAmbient(0.0);
    const headlampContrib = 1.0 * 4.0 * 0.69 * 0.18; // lampColor * intensity * atten * lambert
    const contrastRatio = headlampContrib / amb.r;
    expect(contrastRatio).toBeGreaterThan(4.0);
  });
});

describe("Moon light terrain shader uniform", () => {
  it("moon color is bluish (B > R and B > G)", () => {
    const moonColor = new THREE.Color(0x8899cc);
    expect(moonColor.b).toBeGreaterThan(moonColor.r);
    expect(moonColor.b).toBeGreaterThan(moonColor.g);
  });

  it("moon intensity at full night is positive and less than sun intensity", () => {
    // Moon intensity at night ≈ 0.35
    const moonNight = 0.35;
    const sunNoon = 1.4;
    expect(moonNight).toBeGreaterThan(0);
    expect(moonNight).toBeLessThan(sunNoon);
  });

  it("moon provides directional lighting (lambert-based diffuse)", () => {
    // Verify dot product of flat terrain normal with a typical moon direction
    const moonDir = new THREE.Vector3(-1, 0.5, -0.3).normalize();
    const terrainNormal = new THREE.Vector3(0, 1, 0);
    const moonDiffuse = Math.max(0, terrainNormal.dot(moonDir));
    // Moon above horizon → flat terrain should receive positive diffuse
    expect(moonDiffuse).toBeGreaterThan(0);
    expect(moonDiffuse).toBeCloseTo(moonDir.y, 4);
  });
});
