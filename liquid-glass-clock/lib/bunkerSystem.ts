/**
 * bunkerSystem.ts
 *
 * Shipping container underground bunker system.
 * Each bunker has:
 *  - An exterior entrance mesh (partially buried container top + hatch)
 *  - A shared interior lab scene (3 containers: entry, lab, server room)
 *
 * Integration pattern mirrors the Space Station: the interior group lives at
 * BUNKER_INTERIOR_WORLD_Y (far above Earth), earthGroup is toggled invisible
 * on entry, bunker group is toggled visible.
 */

import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Radius around the hatch centre within which [E] prompt appears. */
export const BUNKER_ENTRY_RADIUS = 5.0;

/** Radius around the exit ladder within which [E] exit prompt appears. */
export const BUNKER_EXIT_RADIUS = 3.0;

/**
 * World-space Y at which the bunker interior group is placed.
 * Must be far above the exterior world so fog hides it completely.
 */
export const BUNKER_INTERIOR_WORLD_Y = 1500;
export const BUNKER_INTERIOR_WORLD_X = 0;
export const BUNKER_INTERIOR_WORLD_Z = 0;

/** Container interior dimensions (game units ≈ metres). */
const CONTAINER_W = 5;      // interior width
const CONTAINER_H = 2.8;    // interior height
const CONTAINER_L = 12;     // interior length per container
const WALL_T = 0.18;        // wall thickness

/** How many containers are in the bunker. */
const NUM_CONTAINERS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BunkerConfig {
  id: string;
  /** World X position of the bunker hatch. */
  worldX: number;
  /** World Z position of the bunker hatch. */
  worldZ: number;
  /** Y rotation of the exterior group (so hatches face different directions). */
  rotation: number;
  /** Display name shown in UI. */
  name: string;
}

export interface BunkerInteriorResult {
  group: THREE.Group;
  /** Walkable AABB rooms (local coords, relative to group origin). */
  rooms: THREE.Box3[];
  /** Point lights with flicker metadata. */
  lights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number }>;
  /** Animated meshes (monitors, servers). */
  animatedMeshes: Array<{ mesh: THREE.Mesh; type: "monitor" | "server_led" | "vent" }>;
  /** Local-space position of the exit ladder (where exit prompt appears). */
  exitLocalPos: THREE.Vector3;
}

// ─── World Positions ──────────────────────────────────────────────────────────

/**
 * Fixed world positions for all three bunker entrances.
 * Placed on open land, away from major landmarks.
 */
export const BUNKER_CONFIGS: BunkerConfig[] = [
  { id: "bunker-alpha",  worldX:  95,  worldZ: -55, rotation: 0.4,  name: "Alfa"  },
  { id: "bunker-beta",   worldX: -35,  worldZ:  25, rotation: -0.6, name: "Beta"  },
  { id: "bunker-gamma",  worldX:  15,  worldZ: 110, rotation: 1.1,  name: "Gamma" },
];

// ─── Exterior Mesh ────────────────────────────────────────────────────────────

/**
 * Builds the above-ground entrance for a shipping container bunker.
 * The mesh is placed at world position; caller sets .position.set(x, groundY, z).
 */
