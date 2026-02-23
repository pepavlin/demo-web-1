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
