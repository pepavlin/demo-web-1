import * as THREE from "three";

// ─── Weapon system ────────────────────────────────────────────────────────────
export type WeaponType = "sword" | "bow" | "crossbow" | "sniper" | "axe" | "machinegun";

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
  /** Multiplier applied to damage when hitting trees (default 1 if omitted) */
  treeDamageMultiplier?: number;
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
  sniper: {
    type: "sniper",
    label: "Odstřelovačka",
    damage: 160,
    range: 400,
    cooldown: 2.8,
    bulletSpeed: 220,
    color: "#a78bfa",
  },
  axe: {
    type: "axe",
    label: "Sekera",
    damage: 45,
    range: 2.5,
    cooldown: 0.65,
    bulletSpeed: 0, // melee only — sekání
    color: "#a3e635",
    treeDamageMultiplier: 3, // 3× damage vs trees → 135 per swing
  },
  machinegun: {
    type: "machinegun",
    label: "Kulomet",
    damage: 18,
    range: 120,
    cooldown: 0.08, // ~12 shots/second — ultra-fast fire rate
    bulletSpeed: 150,
    color: "#f97316",
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
  /** Cached nearest sheep target — refreshed every ~0.25 s to avoid O(n²) per-frame search. */
  cachedNearestSheep: SheepData | null;
  /** Countdown until next nearest-sheep search. */
  sheepSearchTimer: number;
}

// ─── Spider system ─────────────────────────────────────────────────────────────

/** Three danger tiers of cave spiders. */
export type SpiderType = "small" | "medium" | "large";

/** Stats per spider type. */
export interface SpiderTypeConfig {
  maxHp: number;
  attackDamage: number;  // HP per second when in melee contact
  speed: number;         // world units per second
  attackRange: number;   // melee reach in world units
  attackCooldown: number;// seconds between attacks
  scale: number;         // mesh scale multiplier
  label: string;         // display name in Czech
}

export const SPIDER_TYPE_CONFIGS: Record<SpiderType, SpiderTypeConfig> = {
  small: {
    maxHp: 20,
    attackDamage: 5,
    speed: 4.5,
    attackRange: 1.8,
    attackCooldown: 0.8,
    scale: 0.45,
    label: "Malý pavouk",
  },
  medium: {
    maxHp: 50,
    attackDamage: 12,
    speed: 3.2,
    attackRange: 2.2,
    attackCooldown: 1.0,
    scale: 0.8,
    label: "Střední pavouk",
  },
  large: {
    maxHp: 100,
    attackDamage: 22,
    speed: 2.0,
    attackRange: 2.8,
    attackCooldown: 1.4,
    scale: 1.4,
    label: "Velký pavouk",
  },
};

export interface SpiderData {
  mesh: THREE.Group;
  type: SpiderType;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  attackCooldown: number;
  hitFlashTimer: number;
  wanderTimer: number;
  wanderAngle: number;
  /** World-space position of the cave this spider belongs to (used for territory boundary). */
  caveX: number;
  caveZ: number;
}

// ─── Treasure Chest ───────────────────────────────────────────────────────────

export interface TreasureChestData {
  mesh: THREE.Group;
  /** The lid sub-group — rotated open when player interacts. */
  lidGroup: THREE.Group;
  isOpened: boolean;
  /** World position — used for distance check. */
  x: number;
  z: number;
  /** Reward coins granted when opened. */
  rewardCoins: number;
}

// ─── Cave Torch ───────────────────────────────────────────────────────────────

export interface CaveTorchData {
  /** The visible torch mesh group. */
  mesh: THREE.Group;
  /** Point light attached to the flame. */
  light: THREE.PointLight;
  /** Base intensity — flickered randomly around this value. */
  baseIntensity: number;
  /** Accumulated flicker time for sin-based animation. */
  flickerTimer: number;
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
  /** When true, the arrow is embedded in the ground and no longer moves. */
  isStuck?: boolean;
  /** Countdown (seconds) before a stuck arrow is removed from the scene. */
  stuckLifetime?: number;
  /** Power multiplier used when the arrow was fired (0.1–1.0 for bow charge). */
  power?: number;
  /**
   * The weapon type that fired this bullet.
   * Stored at fire time so damage calculations remain correct even if the
   * player switches weapons while the projectile is in flight.
   */
  weaponType?: WeaponType;
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
  spidersDefeated: number;
  attackReady: boolean;
  woodCollected: number;
  /** Remaining cooldown fraction 0–1 (0 = ready to fire, 1 = just fired). Only meaningful when a ranged weapon is selected. */
  cooldownProgress: number;
}

// ─── Tree chopping system ──────────────────────────────────────────────────────

