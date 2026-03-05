/**
 * Harbor System
 *
 * Provides:
 *  - buildHarborDockMesh()    → Wooden pier/dock structure with bollards & hut
 *  - buildSailboatMesh()      → Larger sailboat with mast, sail, cabin & helm
 *
 * The harbor is placed on the coastline at runtime by scanning for a suitable
 * land/water boundary.  Two sailboats are moored at the dock; the player can
 * board either one and sail around the water freely.
 *
 * Coordinate convention:  the dock group's +Z axis points "seaward" (out from
 * shore toward open water).  Sailboats are placed alongside the dock and face
 * the same seaward direction when initially moored.
 */

import * as THREE from "three";

// ─── Public types ─────────────────────────────────────────────────────────────

/** Runtime data for a harbour sailboat. */
export interface HarborShipData {
  /** Three.js scene group. */
  mesh: THREE.Group;
  /** Unique string id. */
  id: string;
  /** Forward speed in units/s (negative = reversing). */
  velocity: number;
  /** Current heading in radians (Y-axis rotation of the mesh). */
  yaw: number;
  /** Reference to the sail mesh for wind animation. */
  sailMesh: THREE.Mesh;
  /** Reference to the sail group for billowing animation. */
  sailGroup: THREE.Group;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SAILBOAT_MAX_SPEED   = 11;   // units/s
export const SAILBOAT_ACCEL       = 4;    // units/s² while pressing W
export const SAILBOAT_BRAKE       = 7;    // units/s² deceleration (drag + brake)
export const SAILBOAT_TURN_SPEED  = 1.2;  // radians/s turning rate
export const SAILBOAT_BOARD_RADIUS = 6;   // units — show [E] prompt within this radius
export const SAILBOAT_CAM_HEIGHT  = 4.0;  // camera height above waterline when sailing
export const SAILBOAT_CAM_DIST    = 9.0;  // camera distance behind stern

// ─── Materials (shared, created once) ─────────────────────────────────────────

function makeMat(color: number, opts?: { transparent?: boolean; opacity?: number; side?: THREE.Side }) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

// ─── Dock ─────────────────────────────────────────────────────────────────────

/**
 * Build the harbour dock (pier) group.
 *
 * Layout (local space):
 *   - Origin is at the shore end of the dock (land side).
 *   - The dock extends in the +Z direction out to sea.
 *   - Width is 8 units (centred on Z axis).
 *   - Total dock length is ~22 units.
 *
 * The caller should:
 *   1. Position the group so origin is on the coastline.
 *   2. Rotate the group so local +Z faces open water.
 */
export function buildHarborDockMesh(): THREE.Group {
  const group = new THREE.Group();

  const darkWood  = makeMat(0x4A2C0A);   // dark weathered timber
  const lightWood = makeMat(0x8B6914);   // lighter deck planks
  const post      = makeMat(0x3A1F06);   // very dark dock posts
  const rope      = makeMat(0xCCB878);   // rope / hawser colour
  const stone     = makeMat(0x8A8880);   // harbour master hut walls
  const roofMat   = makeMat(0x5C3A1E);   // roof tiles
  const metalMat  = makeMat(0x556060);   // iron bollards & lanterns
  const glassMat  = makeMat(0xAADDFF, { transparent: true, opacity: 0.55 }); // lantern glass
  const lightMat  = makeMat(0xFFEE88);   // warm lantern glow

  // ── Main pier deck (planks) ───────────────────────────────────────────────
  // Six planks running along the dock length
  const DOCK_LENGTH = 22;
  const DOCK_WIDTH  = 7.5;
  const PLANK_OFFSETS = [-2.6, -1.55, -0.52, 0.52, 1.55, 2.6];

  PLANK_OFFSETS.forEach((xOff) => {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, DOCK_LENGTH),
      lightWood
    );
    plank.position.set(xOff, 0, DOCK_LENGTH / 2);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  });

  // Cross beams every 2 units
  for (let z = 1; z <= DOCK_LENGTH; z += 2) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(DOCK_WIDTH + 0.3, 0.12, 0.28),
      darkWood
    );
    beam.position.set(0, 0.02, z);
    group.add(beam);
  }

  // ── Support pillars ───────────────────────────────────────────────────────
  const pillarGeo = new THREE.CylinderGeometry(0.22, 0.28, 5.5, 8);
  const PILLAR_X  = [-3.0, 0, 3.0] as const;
  const PILLAR_Z  = [4, 9, 15, 21] as const;
  PILLAR_X.forEach((px) => {
    PILLAR_Z.forEach((pz) => {
      const pillar = new THREE.Mesh(pillarGeo, post);
      pillar.position.set(px, -2.5, pz);
      pillar.castShadow = true;
      group.add(pillar);
    });
  });

  // ── Railing posts & rails ─────────────────────────────────────────────────
  const railPostGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6);
  const railGeo     = new THREE.CylinderGeometry(0.045, 0.045, DOCK_LENGTH - 1, 6);
  const RAIL_SIDES  = [-DOCK_WIDTH / 2, DOCK_WIDTH / 2] as const;

  RAIL_SIDES.forEach((rx) => {
    // Top rail
    const rail = new THREE.Mesh(railGeo, darkWood);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(rx, 0.95, DOCK_LENGTH / 2 + 0.5);
    group.add(rail);

    // Posts every 2 m
    for (let z = 2; z <= DOCK_LENGTH; z += 2) {
      const rp = new THREE.Mesh(railPostGeo, darkWood);
      rp.position.set(rx, 0.47, z);
      group.add(rp);
    }
  });

  // ── Mooring bollards (at the seaward end, both sides) ────────────────────
  const bollardGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.65, 8);
  [
    { x: -3.2, z: DOCK_LENGTH - 1.5 },
    { x:  3.2, z: DOCK_LENGTH - 1.5 },
    { x: -3.2, z: DOCK_LENGTH - 5 },
    { x:  3.2, z: DOCK_LENGTH - 5 },
    { x: -3.2, z: DOCK_LENGTH - 10 },
    { x:  3.2, z: DOCK_LENGTH - 10 },
  ].forEach(({ x, z }) => {
    const b = new THREE.Mesh(bollardGeo, metalMat);
    b.position.set(x, 0.34, z);
    group.add(b);

    // Rope loop on bollard
    const ringGeo = new THREE.TorusGeometry(0.22, 0.04, 6, 12);
    const ring = new THREE.Mesh(ringGeo, rope);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.58, z);
    group.add(ring);
  });

  // ── Harbour master's hut ─────────────────────────────────────────────────
  // Placed at the shore end (z ≈ -1) so player can walk up to it
  const hutGroup = new THREE.Group();
  hutGroup.position.set(0, 0, -2);
  group.add(hutGroup);

  // Hut walls
  const hutWall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 3.5), stone);
  hutWall.position.y = 1.1;
  hutWall.castShadow = true;
  hutWall.receiveShadow = true;
  hutGroup.add(hutWall);

  // Roof (A-frame)
  const roofGeo = new THREE.ConeGeometry(3.3, 1.4, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.9;
  roof.castShadow = true;
  hutGroup.add(roof);

  // Door
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.1), darkWood);
  door.position.set(0, 0.8, 1.76);
  hutGroup.add(door);

  // Windows
  [[-1.4, 0], [1.4, 0]].forEach(([wx]) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), glassMat);
    win.position.set(wx, 1.35, 1.76);
    hutGroup.add(win);
  });

  // ── Lantern posts at dock entrance ────────────────────────────────────────
  [-3.4, 3.4].forEach((lx) => {
    const lPostGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.4, 8);
    const lPost = new THREE.Mesh(lPostGeo, metalMat);
    lPost.position.set(lx, 1.1, 1.5);
    group.add(lPost);

    const lBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), metalMat);
    lBox.position.set(lx, 2.5, 1.5);
    group.add(lBox);

    const lGlass = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.22), glassMat);
    lGlass.position.set(lx, 2.5, 1.5);
    group.add(lGlass);

    const lGlow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), lightMat);
    lGlow.position.set(lx, 2.5, 1.5);
    group.add(lGlow);

    // Point light
    const pl = new THREE.PointLight(0xFFDD88, 0.6, 8);
    pl.position.set(lx, 2.5, 1.5);
    group.add(pl);
  });

  // ── Seaward end platform / loading dock ──────────────────────────────────
  const endPlatform = new THREE.Mesh(
    new THREE.BoxGeometry(DOCK_WIDTH + 1.5, 0.18, 4),
    darkWood
  );
  endPlatform.position.set(0, 0, DOCK_LENGTH + 1.5);
  endPlatform.castShadow = true;
  endPlatform.receiveShadow = true;
  group.add(endPlatform);

  // End railing (three sides of the terminal platform)
  const endRailGeo = new THREE.BoxGeometry(DOCK_WIDTH + 2, 0.08, 0.08);
  [DOCK_LENGTH + 3.4].forEach((rz) => {
    const er = new THREE.Mesh(endRailGeo, darkWood);
    er.position.set(0, 1.0, rz);
    group.add(er);
  });

  // Side railings for the end platform
  [-(DOCK_WIDTH / 2 + 0.75), DOCK_WIDTH / 2 + 0.75].forEach((srx) => {
    const srGeo = new THREE.BoxGeometry(0.08, 0.08, 4.5);
    const sr = new THREE.Mesh(srGeo, darkWood);
    sr.position.set(srx, 1.0, DOCK_LENGTH + 1.5);
    group.add(sr);
  });

  // ── Anchor chain decoration ───────────────────────────────────────────────
  const chainGeo = new THREE.TorusGeometry(0.14, 0.04, 4, 8);
  for (let ci = 0; ci < 5; ci++) {
    const link = new THREE.Mesh(chainGeo, metalMat);
    link.position.set(3.8, -ci * 0.22 - 0.2, DOCK_LENGTH - 1);
    link.rotation.y = ci * 0.4;
    group.add(link);
  }

  return group;
}