export function buildBunkerExteriorMesh(_config: BunkerConfig): THREE.Group {
  const group = new THREE.Group();

  // ── Materials ──────────────────────────────────────────────────────────────
  const metalMat = new THREE.MeshPhongMaterial({ color: 0x4a5a4a });
  const rustMat  = new THREE.MeshPhongMaterial({ color: 0x6b4030 });
  const hatchMat = new THREE.MeshPhongMaterial({ color: 0x2a3a2a, shininess: 60 });
  const warnMat  = new THREE.MeshPhongMaterial({ color: 0xffc107 }); // warning yellow
  const dirtMat  = new THREE.MeshPhongMaterial({ color: 0x5a4030 });
  const ladderMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 40 });

  // ── Dirt mound (IcosahedronGeometry scaled flat to simulate raised earth) ──
  const moundGeo = new THREE.IcosahedronGeometry(3.5, 1);
  const moundMesh = new THREE.Mesh(moundGeo, dirtMat);
  moundMesh.scale.set(1, 0.5, 1);
  moundMesh.position.set(0, 0.15, 0);
  moundMesh.receiveShadow = true;
  group.add(moundMesh);

  // ── Container top (visible corrugated metal slab) ──────────────────────────
  // Container raised well above ground so it is clearly visible.
  // Y=0.8 means the top face is at ~1.0 above groundY.
  const SLAB_Y = 0.8;
  const topGeo = new THREE.BoxGeometry(4.8, 0.38, 5.5);
  const topMesh = new THREE.Mesh(topGeo, metalMat);
  topMesh.position.set(0, SLAB_Y, 0.3);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;
  group.add(topMesh);

  // Corrugation ridges on top (5 thin strips across width)
  for (let i = 0; i < 5; i++) {
    const ridgeGeo = new THREE.BoxGeometry(4.8, 0.06, 0.12);
    const ridge = new THREE.Mesh(ridgeGeo, metalMat);
    ridge.position.set(0, SLAB_Y + 0.22, -2.2 + i * 1.1);
    group.add(ridge);
  }

  // ── Corner posts (4 corners of the container top) ─────────────────────────
  const postGeo = new THREE.BoxGeometry(0.2, SLAB_Y + 0.6, 0.2);
  const corners = [
    [-2.3, -2.5], [-2.3, 2.8], [2.3, -2.5], [2.3, 2.8],
  ] as [number, number][];
  corners.forEach(([px, pz]) => {
    const post = new THREE.Mesh(postGeo, rustMat);
    post.position.set(px, (SLAB_Y + 0.6) / 2, pz);
    group.add(post);
  });

  // ── Hatch / access door ────────────────────────────────────────────────────
  const HATCH_Y = SLAB_Y + 0.20;
  const hatchFrameGeo = new THREE.BoxGeometry(1.5, 0.06, 1.1);
  const hatchFrame = new THREE.Mesh(hatchFrameGeo, rustMat);
  hatchFrame.position.set(0, HATCH_Y, -0.8);
  group.add(hatchFrame);

  // The actual hatch door (slightly ajar — open look)
  const hatchDoorGeo = new THREE.BoxGeometry(1.38, 0.06, 1.0);
  const hatchDoor = new THREE.Mesh(hatchDoorGeo, hatchMat);
  hatchDoor.rotation.x = -0.35;
  hatchDoor.position.set(0, HATCH_Y + 0.10, -0.65);
  group.add(hatchDoor);

  // Hatch handle (small cylinder)
  const handleGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6);
  const handle = new THREE.Mesh(handleGeo, ladderMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, HATCH_Y + 0.13, -0.45);
  group.add(handle);

  // ── Warning stripes around hatch ──────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const stripeGeo = new THREE.BoxGeometry(1.5, 0.04, 0.09);
    const stripe = new THREE.Mesh(stripeGeo, warnMat);
    stripe.position.set(0, HATCH_Y + 0.01, -1.4 + i * 0.25);
    if (i % 2 === 0) stripe.material = warnMat;
    else stripe.material = metalMat;
    group.add(stripe);
  }

  // ── Ladder rungs visible in the hatch opening ────────────────────────────
  // Rails extend from slab top down into the ground (into the bunker)
  const railGeo = new THREE.CylinderGeometry(0.04, 0.04, SLAB_Y + 1.5, 6);
  const railL = new THREE.Mesh(railGeo, ladderMat);
  railL.position.set(-0.35, (SLAB_Y + 1.5) / 2 - (SLAB_Y + 1.5) + SLAB_Y * 0.3, -0.8);
  group.add(railL);
  const railR = new THREE.Mesh(railGeo, ladderMat);
  railR.position.set(0.35, (SLAB_Y + 1.5) / 2 - (SLAB_Y + 1.5) + SLAB_Y * 0.3, -0.8);
  group.add(railR);

  // Rungs
  const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6);
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(rungGeo, ladderMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, SLAB_Y - 0.1 - i * 0.45, -0.8);
    group.add(rung);
  }

  // ── Identification plate ───────────────────────────────────────────────────
  const plateGeo = new THREE.BoxGeometry(0.8, 0.3, 0.03);
  const plateMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(1.8, HATCH_Y, -1.5);
  plate.rotation.y = Math.PI / 2;
  group.add(plate);

  // Text indicator on plate (yellow emissive stripe)
  const indicatorGeo = new THREE.BoxGeometry(0.6, 0.06, 0.03);
  const indicatorMat = new THREE.MeshPhongMaterial({
    color: 0xffcc00,
    emissive: new THREE.Color(0xffcc00),
    emissiveIntensity: 0.5,
  });
  const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
  indicator.position.set(1.8, HATCH_Y + 0.03, -1.5);
  indicator.rotation.y = Math.PI / 2;
  group.add(indicator);

  // ── Warning beacon post ────────────────────────────────────────────────────
  // A tall pole with an orange warning beacon — makes the entrance impossible to miss.
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 3.0, 8);
  const poleMat = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 60 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(-2.5, 1.5, -2.0);
  pole.castShadow = true;
  group.add(pole);

  // Orange beacon sphere at the top of the pole
  const beaconGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const beaconMat = new THREE.MeshPhongMaterial({
    color: 0xff6600,
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 0.8,
    shininess: 80,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(-2.5, 3.1, -2.0);
  group.add(beacon);

  // Warning sign board on the pole
  const signGeo = new THREE.BoxGeometry(1.1, 0.7, 0.05);
  const signMat = new THREE.MeshPhongMaterial({
    color: 0xffc107,
    emissive: new THREE.Color(0xcc8800),
    emissiveIntensity: 0.3,
  });
  const sign = new THREE.Mesh(signGeo, signMat);
  sign.position.set(-2.5, 2.2, -2.0);
  group.add(sign);

  // Black diagonal stripe on sign (hazard pattern)
  const signStripe1 = new THREE.BoxGeometry(1.1, 0.12, 0.06);
  const signStripeMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const ss1 = new THREE.Mesh(signStripe1, signStripeMat);
  ss1.position.set(-2.5, 2.27, -2.0);
  ss1.rotation.z = 0.42;
  group.add(ss1);
  const ss2 = new THREE.Mesh(signStripe1, signStripeMat);
  ss2.position.set(-2.5, 2.13, -2.0);
  ss2.rotation.z = 0.42;
  group.add(ss2);

  // ── Small debris / rocks around the mound ─────────────────────────────────
  const rockMat = new THREE.MeshPhongMaterial({ color: 0x666655 });
  const rockPositions = [
    [-2.5, 1.8], [2.2, 2.5], [-1.8, -2.2], [2.8, -1.5], [0.5, 3.0],
  ] as [number, number][];
  rockPositions.forEach(([rx, rz]) => {
    const rockGeo = new THREE.IcosahedronGeometry(0.2 + Math.random() * 0.15, 0);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(rx, 0.1, rz);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(rock);
  });

  return group;
}

// ─── Interior Scene ───────────────────────────────────────────────────────────

/**
 * Builds the multi-container laboratory interior.
 * Local coordinate origin is at the centre of the entry container floor.
 *
 * Layout (Z axis, local):
 *   Container 1 (Entry):  Z = 0  .. +12  — ladder down, workbench, monitor
 *   Container 2 (Lab):    Z = 12 .. +24  — lab equipment, chemicals
 *   Container 3 (Server): Z = 24 .. +36  — servers, cabling, exit ladder
 *
 * Y=0 is the floor; player height = 1.8.
 */
export function buildBunkerInteriorScene(): BunkerInteriorResult {
  const group = new THREE.Group();
  const rooms: THREE.Box3[] = [];
  const lights: BunkerInteriorResult["lights"] = [];
  const animatedMeshes: BunkerInteriorResult["animatedMeshes"] = [];

  // ── Global ambient — essential for MeshStandardMaterial to show up ──────────
  // Without this, when the earth-world group is hidden, there is zero ambient
  // light and the bunker interior looks completely black in corners.
  // A dim green-tinted ambient matches the underground laboratory atmosphere.
  const ambientLight = new THREE.AmbientLight(0x182a18, 9.0);
  group.add(ambientLight);

  // ── Shared materials ────────────────────────────────────────────────────────
  const containerMat = new THREE.MeshStandardMaterial({
    color: 0x3a4a38, roughness: 0.85, metalness: 0.55,
  });
  const containerRustMat = new THREE.MeshStandardMaterial({
    color: 0x5a3020, roughness: 0.9, metalness: 0.3,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, roughness: 0.9, metalness: 0.4,
  });
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x1a2218, roughness: 0.95, metalness: 0.3,
  });
  const workbenchMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a30, roughness: 0.8, metalness: 0.3,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x003300,
    emissive: new THREE.Color(0x00cc44),
    emissiveIntensity: 0.9,
    roughness: 0, metalness: 0,
  });
  const serverMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.7, metalness: 0.8,
  });
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a4a, roughness: 0.6, metalness: 0.9,
  });
  const cabinetMat = new THREE.MeshStandardMaterial({
    color: 0x2a3020, roughness: 0.8, metalness: 0.4,
  });
  const emergencyMat = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: new THREE.Color(0xcc1100),
    emissiveIntensity: 1.2,
    roughness: 0.3, metalness: 0.1,
  });
  const ladderMat = new THREE.MeshStandardMaterial({
    color: 0x888888, roughness: 0.5, metalness: 0.7,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x88ffcc, roughness: 0,
    metalness: 0.1, transparent: true, opacity: 0.5,
    emissive: new THREE.Color(0x00cc88), emissiveIntensity: 0.3,
  });
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xdddddd),
    emissiveIntensity: 0.2,
  });

  // ── Helper: add a container room ───────────────────────────────────────────
  const addContainer = (startZ: number) => {
    const endZ = startZ + CONTAINER_L;
    const halfW = CONTAINER_W / 2;

    // Register walkable room (slightly inset from walls)
    rooms.push(new THREE.Box3(
      new THREE.Vector3(-halfW + WALL_T, 0, startZ),
      new THREE.Vector3( halfW - WALL_T, CONTAINER_H, endZ),
    ));

    // Floor
    const floorGeo = new THREE.BoxGeometry(CONTAINER_W, WALL_T, CONTAINER_L);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -WALL_T / 2, startZ + CONTAINER_L / 2);
    floor.receiveShadow = true;
    group.add(floor);

    // Ceiling
    const ceilGeo = new THREE.BoxGeometry(CONTAINER_W, WALL_T, CONTAINER_L);
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.position.set(0, CONTAINER_H + WALL_T / 2, startZ + CONTAINER_L / 2);
    group.add(ceil);

    // Left wall (-X)
    const wallLGeo = new THREE.BoxGeometry(WALL_T, CONTAINER_H, CONTAINER_L);
    const wallL = new THREE.Mesh(wallLGeo, containerMat);
    wallL.position.set(-halfW, CONTAINER_H / 2, startZ + CONTAINER_L / 2);
    wallL.castShadow = true;
    group.add(wallL);

    // Right wall (+X)
    const wallR = new THREE.Mesh(wallLGeo, containerMat);
    wallR.position.set( halfW, CONTAINER_H / 2, startZ + CONTAINER_L / 2);
    group.add(wallR);

    // Front wall (start face — only on very first container; others have connector openings)
    if (startZ === 0) {
      const frontGeo = new THREE.BoxGeometry(CONTAINER_W, CONTAINER_H, WALL_T);
      const front = new THREE.Mesh(frontGeo, containerMat);
      front.position.set(0, CONTAINER_H / 2, startZ - WALL_T / 2);
      group.add(front);
    }

    // Back wall (end face — only on last container)
    const isLast = startZ === (NUM_CONTAINERS - 1) * CONTAINER_L;
    if (isLast) {
      const backGeo = new THREE.BoxGeometry(CONTAINER_W, CONTAINER_H, WALL_T);
      const back = new THREE.Mesh(backGeo, containerMat);
      back.position.set(0, CONTAINER_H / 2, endZ + WALL_T / 2);
      group.add(back);
    } else {
      // Connector: solid wall with a doorway opening.
      // Left segment of wall (left of doorway)
      const doorW = 1.6;
      const doorH = 2.2;
      const sideW = (CONTAINER_W - doorW) / 2;

      // Left segment
      const wallSegLGeo = new THREE.BoxGeometry(sideW, CONTAINER_H, WALL_T);
      const wallSegL = new THREE.Mesh(wallSegLGeo, containerRustMat);
      wallSegL.position.set(-CONTAINER_W / 2 + sideW / 2, CONTAINER_H / 2, endZ);
      group.add(wallSegL);

      // Right segment
      const wallSegR = new THREE.Mesh(wallSegLGeo, containerRustMat);
      wallSegR.position.set( CONTAINER_W / 2 - sideW / 2, CONTAINER_H / 2, endZ);
      group.add(wallSegR);

      // Top of doorway (above the opening)
      const wallTopGeo = new THREE.BoxGeometry(doorW, CONTAINER_H - doorH, WALL_T);
      const wallTop = new THREE.Mesh(wallTopGeo, containerRustMat);
      wallTop.position.set(0, doorH + (CONTAINER_H - doorH) / 2, endZ);
      group.add(wallTop);

      // Door frame (emissive accent around opening)
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x225522,
        emissive: new THREE.Color(0x113311),
        emissiveIntensity: 0.4,
      });
      const frameGeo = new THREE.BoxGeometry(doorW + 0.1, 0.08, WALL_T + 0.04);
      const frameTop = new THREE.Mesh(frameGeo, frameMat);
      frameTop.position.set(0, doorH, endZ);
      group.add(frameTop);
    }

    // Corrugation ridges on walls (vertical stripes every 1 unit)
    for (let i = 0; i < 5; i++) {
      const ridgeGeo = new THREE.BoxGeometry(0.06, CONTAINER_H, CONTAINER_L);
      const ridge = new THREE.Mesh(ridgeGeo, containerRustMat);
      ridge.position.set(-halfW + 0.06 + i * 1.1, CONTAINER_H / 2, startZ + CONTAINER_L / 2);
      group.add(ridge);
    }
  };

  // ── Build 3 containers ─────────────────────────────────────────────────────
  for (let i = 0; i < NUM_CONTAINERS; i++) {
    addContainer(i * CONTAINER_L);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ── CONTAINER 1 (Entry, Z=0..12) ────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  // Entry ladder going up (at the front wall, centre)
  {
    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, CONTAINER_H + 0.5, 6);
    const railL = new THREE.Mesh(railGeo, ladderMat);
    railL.position.set(-0.3, CONTAINER_H / 2, 0.3);
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, ladderMat);
    railR.position.set(0.3, CONTAINER_H / 2, 0.3);
    group.add(railR);
    for (let i = 0; i < 6; i++) {
      const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
      const rung = new THREE.Mesh(rungGeo, ladderMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.4 + i * 0.4, 0.3);
      group.add(rung);
    }
  }

  // Workbench 1 (left wall, entry area)
  {
    const benchGeo = new THREE.BoxGeometry(0.6, 0.06, 2.5);
    const bench = new THREE.Mesh(benchGeo, workbenchMat);
    bench.position.set(-CONTAINER_W / 2 + 0.35, 0.8, 4.0);
    group.add(bench);

    // Bench legs
    const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    for (const lz of [2.9, 5.1]) {
      const leg = new THREE.Mesh(legGeo, pipeMat);
      leg.position.set(-CONTAINER_W / 2 + 0.35, 0.4, lz);
      group.add(leg);
    }

    // CRT Monitor on bench
    {
      // Monitor body
      const monBodyGeo = new THREE.BoxGeometry(0.35, 0.3, 0.28);
      const monBody = new THREE.Mesh(monBodyGeo, serverMat);
      monBody.position.set(-CONTAINER_W / 2 + 0.35, 1.0, 3.5);
      group.add(monBody);

      // Screen (glowing green)
      const screenGeo = new THREE.BoxGeometry(0.28, 0.22, 0.01);
      const screen = new THREE.Mesh(screenGeo, screenMat) as THREE.Mesh;
      screen.position.set(-CONTAINER_W / 2 + 0.35, 1.02, 3.36);
      group.add(screen);
      animatedMeshes.push({ mesh: screen, type: "monitor" });

      // Monitor neck + base
      const neckGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.14, 6);
      const neck = new THREE.Mesh(neckGeo, serverMat);
      neck.position.set(-CONTAINER_W / 2 + 0.35, 0.87, 3.5);
      group.add(neck);
    }

    // Test tube rack on bench
    {
      const rackGeo = new THREE.BoxGeometry(0.3, 0.04, 0.12);
      const rack = new THREE.Mesh(rackGeo, pipeMat);
      rack.position.set(-CONTAINER_W / 2 + 0.35, 0.86, 4.5);
      group.add(rack);
      for (let ti = 0; ti < 4; ti++) {
        const tubeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6, 1, true);
        const tube = new THREE.Mesh(tubeGeo, glassMat);
        tube.position.set(-CONTAINER_W / 2 + 0.22 + ti * 0.06, 0.96, 4.5);
        group.add(tube);
      }
    }
  }

  // Fluorescent light strip (container 1) — two strips for full-length coverage
  for (const lz of [3.0, 9.0]) {
    const stripGeo = new THREE.BoxGeometry(0.12, 0.04, 2.5);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xddffdd), emissiveIntensity: 2.0,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, CONTAINER_H - 0.05, lz);
    group.add(strip);

    const light1 = new THREE.PointLight(0xaaffaa, 10.5, 14);
    light1.position.set(0, CONTAINER_H - 0.2, lz);
    group.add(light1);
    lights.push({ light: light1, baseIntensity: 10.5, phase: 0.3 + lz * 0.1 });
  }

  // Emergency red light (container 1)
  {
    const emGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const em = new THREE.Mesh(emGeo, emergencyMat);
    em.position.set(CONTAINER_W / 2 - 0.25, CONTAINER_H - 0.25, 2.0);
    group.add(em);

    const emLight = new THREE.PointLight(0xff2200, 4.5, 8);
    emLight.position.copy(em.position);
    group.add(emLight);
    lights.push({ light: emLight, baseIntensity: 4.5, phase: 1.7 });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ── CONTAINER 2 (Lab, Z=12..24) ──────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  // Long workbench (right wall)
  {
    const benchGeo = new THREE.BoxGeometry(0.65, 0.06, 6.0);
    const bench = new THREE.Mesh(benchGeo, workbenchMat);
    bench.position.set(CONTAINER_W / 2 - 0.38, 0.8, 18.0);
    group.add(bench);
    for (const lz of [15.2, 17.0, 19.0, 20.8]) {
      const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
      const leg = new THREE.Mesh(legGeo, pipeMat);
      leg.position.set(CONTAINER_W / 2 - 0.38, 0.4, lz);
      group.add(leg);
    }

    // Beakers / flasks (cylinders with coloured glass)
    const beakerColors = [0x00aaff, 0xff8800, 0x00ff88, 0xaa00ff];
    for (let bi = 0; bi < 4; bi++) {
      const beakerMat = new THREE.MeshStandardMaterial({
        color: beakerColors[bi],
        transparent: true, opacity: 0.65,
        emissive: new THREE.Color(beakerColors[bi]),
        emissiveIntensity: 0.4,
      });
      const bkGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.2, 8);
      const bk = new THREE.Mesh(bkGeo, beakerMat);
      bk.position.set(CONTAINER_W / 2 - 0.38, 0.97, 15.5 + bi * 1.2);
      group.add(bk);
    }

    // Centrifuge machine
    {
      const cfBaseGeo = new THREE.BoxGeometry(0.35, 0.22, 0.28);
      const cfBase = new THREE.Mesh(cfBaseGeo, serverMat);
      cfBase.position.set(CONTAINER_W / 2 - 0.38, 0.91, 20.0);
      group.add(cfBase);

      const cfTopGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.1, 12);
      const cfTop = new THREE.Mesh(cfTopGeo, pipeMat) as THREE.Mesh;
      cfTop.position.set(CONTAINER_W / 2 - 0.38, 1.07, 20.0);
      group.add(cfTop);
      animatedMeshes.push({ mesh: cfTop, type: "vent" }); // will rotate in update
    }

    // Microscope
    {
      const micBaseGeo = new THREE.BoxGeometry(0.12, 0.04, 0.12);
      const micBase = new THREE.Mesh(micBaseGeo, serverMat);
      micBase.position.set(CONTAINER_W / 2 - 0.38, 0.84, 22.5);
      group.add(micBase);
      const micBodyGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.3, 6);
      const micBody = new THREE.Mesh(micBodyGeo, pipeMat);
      micBody.position.set(CONTAINER_W / 2 - 0.38, 1.0, 22.5);
      group.add(micBody);
      const micLensGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6);
      const micLens = new THREE.Mesh(micLensGeo, glassMat);
      micLens.position.set(CONTAINER_W / 2 - 0.38, 1.17, 22.55);
      micLens.rotation.x = 0.5;
      group.add(micLens);
    }
  }

  // Map / periodic table on left wall
  {
    const mapGeo = new THREE.BoxGeometry(0.02, 1.1, 1.8);
    const mapMat = new THREE.MeshStandardMaterial({
      color: 0xf5e8c0,
      emissive: new THREE.Color(0x998855),
      emissiveIntensity: 0.15,
    });
    const mapMesh = new THREE.Mesh(mapGeo, mapMat);
    mapMesh.position.set(-CONTAINER_W / 2 + 0.04, 1.5, 18.0);
    group.add(mapMesh);

    // Grid lines on the map to simulate periodic table
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x664400 });
    for (let row = 0; row < 5; row++) {
      const lineGeo = new THREE.BoxGeometry(0.01, 0.015, 1.7);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(-CONTAINER_W / 2 + 0.05, 1.05 + row * 0.2, 18.0);
      group.add(line);
    }
  }

  // Storage cabinet (left wall, lab)
  {
    const cabGeo = new THREE.BoxGeometry(0.4, 1.4, 0.7);
    const cab = new THREE.Mesh(cabGeo, cabinetMat);
    cab.position.set(-CONTAINER_W / 2 + 0.24, 0.7, 13.5);
    group.add(cab);
    // Cabinet doors (2 panels)
    const doorGeo = new THREE.BoxGeometry(0.01, 1.3, 0.3);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x1a2a18, roughness: 0.7 });
    const door1 = new THREE.Mesh(doorGeo, doorMat);
    door1.position.set(-CONTAINER_W / 2 + 0.44, 0.7, 13.2);
    group.add(door1);
    const door2 = new THREE.Mesh(doorGeo, doorMat);
    door2.position.set(-CONTAINER_W / 2 + 0.44, 0.7, 13.8);
    group.add(door2);

    // Biohazard symbol (orange emissive disc)
    const bioGeo = new THREE.CircleGeometry(0.08, 8);
    const bioMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: new THREE.Color(0xff4400),
      emissiveIntensity: 0.7,
    });
    const bio = new THREE.Mesh(bioGeo, bioMat);
    bio.rotation.y = Math.PI / 2;
    bio.position.set(-CONTAINER_W / 2 + 0.45, 1.1, 13.5);
    group.add(bio);
  }

  // Fluorescent light strip (container 2 — two strips, increased intensity and range)
  for (const lz of [15.0, 21.0]) {
    const stripGeo = new THREE.BoxGeometry(0.12, 0.04, 2.2);
    const stripMat2 = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xddffd8), emissiveIntensity: 2.0,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat2);
    strip.position.set(0, CONTAINER_H - 0.05, lz);
    group.add(strip);

    const llight = new THREE.PointLight(0xaaffaa, 9.0, 13);
    llight.position.set(0, CONTAINER_H - 0.15, lz);
    group.add(llight);
    lights.push({ light: llight, baseIntensity: 9.0, phase: lz * 0.17 });
  }

  // Overhead pipes (ceiling runs in lab)
  {
    for (const pz of [13.5, 16.0, 20.0, 23.5]) {
      const pipeGeo = new THREE.CylinderGeometry(0.05, 0.05, CONTAINER_W - 0.4, 8);
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, CONTAINER_H - 0.35, pz);
      group.add(pipe);
    }
    // Longitudinal pipe along ceiling
    const longPipeGeo = new THREE.CylinderGeometry(0.04, 0.04, CONTAINER_L, 8);
    const longPipe = new THREE.Mesh(longPipeGeo, pipeMat);
    longPipe.rotation.x = Math.PI / 2;
    longPipe.position.set(CONTAINER_W / 2 - 0.6, CONTAINER_H - 0.32, 18.0);
    group.add(longPipe);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ── CONTAINER 3 (Server Room, Z=24..36) ──────────────────────────────────────
  // ────────────────────────────────────────────────────────────────────────────

  // Server racks (back wall and sides)
  const rackPositions = [
    { x: -CONTAINER_W / 2 + 0.25, z: 26.0 },
    { x: -CONTAINER_W / 2 + 0.25, z: 28.2 },
    { x: -CONTAINER_W / 2 + 0.25, z: 30.4 },
    { x:  CONTAINER_W / 2 - 0.25, z: 27.0 },
    { x:  CONTAINER_W / 2 - 0.25, z: 29.5 },
  ];
  rackPositions.forEach(({ x, z }, ri) => {
    const rackGeo = new THREE.BoxGeometry(0.4, 2.2, 0.8);
    const rack = new THREE.Mesh(rackGeo, serverMat);
    rack.position.set(x, 1.1, z);
    group.add(rack);

    // LED rows on rack
    const ledColors = [0x00ff44, 0xff4444, 0x4444ff, 0xffff00];
    for (let row = 0; row < 6; row++) {
      const ledGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
      const ledColor = ledColors[row % ledColors.length];
      const ledMat = new THREE.MeshStandardMaterial({
        color: ledColor,
        emissive: new THREE.Color(ledColor),
        emissiveIntensity: 1.5,
      }) as THREE.MeshStandardMaterial;
      const led = new THREE.Mesh(ledGeo, ledMat) as THREE.Mesh;
      const side = x < 0 ? 1 : -1;
      led.position.set(x + side * 0.21, 0.35 + row * 0.28, z);
      group.add(led);
      if (row === 0) {
        animatedMeshes.push({ mesh: led, type: "server_led" });
        // Avoid the 'ri' unused warning
        void ri;
      }
    }
  });

  // Cable management (curved bundles)
  {
    for (let ci = 0; ci < 4; ci++) {
      const cableGeo = new THREE.CylinderGeometry(0.025, 0.025, CONTAINER_W - 0.6, 6);
      const cableMat = new THREE.MeshStandardMaterial({ color: ci % 2 === 0 ? 0x222222 : 0x0a0a44 });
      const cable = new THREE.Mesh(cableGeo, cableMat);
      cable.rotation.z = Math.PI / 2;
      cable.position.set(0, 0.08, 26.0 + ci * 0.6);
      group.add(cable);
    }
  }

  // UPS battery unit (back wall)
  {
    const upsGeo = new THREE.BoxGeometry(0.55, 0.55, 0.35);
    const ups = new THREE.Mesh(upsGeo, serverMat);
    ups.position.set(0, 0.28, 35.5);
    group.add(ups);
    // Status indicator
    const statusGeo = new THREE.BoxGeometry(0.1, 0.04, 0.02);
    const statusMat = new THREE.MeshStandardMaterial({
      color: 0x00ff44, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 1.2,
    });
    const status = new THREE.Mesh(statusGeo, statusMat) as THREE.Mesh;
    status.position.set(0, 0.58, 35.34);
    group.add(status);
    animatedMeshes.push({ mesh: status, type: "server_led" });
  }

  // Blue server room lighting — three lights for full coverage of 12-unit container
  {
    // Front blue fill
    const lightFront = new THREE.PointLight(0x4488ff, 7.5, 14);
    lightFront.position.set(0, CONTAINER_H - 0.3, 26.0);
    group.add(lightFront);
    lights.push({ light: lightFront, baseIntensity: 7.5, phase: 2.1 });

    // Centre cold white overhead strip
    const stripGeo3 = new THREE.BoxGeometry(0.12, 0.04, 2.5);
    const stripMat3 = new THREE.MeshStandardMaterial({
      color: 0xaaccff, emissive: new THREE.Color(0x8899dd), emissiveIntensity: 2.0,
    });
    const strip3 = new THREE.Mesh(stripGeo3, stripMat3);
    strip3.position.set(0, CONTAINER_H - 0.05, 30.0);
    group.add(strip3);

    const whiteLight = new THREE.PointLight(0xaaccff, 7.5, 14);
    whiteLight.position.set(0, CONTAINER_H - 0.2, 30.0);
    group.add(whiteLight);
    lights.push({ light: whiteLight, baseIntensity: 7.5, phase: 0.9 });

    // Rear blue fill near back wall / exit
    const lightRear = new THREE.PointLight(0x4466cc, 6.0, 12);
    lightRear.position.set(0, CONTAINER_H - 0.3, 34.0);
    group.add(lightRear);
    lights.push({ light: lightRear, baseIntensity: 6.0, phase: 1.5 });
  }

  // Emergency exit sign near ladder
  {
    const signGeo = new THREE.BoxGeometry(0.6, 0.22, 0.04);
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x003300,
      emissive: new THREE.Color(0x00cc00),
      emissiveIntensity: 1.0,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, CONTAINER_H - 0.4, 35.0);
    group.add(sign);

    // Arrow indicator
    const arrowGeo = new THREE.BoxGeometry(0.18, 0.08, 0.04);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0x00ff44, emissive: new THREE.Color(0x00ff44), emissiveIntensity: 1.5,
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(0, CONTAINER_H - 0.42, 35.05);
    group.add(arrow);
  }

  // Exit ladder (at back of container 3 — Z ≈ 35)
  {
    const exitLocalPos = new THREE.Vector3(0, 0, 35.0);

    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, CONTAINER_H + 0.5, 6);
    const railL = new THREE.Mesh(railGeo, ladderMat);
    railL.position.set(-0.3, CONTAINER_H / 2, 35.2);
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, ladderMat);
    railR.position.set(0.3, CONTAINER_H / 2, 35.2);
    group.add(railR);
    for (let i = 0; i < 6; i++) {
      const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6);
      const rung = new THREE.Mesh(rungGeo, ladderMat);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(0, 0.4 + i * 0.4, 35.2);
      group.add(rung);
    }

    // Ambient light near exit
    const exitLight = new THREE.PointLight(0xffcc44, 2.7, 5);
    exitLight.position.set(0, 1.5, 35.0);
    group.add(exitLight);
    lights.push({ light: exitLight, baseIntensity: 2.7, phase: 3.3 });

    // Label on all sides for the return
    const labelGeo = new THREE.BoxGeometry(0.5, 0.18, 0.04);
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 2.4, 35.5);
    group.add(label);

    return {
      group,
      rooms,
      lights,
      animatedMeshes,
      exitLocalPos,
    };
  }
}

