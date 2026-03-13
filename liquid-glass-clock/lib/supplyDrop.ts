import * as THREE from "three";

// ─── Supply Drop Constants ─────────────────────────────────────────────────────

/** Seconds between consecutive supply drops. */
export const SUPPLY_DROP_INTERVAL = 300; // 5 minutes

/** Y altitude from which the crate starts its descent. */
export const SUPPLY_DROP_ALTITUDE = 150;

/** Vertical descent speed (units/second) during fall. */
export const SUPPLY_DROP_DESCENT_SPEED = 14;

/** Slow descent speed near ground (units/second) for soft landing feel. */
export const SUPPLY_DROP_DESCENT_SLOW_SPEED = 4;

/** Y altitude at which the descent slows down. */
export const SUPPLY_DROP_SLOW_ALTITUDE = 30;

/** Distance within which the player can collect the crate. */
export const SUPPLY_DROP_COLLECT_RADIUS = 3.5;

// ─── Loot System ──────────────────────────────────────────────────────────────

export type SupplyDropLootType =
  | "coins"
  | "wood"
  | "ammo"
  | "materials"
  | "medkit"
  | "weapon_upgrade";

export interface SupplyDropLoot {
  type: SupplyDropLootType;
  /** Amount/count of the loot item. */
  amount: number;
  /** Czech display label for the HUD message. */
  label: string;
  /** HUD colour for the notification. */
  color: string;
  /** Emoji icon for the loot type. */
  icon: string;
}

interface LootEntry {
  type: SupplyDropLootType;
  /** Relative weight (higher = more frequent). */
  weight: number;
  minAmount: number;
  maxAmount: number;
  label: string;
  color: string;
  icon: string;
}

const LOOT_TABLE: LootEntry[] = [
  {
    type: "ammo",
    weight: 30,
    minAmount: 20,
    maxAmount: 60,
    label: "náboje",
    color: "#fbbf24",
    icon: "🔧",
  },
  {
    type: "coins",
    weight: 25,
    minAmount: 10,
    maxAmount: 35,
    label: "zlatých mincí",
    color: "#ffd700",
    icon: "🪙",
  },
  {
    type: "wood",
    weight: 20,
    minAmount: 5,
    maxAmount: 15,
    label: "kusů dřeva",
    color: "#a3e635",
    icon: "🪵",
  },
  {
    type: "materials",
    weight: 15,
    minAmount: 3,
    maxAmount: 10,
    label: "stavebních materiálů",
    color: "#60a5fa",
    icon: "🧱",
  },
  {
    type: "medkit",
    weight: 7,
    minAmount: 25,
    maxAmount: 50,
    label: "HP lékárničky",
    color: "#f87171",
    icon: "💉",
  },
  {
    type: "weapon_upgrade",
    weight: 3,
    minAmount: 1,
    maxAmount: 1,
    label: "vylepšení zbraně (dočasně +50% poškození)",
    color: "#c084fc",
    icon: "⚡",
  },
];

const TOTAL_WEIGHT = LOOT_TABLE.reduce((sum, e) => sum + e.weight, 0);

/**
 * Roll a random loot item from the weighted loot table.
 * Optionally pass a seeded `rng` function (returns 0–1); defaults to Math.random.
 */
export function rollLoot(rng: () => number = Math.random): SupplyDropLoot {
  let roll = rng() * TOTAL_WEIGHT;
  for (const entry of LOOT_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) {
      const amount =
        entry.minAmount +
        Math.floor(rng() * (entry.maxAmount - entry.minAmount + 1));
      return {
        type: entry.type,
        amount,
        label: entry.label,
        color: entry.color,
        icon: entry.icon,
      };
    }
  }
  // Fallback (should not be reached)
  const last = LOOT_TABLE[LOOT_TABLE.length - 1];
  return {
    type: last.type,
    amount: last.minAmount,
    label: last.label,
    color: last.color,
    icon: last.icon,
  };
}

// ─── Mesh Builder ──────────────────────────────────────────────────────────────

export interface ParachuteCrateMeshResult {
  /** Root group — move this to animate the whole drop. */
  group: THREE.Group;
  /** Parachute dome sub-group — used for open/close animation. */
  parachuteGroup: THREE.Group;
  /** Rope group connecting parachute to crate. */
  ropeGroup: THREE.Group;
  /** The wooden crate box group. */
  crateGroup: THREE.Group;
}

/**
 * Build a Three.js supply-drop crate with parachute mesh.
 *
 * Structure:
 *   group (root)
 *   ├── parachuteGroup   (dome at top)
 *   │   └── several panel meshes
 *   ├── ropeGroup        (4 thin rope cylinders)
 *   └── crateGroup       (box + markings)
 */