// ─── Sailboat ─────────────────────────────────────────────────────────────────

/**
 * Build a medium-sized sailboat with mast, sail, cabin, and helm.
 *
 * Dimensions (approx): 10 × 3.5 × 1.2 (L × W × H of hull).
 * The boat's bow points in the local +Z direction (group.rotation.y = 0 → facing +Z).
 *
 * Returns both the group and the sail mesh (for animation in the game loop).
 */
export function buildSailboatMesh(): { group: THREE.Group; sailMesh: THREE.Mesh; sailGroup: THREE.Group } {
  const group = new THREE.Group();

  // ── Materials ─────────────────────────────────────────────────────────────
  const hullMat    = makeMat(0x2B4C7A);   // deep navy blue hull
  const deckMat    = makeMat(0xC8A86A);   // teak deck
  const trimMat    = makeMat(0xDCC87A);   // gold trim
  const mastMat    = makeMat(0xB8A060);   // pale timber mast
  const sailMat    = makeMat(0xF5EDD5, { side: THREE.DoubleSide });  // cream sail
  const metalPart  = makeMat(0x7A8890);   // iron fittings
  const ropeColor  = makeMat(0xCCB060);   // rigging
  const helmColor  = makeMat(0x7A4A1A);   // helm wheel spokes
  const cabinMat   = makeMat(0xD4B870);   // cabin woodwork
  const glassMat   = makeMat(0xAADDFF, { transparent: true, opacity: 0.50 });
  const redLight   = makeMat(0xFF2222);   // port navigation light
  const greenLight = makeMat(0x22FF44);   // starboard navigation light

  // ── Pivot so bow points in local +Z ──────────────────────────────────────
  const pivot = new THREE.Group();
  group.add(pivot);

  // ── Hull ─────────────────────────────────────────────────────────────────
  // Keel / bottom
  const keel = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.35, 3.0), hullMat);
  keel.position.y = 0.17;
  keel.castShadow = true;
  keel.receiveShadow = true;
  pivot.add(keel);

  // Port & starboard hull sides
  const sideDim = { l: 10.2, h: 0.85, w: 0.22 };
  ([-1, 1] as const).forEach((s) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(sideDim.l, sideDim.h, sideDim.w),
      hullMat
    );
    side.position.set(0, 0.68, s * 1.52);
    side.castShadow = true;
    pivot.add(side);
  });

  // Bow cap
  const bow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 3.2), hullMat);
  bow.position.set(4.9, 0.68, 0);
  bow.castShadow = true;
  pivot.add(bow);

  // Stern cap
  const stern = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 3.2), hullMat);
  stern.position.set(-4.9, 0.68, 0);
  stern.castShadow = true;
  pivot.add(stern);

  // Gold waterline stripe
  const stripeMat = trimMat;
  ([-1, 1] as const).forEach((s) => {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(10.0, 0.08, 0.06), stripeMat);
    stripe.position.set(0, 1.0, s * 1.56);
    pivot.add(stripe);
  });

  // ── Deck ─────────────────────────────────────────────────────────────────
  const deckPlanks = [-0.9, -0.3, 0.3, 0.9];
  deckPlanks.forEach((zOff) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.10, 0.52), deckMat);
    plank.position.set(0, 1.15, zOff);
    plank.receiveShadow = true;
    pivot.add(plank);
  });

  // Deck edge trim
  ([-1, 1] as const).forEach((s) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.10, 0.15), trimMat);
    edge.position.set(0, 1.14, s * 1.42);
    pivot.add(edge);
  });

  // ── Cabin ─────────────────────────────────────────────────────────────────
  // Main cabin box (aft of mast)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.05, 2.4), cabinMat);
  cabin.position.set(-2.2, 1.7, 0);
  cabin.castShadow = true;
  pivot.add(cabin);

  // Cabin roof (slightly wider)
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 2.6), deckMat);
  cabinRoof.position.set(-2.2, 2.28, 0);
  pivot.add(cabinRoof);

  // Cabin windows port & starboard
  ([-1, 1] as const).forEach((s) => {
    for (let wx = -0.8; wx <= 0.8; wx += 1.6) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.08), glassMat);
      win.position.set(-2.2 + wx, 1.9, s * 1.24);
      pivot.add(win);
    }
  });

  // ── Mast ──────────────────────────────────────────────────────────────────
  const mastGeo = new THREE.CylinderGeometry(0.10, 0.14, 9.0, 10);
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(1.4, 5.65, 0);
  mast.castShadow = true;
  pivot.add(mast);

  // Crow's nest
  const nestRim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12, 1, true), deckMat);
  nestRim.position.set(1.4, 9.5, 0);
  pivot.add(nestRim);

  const nestFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 12), deckMat);
  nestFloor.position.set(1.4, 9.47, 0);
  pivot.add(nestFloor);

  // ── Boom (horizontal spar at base of sail) ────────────────────────────────
  const boomGeo = new THREE.CylinderGeometry(0.055, 0.055, 6.5, 8);
  const boom = new THREE.Mesh(boomGeo, mastMat);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(1.4 + 1.55, 1.85, 0);   // extends astern of mast
  pivot.add(boom);

  // Boom end fitting
  const boomFit = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 8), metalPart);
  boomFit.position.set(1.4 - 2.0, 1.85, 0);
  pivot.add(boomFit);

  // ── Sail (main) ───────────────────────────────────────────────────────────
  // Gaff-rig style: triangular sail between mast and a top gaff spar.
  // We use a PlaneGeometry (billboard-style) and animate rotation slightly.
  const sailGroup = new THREE.Group();
  sailGroup.position.set(1.4, 2.0, 0);   // at the mast
  pivot.add(sailGroup);

  const SAIL_H  = 6.8;
  const SAIL_W  = 5.4;
  const sailGeo = new THREE.PlaneGeometry(SAIL_W, SAIL_H, 3, 6);
  const sailMesh = new THREE.Mesh(sailGeo, sailMat);
  sailMesh.position.set(SAIL_W / 2, SAIL_H / 2, 0.15); // offset so it hangs from mast
  sailMesh.receiveShadow = false;
  sailGroup.add(sailMesh);

  // Gaff (top spar)
  const gaffGeo = new THREE.CylinderGeometry(0.045, 0.045, SAIL_W + 0.6, 8);
  const gaff = new THREE.Mesh(gaffGeo, mastMat);
  gaff.rotation.z = Math.PI / 2;
  gaff.position.set(SAIL_W / 2, SAIL_H + 0.2, 0);
  sailGroup.add(gaff);

  // ── Jib / foresail (small triangular staysail at bow) ─────────────────────
  const jibGeo = new THREE.BufferGeometry();
  const jibVerts = new Float32Array([
    // triangle: mast head, bow tip, deck forward
    1.4,  8.5, 0,
    4.8,  1.3, -0.1,
    4.8,  1.3, 0.1,
  ]);
  jibGeo.setAttribute("position", new THREE.BufferAttribute(jibVerts, 3));
  jibGeo.computeVertexNormals();
  const jib = new THREE.Mesh(jibGeo, sailMat);
  pivot.add(jib);

  // ── Rigging (stays and shrouds) ───────────────────────────────────────────
  const rigGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4);

  // Backstay (mast top → stern)
  addRig(pivot, [1.4, 10.0, 0], [-4.5, 1.2, 0], ropeColor);
  // Forestay (mast top → bow)
  addRig(pivot, [1.4, 10.0, 0], [4.8, 1.2, 0], ropeColor);
  // Shrouds (mast head → port/starboard chainplates)
  addRig(pivot, [1.4, 9.0, 0], [0.5, 1.2, -1.5], ropeColor);
  addRig(pivot, [1.4, 9.0, 0], [0.5, 1.2,  1.5], ropeColor);

  // ── Helm wheel ────────────────────────────────────────────────────────────
  const helmGroup = new THREE.Group();
  helmGroup.position.set(-4.0, 1.6, 0);
  pivot.add(helmGroup);

  // Pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8),
    metalPart
  );
  pedestal.position.y = 0.35;
  helmGroup.add(pedestal);

  // Wheel rim
  const wheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.045, 8, 24),
    helmColor
  );
  wheelRim.position.y = 0.98;
  wheelRim.rotation.x = Math.PI / 2;
  helmGroup.add(wheelRim);

  // Spokes
  for (let i = 0; i < 8; i++) {
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.84, 4),
      helmColor
    );
    const angle = (i / 8) * Math.PI * 2;
    spoke.rotation.z = angle;
    spoke.position.y = 0.98;
    helmGroup.add(spoke);
  }

  // ── Navigation lights ─────────────────────────────────────────────────────
  // Port (left/−Z when facing +Z) = red
  const portLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), redLight);
  portLight.position.set(4.5, 1.55, -1.55);
  pivot.add(portLight);
  const portPL = new THREE.PointLight(0xFF2222, 0.5, 5);
  portPL.position.copy(portLight.position);
  pivot.add(portPL);

  // Starboard (right/+Z when facing +Z) = green
  const stbdLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), greenLight);
  stbdLight.position.set(4.5, 1.55, 1.55);
  pivot.add(stbdLight);
  const stbdPL = new THREE.PointLight(0x22FF44, 0.5, 5);
  stbdPL.position.copy(stbdLight.position);
  pivot.add(stbdPL);

  // Masthead light (white)
  const mastheadPL = new THREE.PointLight(0xFFFFFF, 0.35, 8);
  mastheadPL.position.set(1.4, 10.3, 0);
  pivot.add(mastheadPL);

  // ── Anchor (stowed at bow) ────────────────────────────────────────────────
  const anchorShank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.8, 6),
    metalPart
  );
  anchorShank.position.set(4.4, 1.35, 0);
  anchorShank.rotation.z = Math.PI / 3;
  pivot.add(anchorShank);

  const anchorArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.07, 0.07),
    metalPart
  );
  anchorArm.position.set(4.55, 1.08, 0);
  pivot.add(anchorArm);

  // ── Rope coil on deck ────────────────────────────────────────────────────
  const coilGeo = new THREE.TorusGeometry(0.22, 0.065, 4, 16);
  const coil = new THREE.Mesh(coilGeo, ropeColor);
  coil.rotation.x = Math.PI / 2;
  coil.position.set(-3.5, 1.22, 1.0);
  pivot.add(coil);

  // ── Flag at masthead ─────────────────────────────────────────────────────
  const flagMat = makeMat(0xDD2222);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), flagMat);
  flag.position.set(1.4 + 0.35, 10.35, 0);
  flag.castShadow = false;
  pivot.add(flag);

  return { group, sailMesh, sailGroup };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Add a rigging line (thin cylinder) between two world-local points.
 * The cylinder is placed at the midpoint and rotated to connect the two ends.
 */
