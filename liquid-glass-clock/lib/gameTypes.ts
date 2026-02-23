import * as THREE from "three";

// ─── Weapon system ────────────────────────────────────────────────────────────
export type WeaponType = "pistol" | "sword" | "sniper";

export interface WeaponConfig {
  type: WeaponType;
  /** Display name shown in the HUD */
  label: string;
  /** Melee hit damage (and bullet damage) */
  damage: number;
  /** Melee attack range in world units */
  range: number;
  /** Seconds between attacks */
  cooldown: number;
  /** Bullet travel speed (units/s); 0 means melee-only (no bullet spawned) */
  bulletSpeed: number;
  /** CSS accent color for UI elements */
  color: string;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
  pistol: {
    type: "pistol",
    label: "Pistole",
    damage: 25,
    range: 5,
    cooldown: 0.65,
    bulletSpeed: 55,
    color: "#6ee7b7",
  },
  sword: {
    type: "sword",
    label: "Meč",
    damage: 50,
    range: 4.5,
    cooldown: 0.38,
    bulletSpeed: 0, // melee only
    color: "#fbbf24",
  },
  sniper: {
    type: "sniper",
    label: "Sniperka",
    damage: 90,
    range: 8,
    cooldown: 2.0,
    bulletSpeed: 130,
    color: "#f87171",
  },
};

export interface SheepData {
  mesh: THREE.Group;
  velocity: THREE.Vector2;
  targetAngle: number;
  currentAngle: number; // smoothed angle used for movement & rotation
  wanderTimer: number;
  isFleeing: boolean;
  bleating: boolean;
  bleatTimer: number;

  // ── Animation state ────────────────────────────────────────────────────────
  /** Accumulated walk phase in radians — drives all limb animations. */
  walkPhase: number;
  /** Phase offset unique to this sheep so they don't all move in sync. */
  phaseOffset: number;
  /** Pivot groups for each leg: [front-right, front-left, back-right, back-left] */
  legPivots: THREE.Group[];
  /** Head group — rotate to nod / graze */
  headGroup: THREE.Group;
  /** Body group wrapper — bounces vertically */
  bodyGroup: THREE.Group;
  /** Tail group — wag left/right */
  tailGroup: THREE.Group;

  // ── Grazing ────────────────────────────────────────────────────────────────
  isGrazing: boolean;
  /** Countdown until next grazing state change (seconds). */
  grazingTimer: number;
  /** Smooth interpolation target for head pitch during grazing. */
  headPitchTarget: number;
  /** Current head pitch (smoothed). */
  headPitchCurrent: number;
}

export interface FoxData {
  mesh: THREE.Group;
  wanderTimer: number;
  wanderAngle: number;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  attackCooldown: number;
  hitFlashTimer: number;
}

export interface CoinData {
  mesh: THREE.Mesh;
  collected: boolean;
}

export interface BulletData {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number; // seconds remaining before despawn
}

export interface GameState {
  sheepCollected: number;
  coinsCollected: number;
  totalCoins: number;
  timeElapsed: number;
  isLocked: boolean;
  stamina: number;
  timeLabel: string;
  direction: string;
  playerHp: number;
  foxesDefeated: number;
  attackReady: boolean;
}