/** A choppable tree with hit points. Replaces the purely-static tree mesh. */
export interface TreeData {
  /** Root Three.js group rendered in the scene — same as what buildTreeMesh returns. */
  mesh: THREE.Group;
  /** Sub-group containing only the foliage — used for wind animation. */
  foliageGroup: THREE.Group;
  /** Current health. 0 → tree has been felled. */
  hp: number;
  /** Maximum health (varies by tree size). */
  maxHp: number;
  /** True while the fall animation is playing (hp = 0 but mesh still in scene). */
  isFalling: boolean;
  /** True once the fall animation has completed and the mesh is removed. */
  isChopped: boolean;
  /** Countdown from 0.25 s → 0 to drive the hit-flash on the trunk. */
  hitFlashTimer: number;
  /** Elapsed seconds since the fall started (drives fall-over animation). */
  fallTimer: number;
  /** Accumulated fall rotation (X axis) in radians. */
  fallRotationX: number;
  /** World X position (same as mesh.position.x — stored for distance checks). */
  x: number;
  /** World Z position (same as mesh.position.z). */
  z: number;
  /** Trunk collision radius (from buildTreeMesh). */
  trunkRadius: number;
  /** True for large trees that have collision — their entries must be removed from treeCollisionRef on chop. */
  hasCollision: boolean;
  /** Original trunk materials before hit-flash (for restoring colour). */
  trunkMeshes: THREE.Mesh[];
}

// ─── World Item (pickable / placeable objects) ─────────────────────────────

/** All types of objects that can be picked up and placed in the world. */
export type WorldItemType = "pumpkin" | "bomb";

/** A pickable/placeable object that exists in the 3D world. */
export interface WorldItem {
  /** Unique identifier (UUID). */
  id: string;
  type: WorldItemType;
  /** The root Three.js group rendered in the scene. */
  mesh: THREE.Group;
  /** True while the player is holding this item (mesh is hidden from world). */
  isHeld: boolean;
  /**
   * Optional callback invoked when a projectile (bullet or arrow) hits this item.
   * Return true to consume the projectile (remove it from the world).
   * Return false to let the projectile continue (pass-through).
   */
  onBulletHit?: (bullet: BulletData) => boolean;
}

/** Serialisable snapshot of a placed world item (for localStorage persistence). */
export interface PlacedWorldItemData {
  type: WorldItemType;
  x: number;
  y: number;
  z: number;
  /** Y-axis rotation in radians at the time of placement. */
  rotY: number;
}

// ─── Bomb projectile system ────────────────────────────────────────────────

/** A thrown bomb flying through the air toward the ground. */
export interface BombProjectileData {
  /** The visible bomb mesh in the scene. */
  mesh: THREE.Group;
  /** Current velocity vector (world space, units/s). */
  velocity: THREE.Vector3;
  /** Remaining fuse time in seconds before it auto-detonates. */
  fuseTimer: number;
  /** True once the explosion has been triggered (prevents double-explosion). */
  exploded: boolean;
}

// ─── Rocket system ─────────────────────────────────────────────────────────
export type RocketState = 'idle' | 'boarded' | 'countdown' | 'launching' | 'arrived' | 'docked';

export interface RocketData {
  /** Root group for the whole rocket (body + nose + fins + nozzle + window + ladder) */
  mesh: THREE.Group;
  /** The flame/exhaust group — hidden when idle, shown during launch */
  flameGroup: THREE.Group;
  /** The launch pad platform on which the rocket stands */
  launchPadMesh: THREE.Group;
  /** Current flight phase */
  state: RocketState;
  /**
   * Progress of the launch flight, 0 = on pad, 1 = at mothership.
   * Driven by elapsed seconds during 'launching' state.
   */
  launchProgress: number;
  /** World-space Y coordinate of the launch pad (ground position) */
  groundY: number;
  /** World X of the actual (above-water) spawn position */
  spawnX: number;
  /** World Z of the actual (above-water) spawn position */
  spawnZ: number;
  /** Countdown value (3 → 2 → 1 → 0) shown to the player before lift-off */
  countdown: number;
  /** Accumulator for the countdown timer (seconds between ticks) */
  countdownTimer: number;
  /** Particle meshes for exhaust smoke/fire effect */
  exhaustParticles: THREE.Mesh[];
}

// ─── Airplane system ────────────────────────────────────────────────────────
export type AirplaneState = 'idle' | 'boarded' | 'flying';

export interface AirplaneData {
  /** Root group for the whole airplane. Rotated to match pitch/roll/yaw. */
  mesh: THREE.Group;
  /** Propeller mesh that spins during flight */
  propeller: THREE.Mesh;
  /** Current boarding/flight state */
  state: AirplaneState;
  /** World-space position of the airplane */
  position: THREE.Vector3;
  /** Current flight velocity vector (world space, units/s) */
  velocity: THREE.Vector3;
  /** Pitch angle in radians (nose up = positive) */
  pitch: number;
  /** Yaw angle in radians */
  yaw: number;
  /** Roll angle in radians (banking) */
  roll: number;
  /** Current forward airspeed (units/s) */
  speed: number;
  /** Terrain Y at the spawn point (for landing reference) */
  groundY: number;
  /** World X of the airstrip spawn */
  spawnX: number;
  /** World Z of the airstrip spawn */
  spawnZ: number;
}