function addRig(
  parent: THREE.Group,
  from: [number, number, number],
  to: [number, number, number],
  mat: THREE.MeshLambertMaterial
) {
  const start = new THREE.Vector3(...from);
  const end   = new THREE.Vector3(...to);
  const dir   = end.clone().sub(start);
  const len   = dir.length();
  const mid   = start.clone().add(end).multiplyScalar(0.5);

  const geo  = new THREE.CylinderGeometry(0.02, 0.02, len, 4);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(mid);

  // Orient the cylinder (which by default is along Y) to point from start→end
  const axis = new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(axis, dir.normalize());

  parent.add(mesh);
}

// ─── Coastal harbour spawn helper ─────────────────────────────────────────────

/**
 * Scan the terrain to find a suitable harbour position: a land point that has
 * open water (terrain < waterLevel) at the given search radius in front of it.
 *
 * @param terrainFn   Function returning terrain height at (x, z).
 * @param waterLevel  Y-value at which the sea surface sits.
 * @param searchDist  Radial distance from origin to probe (default 90).
 * @returns  { x, z, angle } where `angle` is the direction the dock should face
 *           (i.e. the direction from shore toward sea), or null if not found.
 */
export function findHarborPosition(
  terrainFn: (x: number, z: number) => number,
  waterLevel: number,
  searchDist = 90
): { x: number; z: number; angle: number } | null {
  // Probe positions in a ring at `searchDist` from origin
  for (let angleDeg = 0; angleDeg < 360; angleDeg += 10) {
    const angle = (angleDeg * Math.PI) / 180;
    const ax = Math.cos(angle) * searchDist;
    const az = Math.sin(angle) * searchDist;

    const landH = terrainFn(ax, az);
    if (landH < waterLevel) continue; // this point is in the sea

    // Check that open water exists further out in the same direction
    const waterX = Math.cos(angle) * (searchDist + 18);
    const waterZ = Math.sin(angle) * (searchDist + 18);
    if (terrainFn(waterX, waterZ) >= waterLevel) continue; // no water out there

    // Also check that further inward there is land (so we have shore approach)
    const inlandX = Math.cos(angle) * (searchDist - 12);
    const inlandZ = Math.sin(angle) * (searchDist - 12);
    if (terrainFn(inlandX, inlandZ) < waterLevel) continue; // inward is also sea

    // Good candidate!  The dock should face seaward, i.e. away from origin.
    return { x: ax, z: az, angle };
  }
  return null;
}