// ─── Proximity Helpers ────────────────────────────────────────────────────────

/**
 * Returns the nearest BunkerConfig if the player is within BUNKER_ENTRY_RADIUS,
 * otherwise null.
 */
export function checkBunkerProximity(
  playerX: number,
  playerZ: number,
  configs: BunkerConfig[]
): BunkerConfig | null {
  let nearest: BunkerConfig | null = null;
  let nearestDist = BUNKER_ENTRY_RADIUS;

  for (const b of configs) {
    const dx = playerX - b.worldX;
    const dz = playerZ - b.worldZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = b;
    }
  }
  return nearest;
}

/**
 * Returns true if the player (in local bunker coordinates) is near the exit ladder.
 * The exit ladder is at local Z ≈ 35 (CONTAINER_L * 3 - 1).
 */
export function isNearBunkerExit(localX: number, localZ: number): boolean {
  const EXIT_Z = CONTAINER_L * NUM_CONTAINERS - 1; // = 35
  const dx = localX;
  const dz = localZ - EXIT_Z;
  return Math.sqrt(dx * dx + dz * dz) < BUNKER_EXIT_RADIUS;
}

/**
 * Returns true if the player (in local bunker coordinates) is near the entry ladder.
 * The entry ladder is at local Z ≈ 0.3.
 */
export function isNearBunkerEntry(localX: number, localZ: number): boolean {
  const dx = localX;
  const dz = localZ - 0.3;
  return Math.sqrt(dx * dx + dz * dz) < BUNKER_EXIT_RADIUS;
}
