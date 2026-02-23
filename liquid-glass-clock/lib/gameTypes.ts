import * as THREE from "three";

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