export function buildParachuteCrateMesh(): ParachuteCrateMeshResult {
  const group = new THREE.Group();
  const parachuteGroup = new THREE.Group();
  const ropeGroup = new THREE.Group();
  const crateGroup = new THREE.Group();

  group.add(parachuteGroup);
  group.add(ropeGroup);
  group.add(crateGroup);

  // ── Parachute (dome made of 8 panels) ──────────────────────────────────────
  const parachutePanelColors = [
    "#ef4444", "#ffffff", "#ef4444", "#ffffff",
    "#ef4444", "#ffffff", "#ef4444", "#ffffff",
  ];
  const PANEL_COUNT = 8;
  const DOME_RADIUS = 2.8;
  const DOME_HEIGHT = 2.2;
  const DOME_Y_OFFSET = 7; // above the crate

  for (let i = 0; i < PANEL_COUNT; i++) {
    // Each panel is a cone slice approximation
    const startAngle = (i / PANEL_COUNT) * Math.PI * 2;
    const endAngle = ((i + 1) / PANEL_COUNT) * Math.PI * 2;
    const midAngle = (startAngle + endAngle) / 2;

    const panelGeo = new THREE.ConeGeometry(
      DOME_RADIUS * 0.4, // top radius (narrower at apex)
      DOME_HEIGHT,
      2,  // radial segments (wedge shape)
      1,
      true // open ended
    );

    const panelMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(parachutePanelColors[i % parachutePanelColors.length]),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });

    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(
      Math.cos(midAngle) * DOME_RADIUS * 0.5,
      DOME_Y_OFFSET + DOME_HEIGHT / 2,
      Math.sin(midAngle) * DOME_RADIUS * 0.5
    );
    panel.rotation.y = -midAngle;
    panel.rotation.z = -0.25; // slight outward tilt
    parachuteGroup.add(panel);
  }

  // Central cap of the dome
  const capGeo = new THREE.SphereGeometry(DOME_RADIUS, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const capMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color("#ef4444"),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.set(0, DOME_Y_OFFSET + DOME_HEIGHT * 0.1, 0);
  cap.scale.set(1, DOME_HEIGHT / DOME_RADIUS * 0.7, 1);
  parachuteGroup.add(cap);

  // ── Ropes ─────────────────────────────────────────────────────────────────
  const ropeOffsets = [
    [0.8, 0.8],
    [-0.8, 0.8],
    [-0.8, -0.8],
    [0.8, -0.8],
  ];
  const ROPE_LENGTH = 5;
  const ROPE_BOTTOM_Y = 0.6;
  const ROPE_TOP_Y = DOME_Y_OFFSET;

  ropeOffsets.forEach(([ox, oz]) => {
    // Straight rope approximation
    const ropeGeo = new THREE.CylinderGeometry(0.03, 0.03, ROPE_LENGTH, 4);
    const ropeMat = new THREE.MeshLambertMaterial({ color: new THREE.Color("#d4a574") });
    const rope = new THREE.Mesh(ropeGeo, ropeMat);

    const midY = (ROPE_BOTTOM_Y + ROPE_TOP_Y) / 2;
    rope.position.set(ox * 0.5, midY, oz * 0.5);

    // Angle toward dome attachment
    const dx = ox * 0.5 - ox * 0.5;
    const dz = oz * 0.5 - oz * 0.5;
    const angle = Math.atan2(ox, oz);
    rope.rotation.z = angle * 0.15;

    ropeGroup.add(rope);
  });

  // ── Wooden Crate ──────────────────────────────────────────────────────────
  const CRATE_SIZE = 1.2;
  const crateGeo = new THREE.BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE);
  const crateMat = new THREE.MeshLambertMaterial({ color: new THREE.Color("#8B6914") });
  const crateMesh = new THREE.Mesh(crateGeo, crateMat);
  crateGroup.add(crateMesh);

  // Crate planks (horizontal and vertical lines)
  const plankMat = new THREE.MeshLambertMaterial({ color: new THREE.Color("#5a4010") });

  // Horizontal bands on each face
  const bandOffsets = [-0.28, 0, 0.28];
  const BAND_THICKNESS = 0.04;
  const BAND_DEPTH = 0.02;

  bandOffsets.forEach((yo) => {
    // Front/back bands
    const fbGeo = new THREE.BoxGeometry(CRATE_SIZE + BAND_DEPTH, BAND_THICKNESS, BAND_DEPTH);
    const fb1 = new THREE.Mesh(fbGeo, plankMat);
    fb1.position.set(0, yo, CRATE_SIZE / 2 + BAND_DEPTH / 2);
    crateGroup.add(fb1);
    const fb2 = new THREE.Mesh(fbGeo, plankMat);
    fb2.position.set(0, yo, -(CRATE_SIZE / 2 + BAND_DEPTH / 2));
    crateGroup.add(fb2);

    // Left/right bands
    const lrGeo = new THREE.BoxGeometry(BAND_DEPTH, BAND_THICKNESS, CRATE_SIZE + BAND_DEPTH);
    const lr1 = new THREE.Mesh(lrGeo, plankMat);
    lr1.position.set(CRATE_SIZE / 2 + BAND_DEPTH / 2, yo, 0);
    crateGroup.add(lr1);
    const lr2 = new THREE.Mesh(lrGeo, plankMat);
    lr2.position.set(-(CRATE_SIZE / 2 + BAND_DEPTH / 2), yo, 0);
    crateGroup.add(lr2);
  });

  // Metal corner reinforcements
  const cornerMat = new THREE.MeshLambertMaterial({ color: new THREE.Color("#4a4a4a") });
  const cornerPositions: [number, number, number][] = [
    [0.6, 0.6, 0.6], [0.6, 0.6, -0.6], [-0.6, 0.6, 0.6], [-0.6, 0.6, -0.6],
    [0.6, -0.6, 0.6], [0.6, -0.6, -0.6], [-0.6, -0.6, 0.6], [-0.6, -0.6, -0.6],
  ];
  cornerPositions.forEach(([cx, cy, cz]) => {
    const cGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const corner = new THREE.Mesh(cGeo, cornerMat);
    corner.position.set(cx, cy, cz);
    crateGroup.add(corner);
  });

  // Red cross marking on top face
  const crossMat = new THREE.MeshLambertMaterial({ color: new THREE.Color("#dc2626") });
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.18), crossMat);
  crossH.position.set(0, CRATE_SIZE / 2 + 0.01, 0);
  crateGroup.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.7), crossMat);
  crossV.position.set(0, CRATE_SIZE / 2 + 0.01, 0);
  crateGroup.add(crossV);

  return { group, parachuteGroup, ropeGroup, crateGroup };
}
