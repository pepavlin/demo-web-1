import * as THREE from "three";

// ─── Weapon system ────────────────────────────────────────────────────────────
export type WeaponType = "sword" | "bow" | "crossbow";

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
  sword: {
    type: "sword",
    label: "Meč",
    damage: 55,
    range: 2.2,
    cooldown: 0.45,
    bulletSpeed: 0, // melee only – šermování
    color: "#fbbf24",
  },
  bow: {
    type: "bow",
    label: "Luk",
    damage: 40,
    range: 80,
    cooldown: 1.1,
    bulletSpeed: 38,
    color: "#86efac",
  },
  crossbow: {
    type: "crossbow",
    label: "Kuše",
    damage: 85,
    range: 100,
    cooldown: 2.2,
    bulletSpeed: 90,
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

  // ── Combat ─────────────────────────────────────────────────────────────────
  hp: number;
  maxHp: number;
  /** False once the death animation finishes and the mesh is removed. */
  isAlive: boolean;
  /** Counts down from 0.25 s → 0 to drive the red hit flash. */
  hitFlashTimer: number;
  /** True while the death animation is playing. */
  isDying: boolean;
  /** Elapsed seconds since death was triggered. */
  deathTimer: number;
  /** Accumulated Y rotation during death spin. */
  deathRotationY: number;
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
  /** The visual mesh/group for this projectile. */
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  lifetime: number; // seconds remaining before despawn
  /** When true, gravity is applied each frame (bow arrows fly in an arc). */
  useGravity?: boolean;
}

export interface CatapultData {
  mesh: THREE.Group;
  /** The rotating arm group — pivots around the X axis on fire. */
  armGroup: THREE.Group;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  /** Countdown in seconds until the catapult can fire again. */
  fireCooldown: number;
  /** Flash red on hit; counts down to 0. */
  hitFlashTimer: number;
  /** 0 = rest position, increases to 1 on fire then resets (arm swing animation). */
  firingAnimation: number;
}

export interface CannonballData {
  mesh: THREE.Mesh;
  /** Flat shadow disc projected to terrain below the ball */
  shadowMesh: THREE.Mesh;
  velocity: THREE.Vector3;
  lifetime: number; // seconds remaining before despawn
}

/** A single blood splatter particle spawned on sheep death. */
export interface BloodParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  /** Remaining lifetime in seconds. */
  lifetime: number;
  /** Original lifetime (used to compute fade ratio). */
  maxLifetime: number;
}

/** A brief impact explosion ring that expands and fades on cannonball landing. */
export interface ImpactEffect {
  /** Flat ring mesh that scales outward */
  ring: THREE.Mesh;
  /** Upward-smoke group containing several small particles */
  particles: THREE.Mesh[];
  age: number;     // seconds elapsed
  maxAge: number;  // total life in seconds
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
  catapultsDefeated: number;
  attackReady: boolean;
}
