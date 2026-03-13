"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  getTerrainHeight,
  getTerrainHeightSampled,
  generateSpawnPoints,
  initNoise,
  modifyTerrainHeight,
  updateTerrainGeometry,
  WORLD_SIZE,
  TERRAIN_SEGMENTS,
  WATER_LEVEL,
} from "@/lib/terrainUtils";
import { createTerrainTexture } from "@/lib/terrainTextures";
import {
  BlockMaterial,
  BuildMode,
  BuildingUiState,
  PlacedBlockData,
  BLOCK_DEFS,
  BLOCK_MATERIAL_ORDER,
  BUILD_RANGE,
  SCULPT_RADIUS,
  SCULPT_STRENGTH,
  MAX_BLOCKS,
} from "@/lib/buildingTypes";
import {
  buildBlockMesh,
  buildGhostMesh,
  buildSculptIndicator,
  updateGhostMaterial,
  getPlacementPosition,
  blockKey,
  saveBlocks,
  loadBlocks,
  saveWorldItems,
  loadWorldItems,
} from "@/lib/buildingSystem";
import {
  buildSheepMesh,
  buildFoxMesh,
  buildTreeMesh,
  buildBushMesh,
  buildRockMesh,
  buildCoinMesh,
  buildWindmill,
  buildHouse,
  buildRuins,
  buildLighthouse,
  buildBulletMesh,
  buildArrowProjectileMesh,
  buildSwordMesh,
  buildBowMesh,
  buildCrossbowMesh,
  buildBoatMesh,
  buildCatapultMesh,
  buildMotherShipMesh,
  buildRocketMesh,
  buildSpaceStationInterior,
  buildPumpkinMesh,
  buildBombMesh,
  buildSpiderMesh,
  buildCaveMesh,
  buildTorchMesh,
  buildTreasureChestMesh,
  buildAirplane3DMesh,
  buildAirstripMesh,
  buildAirstripSignMesh,
  buildMountainWithWaterfallAndCave,
  type CityResult,
  type SpaceStationInteriorResult,
  type SheepMeshParts,
  type RuinsResult,
} from "@/lib/meshBuilders";
import type { SheepData, FoxData, CoinData, BulletData, CatapultData, CannonballData, ImpactEffect, GameState, WeaponType, BloodParticle, RocketData, AirplaneData, WorldItem, PlacedWorldItemData, WorldItemType, SpiderData, TreasureChestData, CaveTorchData, BombProjectileData } from "@/lib/gameTypes";
import {
  buildHarborDockMesh,
  buildSailboatMesh,
  findHarborPosition,
  SAILBOAT_MAX_SPEED,
  SAILBOAT_ACCEL,
  SAILBOAT_BRAKE,
  SAILBOAT_TURN_SPEED,
  SAILBOAT_BOARD_RADIUS,
  SAILBOAT_CAM_HEIGHT,
  SAILBOAT_CAM_DIST,
  type HarborShipData,
} from "@/lib/harborSystem";
import { WEAPON_CONFIGS, SPIDER_TYPE_CONFIGS, type SpiderType } from "@/lib/gameTypes";
import { soundManager } from "@/lib/soundManager";
import {
  type WeatherState,
  WEATHER_CONFIGS,
  nextWeatherState,
  randomDuration,
  lerpWeatherConfig,
  generateLightningPath,
} from "@/lib/weatherSystem";
import { useMultiplayer, type PlayerUpdate } from "@/hooks/useMultiplayer";
import WeaponSelect from "./WeaponSelect";
import MobileControls from "./MobileControls";
import ChatPanel from "./ChatPanel";

// ─── Mobile detection ────────────────────────────────────────────────────────
// Evaluated once at module initialisation on the client.  Returns false during
// SSR (window is undefined) — the game is fully client-side so that's fine.
const IS_MOBILE =
  typeof window !== "undefined" &&
  (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

// ─── Constants ──────────────────────────────────────────────────────────────
const PLAYER_HEIGHT = 1.8;
const MOVE_SPEED = 6;
const SPRINT_SPEED = 12;
const GRAVITY = -25;
const JUMP_FORCE = 10;
// World-population counts — reduced on mobile to stay within memory budget
const SHEEP_COUNT = IS_MOBILE ? 40 : 200;
const FOX_COUNT   = IS_MOBILE ? 4  : 12;
const COIN_COUNT  = IS_MOBILE ? 20 : 35;
const TREE_COUNT  = IS_MOBILE ? 70 : 180;
const BUSH_COUNT  = IS_MOBILE ? 80 : 220;
const ROCK_COUNT  = IS_MOBILE ? 35 : 90;
const PLAYER_RADIUS = 0.5; // for tree trunk collision
const SHEEP_SPEED = 1.4;       // slow peaceful walk (was 2.5)
const SHEEP_FLEE_RADIUS = 12;
const SHEEP_FLEE_SPEED = 7;
const SHEEP_TURN_SPEED = 2.2;  // gentle turning (was 3.5)
const SHEEP_STEP_FREQ = 3.8;   // step cycles per unit of distance travelled
const SHEEP_LEG_SWING = 0.52;  // max leg swing amplitude (radians) when walking
const SHEEP_LEG_SWING_FLEE = 0.78; // wider swing when fleeing
const FOX_SPEED = 3.8;
const FOX_CHASE_RADIUS = 90;
const COIN_COLLECT_RADIUS = 2.2;
const FOG_NEAR = 60;
const FOG_FAR = 320;
const DAY_DURATION = 300; // seconds per full day/night cycle
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 22; // per second while sprinting
const STAMINA_REGEN = 9; // per second while walking/idle

// ─── Combat Constants ─────────────────────────────────────────────────────────
const PLAYER_MAX_HP = 100;
const FOX_MAX_HP = 60;
const COIN_HEAL_AMOUNT = 20; // HP restored when collecting a coin

// ─── Catapult Constants ────────────────────────────────────────────────────────
const CATAPULT_COUNT = 6;
const CATAPULT_MAX_HP = 180;
const CATAPULT_FIRE_RANGE = 90;    // fires cannonballs when player is within this distance
const CATAPULT_FIRE_COOLDOWN = 4;  // seconds between shots
const CATAPULT_HIT_RADIUS = 2.8;   // for player bullet collisions vs catapult body

// ─── Cannonball Constants ─────────────────────────────────────────────────────
const CANNONBALL_SPEED = 22;       // units/s launch speed
const CANNONBALL_DAMAGE = 28;      // damage dealt to player on hit
const CANNONBALL_LIFETIME = 8;     // seconds before auto-despawn
const CANNONBALL_HIT_RADIUS = 1.6; // sphere radius for player collision
const CANNONBALL_GRAVITY = -14;    // vertical acceleration (lofted arc)
const CANNONBALL_SHADOW_MAX_SCALE = 3.2; // ground-shadow disc max diameter
const IMPACT_EFFECT_DURATION = 0.45;     // seconds the impact explosion ring lasts

// ─── Bullet / Weapon Constants ────────────────────────────────────────────────
// Per-weapon values come from WEAPON_CONFIGS; these are shared constants:
const BULLET_LIFETIME = 4;      // seconds before auto-despawn
const BULLET_HIT_RADIUS = 1.4;  // sphere radius for fox collision
const ARROW_GRAVITY = -22;      // downward acceleration (units/s²) for bow arrows
// Default weapon position in camera-local space (sword)
const WEAPON_POS = new THREE.Vector3(0.24, -0.21, -0.48);

// ─── Bomb Constants ───────────────────────────────────────────────────────────
/** Initial throw speed in world units/s. */
const BOMB_THROW_SPEED = 14;
/** Gravity applied to the bomb projectile (units/s²). */
const BOMB_GRAVITY = -18;
/** Fuse duration after throwing — bomb detonates even in mid-air (seconds). */
const BOMB_FUSE_DURATION = 4.5;
/** World-space crater radius in units. */
const BOMB_CRATER_RADIUS = 6;
/** Maximum crater depth at centre (world units deformed down). */
const BOMB_CRATER_DEPTH = -2.8;
/** Damage radius for entities caught in the blast. */
const BOMB_BLAST_RADIUS = 9;
/** Damage dealt to entities in the blast. */
const BOMB_BLAST_DAMAGE = 70;
/** Fixed world position of the bomb spawn on the ruins island. */
const BOMB_SPAWN_X = 176;
const BOMB_SPAWN_Z = -113;

// ─── Possession Constants ─────────────────────────────────────────────────────
const POSSESS_RADIUS = 3.5; // units — show [E] prompt within this distance
const POSSESS_CAM_HEIGHT = 0.9; // camera height above sheep mesh origin when possessed

// ─── Lighthouse Constants ─────────────────────────────────────────────────────
const LIGHTHOUSE_X = -95;       // world X coordinate — accessible northwest coastal rise
const LIGHTHOUSE_Z = 85;        // world Z coordinate — within playable boundary (±123.5)

// ─── Mountain Constants ────────────────────────────────────────────────────────
/** World-space centre of the mountain with waterfall and cave (southwest quadrant) */
const MOUNTAIN_X = -60;
const MOUNTAIN_Z = -80;

// ─── Boat Constants ───────────────────────────────────────────────────────────
const BOAT_BOARD_RADIUS = 5;    // units — show [E] board prompt within this distance
const BOAT_SPEED = 8;           // units/second when sailing
const BOAT_CAM_HEIGHT = 2.6;    // camera height above waterline when on boat

// ─── Harbor Constants ─────────────────────────────────────────────────────────
const HARBOR_SEARCH_DIST = 88;  // radius from world center to search for coastline

// ─── Rocket Constants ─────────────────────────────────────────────────────────
const ROCKET_BOARD_RADIUS = 8;     // units — show boarding prompt within this distance
const ROCKET_CAM_HEIGHT = 6.0;     // camera height inside rocket (above ground level)
/** World-space X,Z of the launch pad — aligned roughly toward the mothership at (0, y, -60) */
const ROCKET_SPAWN_X = 8;
const ROCKET_SPAWN_Z = -28;
/** Target altitude — matches mothership base at Y ≈ 170 */
const ROCKET_TARGET_Y = 165;
/** How many seconds the full launch flight takes */
const ROCKET_FLIGHT_DURATION = 12;

// ─── Space Station Constants ───────────────────────────────────────────────────
/** World-space Y at which the station interior group is placed (far above exterior, fully fogged). */
const SPACE_STATION_WORLD_Y = 2000;
const SPACE_STATION_WORLD_X = 0;
const SPACE_STATION_WORLD_Z = 0;

// ─── Airplane Constants ────────────────────────────────────────────────────────
/** World-space X of the airstrip centre */
const AIRPLANE_SPAWN_X = 50;
/** World-space Z of the airstrip centre */
const AIRPLANE_SPAWN_Z = 20;
/** Boarding proximity radius */
const AIRPLANE_BOARD_RADIUS = 8;
/** Camera height above airplane origin when in cockpit (1st person) */
const AIRPLANE_CAM_HEIGHT = 1.0;
/** Camera distance behind airplane in 3rd-person follow mode */
const AIRPLANE_CAM_DIST = 14;
/** Camera height above airplane in 3rd-person */
const AIRPLANE_CAM_HEIGHT_TP = 4;
/** Cruise speed (units/s) */
const AIRPLANE_CRUISE_SPEED = 28;
/** Max speed with afterburner (Shift) */
const AIRPLANE_MAX_SPEED = 55;
/** Minimum flying speed before stall begins */
const AIRPLANE_STALL_SPEED = 8;
/** Acceleration per second when throttle pressed */
const AIRPLANE_ACCEL = 12;
/** Deceleration per second when no throttle */
const AIRPLANE_DECEL = 6;
/** Pitch/roll/yaw turn rates (radians per second) */
const AIRPLANE_PITCH_RATE = 0.9;
const AIRPLANE_ROLL_RATE  = 1.2;
const AIRPLANE_YAW_RATE   = 0.5;
/** Max pitch angle (radians) — prevent full loop */
const AIRPLANE_MAX_PITCH = Math.PI * 0.45;
/** Max roll angle */
const AIRPLANE_MAX_ROLL  = Math.PI * 0.65;
/** Gravity effect on stalled airplane */
const AIRPLANE_STALL_GRAVITY = -12;
/** How high above terrain the airplane starts (so it takes off cleanly) */
const AIRPLANE_START_HEIGHT = 2.0;

// ─── Cave Constants ────────────────────────────────────────────────────────────
/** Fixed world-space position of the cave entrance centre. */
const CAVE_X = -95;
const CAVE_Z = -85;
/** Distance from cave centre within which spiders become aggressive. */
const SPIDER_AGGRO_RADIUS = 28;
/** Spiders stay within this radius of cave centre (territory boundary). */
const CAVE_TERRITORY_RADIUS = 35;
/** Spider counts per type (desktop / mobile). */
const SPIDER_COUNTS: Record<SpiderType, [number, number]> = {
  small:  [5, 2],
  medium: [3, 1],
  large:  [2, 1],
};
/** Coins awarded when the treasure chest is opened. */
const CHEST_REWARD_COINS = 20;
/** How close the player must be to open the chest. */
const CHEST_OPEN_RADIUS = 2.5;
/** Torch flicker speed multiplier. */
const TORCH_FLICKER_SPEED = 4.5;

// ─── Swim Constants ───────────────────────────────────────────────────────────
const SWIM_SPEED = 5.5;         // units/second when swimming in water
const DIVE_SPEED = 5.0;         // units/second when actively diving down (Ctrl)
const SWIM_RISE_SPEED = 6.0;    // units/second when actively swimming up (Space)
const SWIM_BUOYANCY = 5.0;      // upward drift speed per second (natural buoyancy when submerged)

// ─── World Item (pickup / placement) Constants ────────────────────────────────
/** Radius within which the player can pick up a world item (press E). */
const PICKUP_RADIUS = 2.8;
/** Default number of pumpkins spawned in the world at game start. */
const PUMPKIN_COUNT = IS_MOBILE ? 3 : 6;
/** Camera-local position of the held-item mesh (right-hand, lower screen). */
const HELD_ITEM_POS = new THREE.Vector3(0.28, -0.30, -0.55);

// ─── Third-person Camera Constants ───────────────────────────────────────────
const TP_DISTANCE = 6;   // camera distance behind player in 3rd-person view
const TP_HEIGHT   = 2.5; // camera height above player in 3rd-person view

// ─── Weather Constants ────────────────────────────────────────────────────────
const RAIN_DROP_COUNT = IS_MOBILE ? 1200 : 4500; // rain particles
const RAIN_SPEED = 55;              // units/sec fall speed
const RAIN_SPREAD = 280;            // horizontal spread radius
const RAIN_HEIGHT_RANGE = 90;       // rain spawns between RAIN_Y_MIN and +HEIGHT_RANGE
const RAIN_Y_MIN = -5;              // rain resets to top when below this Y
const LIGHTNING_FLASH_DURATION = 0.18; // seconds the white flash lasts
const WEATHER_TRANSITION_SPEED = 0.35; // lerp speed for weather blending (per second)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDirection(yaw: number): string {
  const deg = (((-yaw * 180) / Math.PI) % 360 + 360) % 360;
  if (deg < 22.5 || deg >= 337.5) return "S";
  if (deg < 67.5) return "SW";
  if (deg < 112.5) return "W";
  if (deg < 157.5) return "NW";
  if (deg < 202.5) return "N";
  if (deg < 247.5) return "NE";
  if (deg < 292.5) return "E";
  return "SE";
}

function getTimeLabel(dayFraction: number): string {
  const totalMinutes = Math.floor(dayFraction * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t
  );
}

function smoothstep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

// ─── Sky color palette by time of day (0..1) ─────────────────────────────────
const SKY_NIGHT = new THREE.Color(0x04091f);
const SKY_DAWN = new THREE.Color(0xf07030);
const SKY_DAY = new THREE.Color(0x87ceeb);
const SKY_DUSK = new THREE.Color(0xe05030);

function getSkyColor(t: number): THREE.Color {
  // t: 0=midnight, 0.25=sunrise, 0.5=noon, 0.75=sunset, 1=midnight
  if (t < 0.2) return lerpColor(SKY_NIGHT, SKY_DAWN, smoothstep(0.15, 0.22, t));
  if (t < 0.3) return lerpColor(SKY_DAWN, SKY_DAY, smoothstep(0.22, 0.32, t));
  if (t < 0.65) return SKY_DAY;
  if (t < 0.75) return lerpColor(SKY_DAY, SKY_DUSK, smoothstep(0.65, 0.75, t));
  if (t < 0.85) return lerpColor(SKY_DUSK, SKY_NIGHT, smoothstep(0.75, 0.85, t));
  return SKY_NIGHT;
}

function getSunIntensity(t: number): number {
  if (t < 0.18 || t > 0.82) return 0;
  if (t < 0.25) return smoothstep(0.18, 0.28, t) * 1.4;
  if (t > 0.75) return smoothstep(0.82, 0.72, t) * 1.4;
  return 1.4;
}

function getAmbientIntensity(t: number): number {
  if (t < 0.18 || t > 0.82) return 0.08;
  return 0.08 + smoothstep(0.18, 0.35, t) * 0.45;
}


// ─── Remote player mesh builder ───────────────────────────────────────────────
function buildRemotePlayerMesh(color: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), mat);
  body.position.y = 0;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
  head.position.y = 0.58;
  group.add(head);

  // Legs (named so they can be animated)
  const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6);
  const legL = new THREE.Mesh(legGeo, mat);
  legL.name = "legL";
  legL.position.set(0.13, -0.6, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, mat);
  legR.name = "legR";
  legR.position.set(-0.13, -0.6, 0);
  group.add(legR);

  // Arms (named for animation)
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

  return group;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Game3D({ playerName = "Hráč" }: { playerName?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const sheepListRef = useRef<SheepData[]>([]);
  const foxListRef = useRef<FoxData[]>([]);
  const coinsRef = useRef<CoinData[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const playerRef = useRef({ velY: 0, onGround: false });
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const prevTimeRef = useRef(performance.now());
  const isLockedRef = useRef(false);
  const staminaRef = useRef(STAMINA_MAX);
  const dayTimeRef = useRef(DAY_DURATION * 0.3); // start mid-morning
  const coinsCollectedRef = useRef(0);
  const windmillBladesRef = useRef<THREE.Group | null>(null);
  const lighthouseBeamRef = useRef<THREE.Group | null>(null);
  const lighthouseLightRef = useRef<THREE.PointLight | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const moonRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const galaxyRef = useRef<THREE.Points | null>(null);
  const skyMeshRef = useRef<THREE.Mesh | null>(null);
  // Sun visuals
  const sunDiscRef = useRef<THREE.Mesh | null>(null);
  const sunCoronaRef = useRef<THREE.Mesh | null>(null);
  const cloudsRef = useRef<Array<{ mesh: THREE.Group; vx: number; vz: number }>>([]);
  const grassMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const waterMatRef = useRef<THREE.ShaderMaterial | null>(null);
  // Flora animation & collision data
  const floraRef = useRef<Array<{
    foliageGroup: THREE.Group;
    rootMesh: THREE.Object3D; // top-level scene group — toggled for LOD visibility
    windPhase: number;     // per-plant phase offset so they sway out-of-sync
    windSpeed: number;     // 0.6–1.4 rad/s
    maxSway: number;       // max rotation amplitude (radians)
    posX: number;          // world X for LOD distance check
    posZ: number;          // world Z for LOD distance check
  }>>([]);
  const treeCollisionRef = useRef<Array<{
    x: number; z: number;
    radius: number;        // trunk radius + small buffer
  }>>([]);
  /** Box colliders for landmarks (house, ruins walls).
   *  halfW / halfD are local half-extents; rotY is the world-space rotation. */
  const boxCollidersRef = useRef<Array<{
    cx: number; cz: number;
    halfW: number; halfD: number;
    rotY: number;
  }>>([]);

  // ─── Combat Refs ────────────────────────────────────────────────────────────
  const playerHpRef = useRef(PLAYER_MAX_HP);
  const playerAttackCooldownRef = useRef(0);
  const foxesDefeatedRef = useRef(0);
  const catapultsDefeatedRef = useRef(0);
  const isMouseHeldRef = useRef(false); // true while left mouse button is held down

  // ─── Bow charging Refs ───────────────────────────────────────────────────────
  /** True while the player holds left mouse with the bow selected. */
  const isBowChargingRef = useRef(false);
  /** performance.now() timestamp when the bow draw started. */
  const bowChargeStartRef = useRef(0);
  /** Current charge level 0–1 (updated every frame). */
  const bowChargeRef = useRef(0);
  /** DOM ref for the charge bar element — manipulated directly to avoid React re-renders. */
  const bowChargeBarRef = useRef<HTMLDivElement | null>(null);
  /** Maximum hold time (seconds) to reach full power. */
  const BOW_MAX_CHARGE_TIME = 1.5;
  /** Line2 that shows the predicted arrow trajectory arc while drawing. */
  const trajectoryArcRef = useRef<Line2 | null>(null);

  // ─── Weapon / Bullet Refs ───────────────────────────────────────────────────
  const bulletsRef = useRef<BulletData[]>([]);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const weaponRecoilRef = useRef(0); // 1 = just fired, decays to 0
  const swordSwingTimerRef = useRef(9999); // seconds since last sword swing; 9999 = idle (no swing)
  const muzzleFlashRef = useRef<THREE.PointLight | null>(null);

  // ─── Catapult / Cannonball Refs ──────────────────────────────────────────────
  const catapultListRef = useRef<CatapultData[]>([]);
  const cannonballsRef = useRef<CannonballData[]>([]);
  const impactEffectsRef = useRef<ImpactEffect[]>([]);

  // ─── Bomb Refs ────────────────────────────────────────────────────────────────
  const bombProjectilesRef = useRef<BombProjectileData[]>([]);

  // ─── Cave / Spider / Chest Refs ───────────────────────────────────────────────
  const spiderListRef = useRef<SpiderData[]>([]);
  const caveTorchesRef = useRef<CaveTorchData[]>([]);
  const treasureChestRef = useRef<TreasureChestData | null>(null);
  const spidersDefeatedRef = useRef(0);

  // ─── Blood Particle Refs ──────────────────────────────────────────────────────
  const bloodParticlesRef = useRef<BloodParticle[]>([]);

  // ─── Sound Refs ─────────────────────────────────────────────────────────────
  const footstepTimerRef = useRef(0);
/** Countdown (seconds) until the next water-ambient snippet plays. */
  const waterAmbienceTimerRef = useRef(0);

  // ─── Pause Refs ──────────────────────────────────────────────────────────────
  /** True once the pointer has been locked at least once (game started). */
  const gameEverStartedRef = useRef(false);
  /** Stored reference to restart the rAF loop after a pause. */
  const restartAnimLoopRef = useRef<(() => void) | null>(null);

  // ─── Building / Terrain Sculpt Refs ──────────────────────────────────────────
  const buildModeRef = useRef<BuildMode>("explore");
  const selectedMaterialRef = useRef<BlockMaterial>("wood");
  const placedBlockMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const placedBlocksDataRef = useRef<PlacedBlockData[]>([]);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const terrainMatRef = useRef<THREE.ShaderMaterial | null>(null);
  const sculptIndicatorRef = useRef<THREE.Mesh | null>(null);
  const buildRaycasterRef = useRef(new THREE.Raycaster());

  // ─── World Items (pickable / placeable objects) ───────────────────────────────
  /** All world item instances currently in the scene (including held ones). */
  const worldItemsRef = useRef<WorldItem[]>([]);
  /** The item the player is currently holding (null if empty-handed). */
  const heldItemRef = useRef<WorldItem | null>(null);
  /** Camera-space mesh shown in first-person when holding an item. */
  const heldItemHandMeshRef = useRef<THREE.Group | null>(null);
  /** Ghost preview mesh for item placement targeting. */
  const itemPlacementGhostRef = useRef<THREE.Group | null>(null);
  /** Nearest pickable item within PICKUP_RADIUS (updated per frame). */
  const nearestPickableItemRef = useRef<WorldItem | null>(null);

  // ─── Possession Refs ─────────────────────────────────────────────────────────
  const possessedSheepRef = useRef<SheepData | null>(null);
  const nearestSheepForPossessRef = useRef<SheepData | null>(null);
  const highlightedSheepRef = useRef<SheepData | null>(null);

  // ─── Weather Refs ────────────────────────────────────────────────────────────
  const rainRef = useRef<THREE.Points | null>(null);
  const lightningBoltRef = useRef<THREE.Line | null>(null);
  /** Current active weather state */
  const weatherStateRef = useRef<WeatherState>("sunny");
  /** Previous weather state (used for lerping) */
  const weatherPrevStateRef = useRef<WeatherState>("sunny");
  /** Blend factor: 0 = previous state, 1 = current state */
  const weatherBlendRef = useRef(1);
  /** Countdown in seconds until next weather transition */
  const weatherTimerRef = useRef(randomDuration("sunny"));
  /** Countdown until next lightning strike (only during storms) */
  const lightningTimerRef = useRef(0);
  /** Flash opacity 0–1; decays to 0 quickly after lightning */
  const lightningFlashRef = useRef(0);

  // ─── MotherShip Refs ─────────────────────────────────────────────────────────
  const motherShipRef = useRef<THREE.Group | null>(null);
  const motherShipLightsRef = useRef<THREE.PointLight[]>([]);

  // ─── Boat Refs ───────────────────────────────────────────────────────────────
  const boatRef = useRef<THREE.Group | null>(null);
  const onBoatRef = useRef(false);
  const nearBoatForBoardRef = useRef(false);

  // ─── Harbor Refs ─────────────────────────────────────────────────────────────
  const harborDockRef = useRef<THREE.Group | null>(null);
  const harborShipsRef = useRef<HarborShipData[]>([]);
  const activeHarborShipRef = useRef<HarborShipData | null>(null);
  const nearHarborShipRef = useRef<HarborShipData | null>(null);

  // ─── Rocket Refs ─────────────────────────────────────────────────────────────
  const rocketDataRef = useRef<RocketData | null>(null);
  const onRocketRef = useRef(false);
  const nearRocketForBoardRef = useRef(false);
  const rocketArrivedRef = useRef(false);

  // ─── Airplane Refs ────────────────────────────────────────────────────────────
  const airplaneDataRef = useRef<AirplaneData | null>(null);
  const onAirplaneRef = useRef(false);
  const nearAirplaneForBoardRef = useRef(false);

  // ─── Space Station Refs ───────────────────────────────────────────────────────
  const spaceStationGroupRef = useRef<THREE.Group | null>(null);
  const spaceStationRoomsRef = useRef<THREE.Box3[]>([]);
  const spaceStationLightsRef = useRef<SpaceStationInteriorResult['lights']>([]);
  const spaceStationAnimMeshesRef = useRef<SpaceStationInteriorResult['animatedMeshes']>([]);
  const inSpaceStationRef = useRef(false);

  // ─── Scene Group Refs (for two-scene separation) ──────────────────────────────
  // Earth scene group contains all world objects; toggled invisible when in station.
  // This eliminates rendering ~300+ Earth objects while inside the space station.
  const earthSceneGroupRef = useRef<THREE.Group | null>(null);

  // ─── Camera Mode Refs ────────────────────────────────────────────────────────
  const cameraModeRef = useRef<"first" | "third">("first");
  const [cameraMode, setCameraMode] = useState<"first" | "third">("first");
  /** Logical player body position (separate from camera position in 3rd-person). */
  const playerBodyPosRef = useRef(new THREE.Vector3());
  /** Visible player body mesh shown in 3rd-person mode. */
  const playerBodyRef = useRef<THREE.Group | null>(null);
  /** Walk phase for 3rd-person body animation. */
  const playerBodyLegPhaseRef = useRef(0);

  // ─── Selected weapon (persisted via ref for use inside animation loop) ───────
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponType>("sword");
  const selectedWeaponRef = useRef<WeaponType>("sword");

  // ─── Third-Person Camera Refs ────────────────────────────────────────────────
  const thirdPersonRef    = useRef(false);
  const playerBodyMeshRef = useRef<THREE.Group | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [lightningFlash, setLightningFlash] = useState(0); // 0–1 opacity
  const [weatherLabel, setWeatherLabel] = useState<string>("☀️ Jasno");
  const [buildingUiState, setBuildingUiState] = useState<BuildingUiState>({
    mode: "explore",
    selectedMaterial: "wood",
    blockCount: 0,
  });
  const [nearItemPrompt, setNearItemPrompt] = useState<WorldItemType | null>(null);
  const [heldItemType, setHeldItemType] = useState<WorldItemType | null>(null);
  const [nearSheepPrompt, setNearSheepPrompt] = useState(false);
  const [isPossessed, setIsPossessed] = useState(false);
  const [nearBoatPrompt, setNearBoatPrompt] = useState(false);
  const [onBoat, setOnBoat] = useState(false);
  const [nearHarborShipPrompt, setNearHarborShipPrompt] = useState(false);
  const [onHarborShip, setOnHarborShip] = useState(false);
  const [nearRocketPrompt, setNearRocketPrompt] = useState(false);
  const [onRocket, setOnRocket] = useState(false);
  const [rocketCountdown, setRocketCountdown] = useState<number | null>(null);
  const [rocketLaunching, setRocketLaunching] = useState(false);
  const [rocketArrived, setRocketArrived] = useState(false);
  const [nearAirplanePrompt, setNearAirplanePrompt] = useState(false);
  const [onAirplane, setOnAirplane] = useState(false);
  const [inSpaceStation, setInSpaceStation] = useState(false);
  const [nearAirlockExit, setNearAirlockExit] = useState(false);
  const [stationWelcome, setStationWelcome] = useState(false);
  const stationWelcomeTimerRef = useRef(0);

  const [gameState, setGameState] = useState<GameState>({
    sheepCollected: 0,
    coinsCollected: 0,
    totalCoins: COIN_COUNT,
    timeElapsed: 0,
    isLocked: false,
    stamina: STAMINA_MAX,
    timeLabel: "07:12",
    direction: "N",
    playerHp: PLAYER_MAX_HP,
    foxesDefeated: 0,
    catapultsDefeated: 0,
    spidersDefeated: 0,
    attackReady: true,
  });
  const [nearCatapultHp, setNearCatapultHp] = useState<{ hp: number; maxHp: number } | null>(null);
  const [catapultWarning, setCatapultWarning] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showWeaponSelect, setShowWeaponSelect] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [bleatingLabel, setBleatingLabel] = useState<string | null>(null);
  const [foxWarning, setFoxWarning] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [isUnderwater, setIsUnderwater] = useState(false);
  const isUnderwaterRef = useRef(false);
  const [isSwimming, setIsSwimming] = useState(false);
  const isSwimmingRef = useRef(false);
  const [attackEffect, setAttackEffect] = useState<string | null>(null);
  const [nearFoxHp, setNearFoxHp] = useState<{ hp: number; maxHp: number; name: string } | null>(null);
  const [nearSpiderHp, setNearSpiderHp] = useState<{ hp: number; maxHp: number; name: string } | null>(null);
  const [chestOpenedMsg, setChestOpenedMsg] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const implementBufferRef = useRef<string>("");

  // ─── Multiplayer Refs ────────────────────────────────────────────────────────
  const remotePlayersRef = useRef<Map<string, {
    mesh: THREE.Group;
    name: string;
    color: number;
    // Interpolation targets
    targetX: number;
    targetY: number;
    targetZ: number;
    targetRotY: number;
    // Leg animation
    legL: THREE.Object3D | null;
    legR: THREE.Object3D | null;
    armL: THREE.Object3D | null;
    armR: THREE.Object3D | null;
    legPhase: number;
    prevX: number;
    prevZ: number;
  }>>(new Map());
  const sendUpdateRef = useRef<((update: PlayerUpdate) => void) | null>(null);
  const [playerLabels, setPlayerLabels] = useState<Array<{ id: string; name: string; x: number; y: number }>>([]);
  const [mpNotification, setMpNotification] = useState<string | null>(null);
  const mpNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<Array<{ id: string; name: string; color: number }>>([]);

  // ─── Chat state ──────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; name: string; color: number; text: string; ts: number }>>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const sendChatRef = useRef<((text: string) => void) | null>(null);

  // ─── Show a multiplayer notification for 4 seconds ───────────────────────────
  const showMpNotif = useCallback((msg: string) => {
    setMpNotification(msg);
    if (mpNotifTimerRef.current) clearTimeout(mpNotifTimerRef.current);
    mpNotifTimerRef.current = setTimeout(() => setMpNotification(null), 4000);
  }, []);

  // ─── Handle incoming chat message ─────────────────────────────────────────────
  const handleChatMessage = useCallback((msg: { id: string; name: string; color: number; text: string; ts: number }) => {
    setChatMessages((prev) => {
      const next = [...prev, msg];
      // Keep last 50 messages
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
  }, []);

  // ─── Multiplayer callbacks (use sceneRef which is set inside useEffect) ───────
  const handleMultiplayerInit = useCallback((players: Record<string, { id: string; name: string; x: number; y: number; z: number; rotY: number; pitch: number; color: number }>) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const list: Array<{ id: string; name: string; color: number }> = [];
    Object.values(players).forEach((p) => {
      const mesh = buildRemotePlayerMesh(p.color);
      // p.y is camera height (terrain + PLAYER_HEIGHT); offset so feet touch ground
      const meshY = p.y - PLAYER_HEIGHT + 0.825;
      mesh.position.set(p.x, meshY, p.z);
      mesh.rotation.y = p.rotY;
      scene.add(mesh);
      remotePlayersRef.current.set(p.id, {
        mesh, name: p.name, color: p.color,
        targetX: p.x, targetY: meshY, targetZ: p.z, targetRotY: p.rotY,
        legL: mesh.getObjectByName("legL") ?? null,
        legR: mesh.getObjectByName("legR") ?? null,
        armL: mesh.getObjectByName("armL") ?? null,
        armR: mesh.getObjectByName("armR") ?? null,
        legPhase: 0, prevX: p.x, prevZ: p.z,
      });
      list.push({ id: p.id, name: p.name, color: p.color });
    });
    setOnlinePlayers(list);
  }, []);

  const handlePlayerJoined = useCallback((p: { id: string; name: string; x: number; y: number; z: number; rotY: number; color: number }) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const mesh = buildRemotePlayerMesh(p.color);
    const meshY = p.y - PLAYER_HEIGHT + 0.825;
    mesh.position.set(p.x, meshY, p.z);
    mesh.rotation.y = p.rotY;
    scene.add(mesh);
    remotePlayersRef.current.set(p.id, {
      mesh, name: p.name, color: p.color,
      targetX: p.x, targetY: meshY, targetZ: p.z, targetRotY: p.rotY,
      legL: mesh.getObjectByName("legL") ?? null,
      legR: mesh.getObjectByName("legR") ?? null,
      armL: mesh.getObjectByName("armL") ?? null,
      armR: mesh.getObjectByName("armR") ?? null,
      legPhase: 0, prevX: p.x, prevZ: p.z,
    });
    setOnlinePlayers((prev) => [...prev, { id: p.id, name: p.name, color: p.color }]);
    showMpNotif(`${p.name} se připojil ke světu`);
  }, [showMpNotif]);

  const handlePlayerLeft = useCallback((id: string) => {
    const data = remotePlayersRef.current.get(id);
    if (data) {
      sceneRef.current?.remove(data.mesh);
      remotePlayersRef.current.delete(id);
      showMpNotif(`${data.name} odešel ze světa`);
    }
    setOnlinePlayers((prev) => prev.filter((p) => p.id !== id));
  }, [showMpNotif]);

  const handlePlayerUpdated = useCallback((id: string, update: PlayerUpdate) => {
    const data = remotePlayersRef.current.get(id);
    if (!data) return;
    // Update interpolation targets (not position directly — lerp happens in animation loop)
    data.targetX = update.x;
    data.targetY = update.y - PLAYER_HEIGHT + 0.825;
    data.targetZ = update.z;
    data.targetRotY = update.rotY;
  }, []);

  const { sendUpdate, sendChat } = useMultiplayer({
    playerName,
    onInit: handleMultiplayerInit,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onPlayerUpdated: handlePlayerUpdated,
    onChatMessage: handleChatMessage,
  });

  // Keep sendChat in a ref so it can be called from event handlers
  useEffect(() => {
    sendChatRef.current = sendChat;
  }, [sendChat]);

  // Keep sendUpdate in a ref so it can be called from the animation loop
  useEffect(() => {
    sendUpdateRef.current = sendUpdate;
  }, [sendUpdate]);

  const lockPointer = useCallback(() => {
    if (mountRef.current) {
      mountRef.current.requestPointerLock();
    }
  }, []);

  /** Start the game on mobile without requiring pointer-lock. */
  const startMobileGame = useCallback(() => {
    isLockedRef.current = true;
    setShowIntro(false);
    setShowWeaponSelect(false);
    setGameStarted(true);
    setGameState((s) => ({ ...s, isLocked: true }));
    if (!gameEverStartedRef.current) {
      gameEverStartedRef.current = true;
      soundManager.init();
    } else {
      soundManager.resume();
      prevTimeRef.current = performance.now();
      restartAnimLoopRef.current?.();
    }
  }, []);

  // ─── Swap weapon mesh when player confirms weapon selection ──────────────────
  const swapWeaponMesh = useCallback((type: WeaponType) => {
    const cam = cameraRef.current;
    if (!cam || !weaponMeshRef.current) return;
    // Remove old mesh
    cam.remove(weaponMeshRef.current);
    // Build new mesh
    const newMesh =
      type === "bow" ? buildBowMesh()
      : type === "crossbow" ? buildCrossbowMesh()
      : buildSwordMesh(); // sword
    if (type === "sword") {
      newMesh.position.set(0.25, -0.28, -0.48);
      newMesh.rotation.x = -Math.PI / 2; // tip pointing up
      newMesh.rotation.y = -0.3;          // angle so blade face shows toward center
      newMesh.rotation.z = 0.3;           // tilt right – natural grip
    } else if (type === "bow") {
      newMesh.position.set(0.16, -0.16, -0.40);
      newMesh.rotation.y = -0.12;
    } else {
      // crossbow
      newMesh.position.set(0.18, -0.22, -0.52);
      newMesh.rotation.y = -0.08;
    }
    cam.add(newMesh);
    weaponMeshRef.current = newMesh;
  }, []);

  // ─── Flash fox mesh red on hit ───────────────────────────────────────────────
  function flashFoxMesh(mesh: THREE.Group) {
    mesh.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshLambertMaterial;
        if (mat.emissive) {
          mat.emissive.set(0xff2200);
          setTimeout(() => mat.emissive.set(0x000000), 220);
        }
      }
    });
  }

  // ─── Flash spider mesh red on hit ────────────────────────────────────────────
  function flashSpiderMesh(mesh: THREE.Group) {
    mesh.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshLambertMaterial;
        if (mat.emissive) {
          mat.emissive.set(0xff2200);
          setTimeout(() => mat.emissive.set(mat.color.r > 0.3 ? 0xff0000 : 0x000000), 220);
        }
      }
    });
  }

  // ─── Flash catapult mesh red on hit ──────────────────────────────────────────
  function flashCatapultMesh(mesh: THREE.Group) {
    mesh.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshLambertMaterial;
        if (mat.emissive) {
          mat.emissive.set(0xff2200);
          setTimeout(() => mat.emissive.set(0x000000), 260);
        }
      }
    });
  }

  // ─── Cannonball impact explosion ────────────────────────────────────────────
  // Spawns an expanding ring + debris cloud at `pos` and queues it for update.
  function spawnImpactEffect(scene: THREE.Scene, pos: THREE.Vector3) {
    // Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.4, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    ring.position.y += 0.1;
    scene.add(ring);

    // Small debris particles (8 tiny spheres that shoot outward)
    const particles: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const debrisMat = new THREE.MeshBasicMaterial({ color: 0x884400, transparent: true });
      const pGeo = new THREE.SphereGeometry(0.1 + Math.random() * 0.12, 4, 3);
      const p = new THREE.Mesh(pGeo, debrisMat);
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 0.3 + Math.random() * 0.4;
      p.position.copy(pos);
      p.position.x += Math.cos(angle) * radius;
      p.position.z += Math.sin(angle) * radius;
      p.position.y += 0.15 + Math.random() * 0.5;
      scene.add(p);
      particles.push(p);
    }

    impactEffectsRef.current.push({
      ring,
      particles,
      age: 0,
      maxAge: IMPACT_EFFECT_DURATION,
    });
  }

  // ─── Sheep highlight helpers (possession target) ─────────────────────────────
  function setSheepEmissive(sheep: SheepData, color: number) {
    sheep.mesh.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshLambertMaterial;
        if (mat.emissive) mat.emissive.setHex(color);
      }
    });
  }

  // ─── World item: pick up the nearest item ────────────────────────────────────
  function pickUpItem(item: WorldItem) {
    if (!cameraRef.current || !sceneRef.current) return;
    const cam = cameraRef.current;

    // Hide world mesh (item stays in array but is no longer visible in world)
    item.mesh.visible = false;
    item.isHeld = true;
    heldItemRef.current = item;
    setHeldItemType(item.type);

    // Build and attach hand mesh to camera (type-specific mesh)
    const handMesh = item.type === "bomb"
      ? buildBombMesh(0.52)
      : buildPumpkinMesh(0.55);
    handMesh.position.copy(HELD_ITEM_POS);
    // Tilt slightly so it looks held naturally
    handMesh.rotation.set(0.15, -0.3, 0.1);
    cam.add(handMesh);
    heldItemHandMeshRef.current = handMesh;

    // Hide weapon while holding item
    if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
  }

  // ─── World item: place the held item at a target world position ───────────────
  function placeHeldItem(targetPos: THREE.Vector3, targetRotY: number) {
    const held = heldItemRef.current;
    if (!held || !cameraRef.current || !sceneRef.current) return;

    // Move the world mesh to the target position and show it
    held.mesh.position.copy(targetPos);
    held.mesh.rotation.y = targetRotY;
    held.mesh.visible = true;
    held.isHeld = false;

    // Remove hand mesh from camera
    const cam = cameraRef.current;
    if (heldItemHandMeshRef.current) {
      cam.remove(heldItemHandMeshRef.current);
      heldItemHandMeshRef.current = null;
    }

    heldItemRef.current = null;
    setHeldItemType(null);

    // Restore weapon visibility in first-person mode
    if (weaponMeshRef.current && cameraModeRef.current === "first") {
      weaponMeshRef.current.visible = true;
    }

    // Persist placement (bombs are one-use and not saved to localStorage)
    const items: PlacedWorldItemData[] = worldItemsRef.current
      .filter((wi) => !wi.isHeld && wi.type !== "bomb")
      .map((wi) => ({
        type: wi.type,
        x: wi.mesh.position.x,
        y: wi.mesh.position.y,
        z: wi.mesh.position.z,
        rotY: wi.mesh.rotation.y,
      }));
    saveWorldItems(items);
  }

  // ─── World item: drop the held item at the player's feet ─────────────────────
  function dropHeldItem() {
    const held = heldItemRef.current;
    if (!held || !cameraRef.current) return;
    const cam = cameraRef.current;
    const groundY = getTerrainHeightSampled(cam.position.x, cam.position.z);
    placeHeldItem(new THREE.Vector3(cam.position.x, groundY, cam.position.z), cam.rotation.y);
  }

  // ─── Bomb: throw the held bomb forward as a projectile ───────────────────────
  function throwBomb() {
    const held = heldItemRef.current;
    if (!held || held.type !== "bomb") return;
    if (!cameraRef.current || !sceneRef.current) return;

    const cam = cameraRef.current;
    const scene = sceneRef.current;

    // Compute throw direction from camera look direction (slight upward arc)
    const forward = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld);
    const throwDir = forward.clone();
    throwDir.y += 0.18; // add mild upward tilt for throw arc
    throwDir.normalize();

    // Spawn a new flying bomb mesh in the world at camera position
    const projectileMesh = buildBombMesh(0.85);
    const startPos = new THREE.Vector3();
    cam.getWorldPosition(startPos);
    startPos.addScaledVector(forward, 1.0); // spawn slightly in front of camera
    projectileMesh.position.copy(startPos);
    scene.add(projectileMesh);

    bombProjectilesRef.current.push({
      mesh: projectileMesh,
      velocity: throwDir.multiplyScalar(BOMB_THROW_SPEED),
      fuseTimer: BOMB_FUSE_DURATION,
      exploded: false,
    });

    // Remove the held bomb item from the world (consumed on throw)
    held.mesh.visible = false;
    held.isHeld = false;
    worldItemsRef.current = worldItemsRef.current.filter((wi) => wi !== held);

    // Remove hand mesh from camera
    if (heldItemHandMeshRef.current) {
      cam.remove(heldItemHandMeshRef.current);
      heldItemHandMeshRef.current = null;
    }
    heldItemRef.current = null;
    setHeldItemType(null);

    // Restore weapon visibility in first-person
    if (weaponMeshRef.current && cameraModeRef.current === "first") {
      weaponMeshRef.current.visible = true;
    }

    soundManager.playBombThrow();
  }

  // ─── Bomb: spawn explosion visual + terrain crater ───────────────────────────
  function spawnBombExplosion(scene: THREE.Scene, pos: THREE.Vector3) {
    soundManager.playBombExplosion();

    // ── 1. Flash point light ────────────────────────────────────────────────
    const flashLight = new THREE.PointLight(0xff8800, 12, 22);
    flashLight.position.copy(pos);
    flashLight.position.y += 0.5;
    scene.add(flashLight);
    // Fade light out over 0.4 seconds
    let flashAge = 0;
    const fadeFlash = () => {
      flashAge += 0.016;
      flashLight.intensity = Math.max(0, 12 * (1 - flashAge / 0.4));
      if (flashAge < 0.4) {
        requestAnimationFrame(fadeFlash);
      } else {
        scene.remove(flashLight);
      }
    };
    requestAnimationFrame(fadeFlash);

    // ── 2. Fireball core (expanding sphere) ─────────────────────────────────
    const coreGeo = new THREE.SphereGeometry(0.4, 10, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.copy(pos);
    core.position.y += 0.4;
    scene.add(core);

    // ── 3. Smoke cloud (several expanding grey spheres) ─────────────────────
    const smokeMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 10; i++) {
      const r = 0.28 + Math.random() * 0.35;
      const sGeo = new THREE.SphereGeometry(r, 6, 5);
      const sMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(
          0.25 + Math.random() * 0.15,
          0.22 + Math.random() * 0.10,
          0.18 + Math.random() * 0.10
        ),
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
      const sm = new THREE.Mesh(sGeo, sMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 1.2;
      sm.position.set(
        pos.x + Math.cos(angle) * dist,
        pos.y + 0.3 + Math.random() * 1.2,
        pos.z + Math.sin(angle) * dist
      );
      scene.add(sm);
      smokeMeshes.push(sm);
    }

    // ── 4. Debris fragments (small brown/grey pieces) ────────────────────────
    const debrisMeshes: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = [];
    for (let i = 0; i < 18; i++) {
      const dGeo = new THREE.BoxGeometry(
        0.08 + Math.random() * 0.18,
        0.06 + Math.random() * 0.12,
        0.06 + Math.random() * 0.14
      );
      const dMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(0.38 + Math.random() * 0.18, 0.30 + Math.random() * 0.12, 0.18),
      });
      const dm = new THREE.Mesh(dGeo, dMat);
      dm.position.copy(pos);
      dm.position.y += 0.2;
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      const velY = 3 + Math.random() * 5;
      debrisMeshes.push({
        mesh: dm,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          velY,
          Math.sin(angle) * speed
        ),
      });
      scene.add(dm);
    }

    // ── 5. Terrain crater deformation ──────────────────────────────────────
    const terrain = terrainMeshRef.current;
    if (terrain) {
      modifyTerrainHeight(pos.x, pos.z, BOMB_CRATER_DEPTH, BOMB_CRATER_RADIUS);
      updateTerrainGeometry(terrain);
    }

    // ── 6. Damage entities in blast radius ─────────────────────────────────
    foxListRef.current.forEach((fox) => {
      if (!fox.isAlive) return;
      if (fox.mesh.position.distanceTo(pos) < BOMB_BLAST_RADIUS) {
        fox.hp = Math.max(0, fox.hp - BOMB_BLAST_DAMAGE);
        fox.hitFlashTimer = 0.3;
        flashFoxMesh(fox.mesh);
        if (fox.hp <= 0) {
          fox.isAlive = false;
          foxesDefeatedRef.current++;
          soundManager.playFoxDeath();
        }
      }
    });
    catapultListRef.current.forEach((cat) => {
      if (!cat.isAlive) return;
      if (cat.mesh.position.distanceTo(pos) < BOMB_BLAST_RADIUS) {
        cat.hp = Math.max(0, cat.hp - BOMB_BLAST_DAMAGE);
        cat.hitFlashTimer = 0.35;
        flashCatapultMesh(cat.mesh);
        if (cat.hp <= 0) {
          cat.isAlive = false;
          catapultsDefeatedRef.current++;
        }
      }
    });
    sheepListRef.current.forEach((sheep) => {
      if (!sheep.isAlive) return;
      if (sheep.mesh.position.distanceTo(pos) < BOMB_BLAST_RADIUS) {
        sheep.hp = Math.max(0, sheep.hp - BOMB_BLAST_DAMAGE);
        sheep.hitFlashTimer = 0.25;
        if (sheep.hp <= 0 && !sheep.isDying) {
          sheep.isDying = true;
          sheep.deathTimer = 0;
        }
      }
    });
    spiderListRef.current.forEach((spider) => {
      if (!spider.isAlive) return;
      if (spider.mesh.position.distanceTo(pos) < BOMB_BLAST_RADIUS) {
        spider.hp = Math.max(0, spider.hp - BOMB_BLAST_DAMAGE);
        spider.hitFlashTimer = 0.3;
        if (spider.hp <= 0) spider.isAlive = false;
      }
    });

    // ── 7. Animate the explosion cloud and clean up ─────────────────────────
    let age = 0;
    const MAX_AGE = 1.6;
    const debrisGravity = -16;
    const animExplosion = () => {
      age += 0.016;
      const t = age / MAX_AGE;

      // Fireball expands then fades
      const coreScale = 1 + t * 7;
      core.scale.setScalar(coreScale);
      (core.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.95 * (1 - t * 1.6));

      // Smoke rises and fades
      smokeMeshes.forEach((sm, i) => {
        sm.position.y += 0.04 + i * 0.005;
        sm.scale.setScalar(1 + t * 2.5);
        (sm.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.78 * (1 - t));
      });

      // Debris arcs downward
      debrisMeshes.forEach(({ mesh: dm, vel }) => {
        vel.y += debrisGravity * 0.016;
        dm.position.addScaledVector(vel, 0.016);
        dm.rotation.x += 0.08;
        dm.rotation.z += 0.06;
      });

      if (age < MAX_AGE) {
        requestAnimationFrame(animExplosion);
      } else {
        // Remove all explosion meshes
        scene.remove(core);
        smokeMeshes.forEach((sm) => scene.remove(sm));
        debrisMeshes.forEach(({ mesh: dm }) => scene.remove(dm));
      }
    };
    requestAnimationFrame(animExplosion);
  }

  // ─── Flash sheep mesh red when hit ───────────────────────────────────────────
  function flashSheepMesh(mesh: THREE.Group) {
    mesh.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = m.material as THREE.MeshLambertMaterial;
        if (mat.emissive) {
          mat.emissive.set(0xff0000);
          setTimeout(() => mat.emissive.set(0x000000), 180);
        }
      }
    });
  }

  // ─── Spawn blood particles at a world position ────────────────────────────────
  function spawnBloodParticles(scene: THREE.Scene, pos: THREE.Vector3) {
    const count = 22 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const radius = 0.05 + Math.random() * 0.1;
      const geo = new THREE.SphereGeometry(radius, 4, 3);
      const r = 0.55 + Math.random() * 0.35;
      const mat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(r, 0.0, 0.0),
        emissive: new THREE.Color(0.25, 0.0, 0.0),
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      // Spawn slightly above the sheep body centre
      mesh.position.copy(pos);
      mesh.position.y += 0.4 + Math.random() * 0.5;

      // Random outward velocity — broad upward hemisphere
      const angle = Math.random() * Math.PI * 2;
      const elevation = 0.2 + Math.random() * (Math.PI * 0.55);
      const speed = 2.5 + Math.random() * 5.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed,
        Math.sin(angle) * Math.cos(elevation) * speed,
      );

      const maxLifetime = 0.7 + Math.random() * 0.9;
      scene.add(mesh);
      bloodParticlesRef.current.push({ mesh, velocity, lifetime: maxLifetime, maxLifetime });
    }
  }

  // ─── Player attack ───────────────────────────────────────────────────────────
  /**
   * Fire the currently equipped weapon.
   * @param powerMultiplier – for the bow: 0.1 (weak pull) to 1.0 (full draw).
   *   Scales arrow speed and damage. Defaults to 1.0 for non-bow weapons.
   */
  const doAttack = useCallback((powerMultiplier = 1.0) => {
    if (!isLockedRef.current) return;
    if (playerAttackCooldownRef.current > 0) return;
    if (!cameraRef.current || !sceneRef.current) return;
    // Cannot attack while controlling a vehicle, possessing a sheep, in the space station, or holding an item
    if (possessedSheepRef.current || onBoatRef.current || onRocketRef.current || onAirplaneRef.current || inSpaceStationRef.current || activeHarborShipRef.current) return;
    if (heldItemRef.current) return; // holding an item — must place it first

    const weaponCfg = WEAPON_CONFIGS[selectedWeaponRef.current];

    playerAttackCooldownRef.current = weaponCfg.cooldown;
    soundManager.playAttack(weaponCfg.type);

    // ── Weapon recoil kick ──────────────────────────────────────────────────
    weaponRecoilRef.current = 1;

    // ── Sword swing animation trigger ───────────────────────────────────────
    if (weaponCfg.type === "sword") {
      swordSwingTimerRef.current = 0; // restart the swing timer
    }

    // ── Muzzle flash (only for ranged weapons) ──────────────────────────────
    if (muzzleFlashRef.current && weaponCfg.bulletSpeed > 0) {
      muzzleFlashRef.current.intensity = 4;
      setTimeout(() => {
        if (muzzleFlashRef.current) muzzleFlashRef.current.intensity = 0;
      }, 75);
    }

    const cam = cameraRef.current;
    const scene = sceneRef.current;

    // ── Spawn bullet projectile (ranged weapons only) ───────────────────────
    if (weaponCfg.bulletSpeed > 0) {
      const startPos = new THREE.Vector3();
      cam.getWorldPosition(startPos);
      const forward = new THREE.Vector3(0, 0, -1);
      forward.transformDirection(cam.matrixWorld);
      startPos.addScaledVector(forward, 1.2);

      const isBow = weaponCfg.type === "bow";
      const projectileMesh = isBow ? buildArrowProjectileMesh() : buildBulletMesh();
      projectileMesh.position.copy(startPos);

      // Orient arrow to face the shoot direction immediately
      if (isBow) {
        const fwd = forward.clone();
        projectileMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);
      }

      scene.add(projectileMesh);

      // For the bow, scale bullet speed by the draw power (min 15% of full speed).
      const effectiveSpeed = isBow
        ? weaponCfg.bulletSpeed * Math.max(0.15, powerMultiplier)
        : weaponCfg.bulletSpeed;

      bulletsRef.current.push({
        mesh: projectileMesh,
        velocity: forward.clone().multiplyScalar(effectiveSpeed),
        lifetime: BULLET_LIFETIME,
        useGravity: isBow,
        power: isBow ? powerMultiplier : undefined,
        weaponType: selectedWeaponRef.current,
      });
    }

    // ── Melee hit (sword only — ranged weapons deal damage through projectile collision) ───
    const playerPos = cam.position;
    if (weaponCfg.type === "sword") {
      let closest: (typeof foxListRef.current)[0] | null = null;
      let closestDist = weaponCfg.range;

      foxListRef.current.forEach((fox) => {
        if (!fox.isAlive) return;
        const d = fox.mesh.position.distanceTo(playerPos);
        if (d < closestDist) {
          closestDist = d;
          closest = fox;
        }
      });

      if (closest) {
        const fox = closest as (typeof foxListRef.current)[0];
        fox.hp = Math.max(0, fox.hp - weaponCfg.damage);
        fox.hitFlashTimer = 0.25;
        flashFoxMesh(fox.mesh);
        soundManager.playFoxHit();

        setAttackEffect(`-${weaponCfg.damage}`);
        setTimeout(() => setAttackEffect(null), 700);

        if (fox.hp <= 0) {
          fox.isAlive = false;
          foxesDefeatedRef.current++;
          soundManager.playFoxDeath();
        }
      }
    }

    // ── Melee hit on catapults ───────────────────────────────────────────────
    if (weaponCfg.type === "sword") {
      let closestCatapult: CatapultData | null = null;
      let closestCatapultDist = weaponCfg.range * 2; // sword can reach catapult from a bit further

      catapultListRef.current.forEach((cat) => {
        if (!cat.isAlive) return;
        const d = cat.mesh.position.distanceTo(playerPos);
        if (d < closestCatapultDist) {
          closestCatapultDist = d;
          closestCatapult = cat;
        }
      });

      if (closestCatapult) {
        const cat = closestCatapult as CatapultData;
        cat.hp = Math.max(0, cat.hp - weaponCfg.damage);
        cat.hitFlashTimer = 0.3;
        flashCatapultMesh(cat.mesh);
        soundManager.playFoxHit();
        setAttackEffect(`-${weaponCfg.damage}`);
        setTimeout(() => setAttackEffect(null), 700);
        if (cat.hp <= 0) {
          cat.isAlive = false;
          catapultsDefeatedRef.current++;
        }
      }
    }

    // ── Melee hit on spiders ─────────────────────────────────────────────────
    if (weaponCfg.type === "sword") {
      let closestSpider: SpiderData | null = null;
      let closestSpiderDist = weaponCfg.range * 1.2; // slight range boost for large spiders

      spiderListRef.current.forEach((spider) => {
        if (!spider.isAlive) return;
        const cfg = SPIDER_TYPE_CONFIGS[spider.type];
        const d = spider.mesh.position.distanceTo(playerPos);
        if (d < closestSpiderDist + cfg.attackRange * 0.3) {
          closestSpiderDist = d;
          closestSpider = spider;
        }
      });

      if (closestSpider) {
        const spider = closestSpider as SpiderData;
        spider.hp = Math.max(0, spider.hp - weaponCfg.damage);
        spider.hitFlashTimer = 0.25;
        flashSpiderMesh(spider.mesh);
        soundManager.playFoxHit(); // reuse fox hit sound
        setAttackEffect(`-${weaponCfg.damage}`);
        setTimeout(() => setAttackEffect(null), 700);

        if (spider.hp <= 0) {
          spider.isAlive = false;
          spidersDefeatedRef.current++;
          soundManager.playFoxDeath(); // reuse death sound
        }
      }
    }

    // ── Melee hit on sheep (sword only — ranged weapons use projectile collision) ──
    if (!sceneRef.current) return;
    if (weaponCfg.type === "sword") {
      let closestSheep: SheepData | null = null;
      let closestSheepDist = weaponCfg.range;

      sheepListRef.current.forEach((sheep) => {
        if (!sheep.isAlive || sheep.isDying) return;
        const d = sheep.mesh.position.distanceTo(playerPos);
        if (d < closestSheepDist) {
          closestSheepDist = d;
          closestSheep = sheep;
        }
      });

      if (closestSheep) {
        const sheep = closestSheep as SheepData;
        sheep.hp = Math.max(0, sheep.hp - weaponCfg.damage);
        sheep.hitFlashTimer = 0.25;
        flashSheepMesh(sheep.mesh);
        soundManager.playFoxHit();
        setAttackEffect(`-${weaponCfg.damage}`);
        setTimeout(() => setAttackEffect(null), 700);

        if (sheep.hp <= 0 && !sheep.isDying) {
          sheep.isDying = true;
          sheep.deathTimer = 0;
          sheep.deathRotationY = sheep.mesh.rotation.y;
          // Spawn blood immediately at moment of death
          spawnBloodParticles(sceneRef.current!, sheep.mesh.position);
        }
      }
    }
  }, []);

  // ─── Block placement ──────────────────────────────────────────────────────────
  const placeBlock = useCallback((position: THREE.Vector3) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (placedBlocksDataRef.current.length >= MAX_BLOCKS) return;

    const { x, y, z } = position;
    const key = blockKey(x, y, z);
    if (placedBlockMeshesRef.current.has(key)) return;

    const mat = selectedMaterialRef.current;
    const mesh = buildBlockMesh(mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    placedBlockMeshesRef.current.set(key, mesh);

    const blockData: PlacedBlockData = { x, y, z, material: mat };
    placedBlocksDataRef.current.push(blockData);
    saveBlocks(placedBlocksDataRef.current);
    soundManager.playBlockPlace();
    setBuildingUiState((s) => ({ ...s, blockCount: placedBlocksDataRef.current.length }));
  }, []);

  // ─── Block removal ────────────────────────────────────────────────────────────
  const removeBlock = useCallback(() => {
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    if (!scene || !cam) return;

    const raycaster = buildRaycasterRef.current;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
    raycaster.far = BUILD_RANGE;

    const blockMeshes = Array.from(placedBlockMeshesRef.current.values());
    if (blockMeshes.length === 0) return;

    const hits = raycaster.intersectObjects(blockMeshes, false);
    if (hits.length > 0) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const pos = hitMesh.position;
      const key = blockKey(pos.x, pos.y, pos.z);
      scene.remove(hitMesh);
      placedBlockMeshesRef.current.delete(key);
      placedBlocksDataRef.current = placedBlocksDataRef.current.filter(
        (b) => !(b.x === pos.x && b.y === pos.y && b.z === pos.z)
      );
      saveBlocks(placedBlocksDataRef.current);
      soundManager.playBlockRemove();
      setBuildingUiState((s) => ({ ...s, blockCount: placedBlocksDataRef.current.length }));
    }
  }, []);

  // ── Scene Setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const mountNode = mountRef.current;
    if (!mountNode) return;
    initNoise(42);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountNode.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    // Light exponential fog for depth perception without heavy mist.
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.006);
    scene.background = new THREE.Color(0x87ceeb);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );
    camera.position.set(0, PLAYER_HEIGHT + getTerrainHeight(0, 0), 0);
    cameraRef.current = camera;

    // ── Third-person player body mesh ────────────────────────────────────────
    const playerBody = buildRemotePlayerMesh(0x4a9eff);
    playerBody.visible = false; // hidden in first-person (default)
    scene.add(playerBody);
    playerBodyRef.current = playerBody;
    playerBodyPosRef.current.copy(camera.position);

    // ── First-person weapon (attached to camera) ─────────────────────────────
    const wType = selectedWeaponRef.current;
    const weaponGroup =
      wType === "bow" ? buildBowMesh()
      : wType === "crossbow" ? buildCrossbowMesh()
      : buildSwordMesh(); // sword
    // Position each weapon in camera-local space
    if (wType === "sword") {
      weaponGroup.position.set(0.25, -0.28, -0.48);
      weaponGroup.rotation.x = -Math.PI / 2; // tip pointing up
      weaponGroup.rotation.y = -0.3;          // angle so blade face shows toward center
      weaponGroup.rotation.z = 0.3;           // tilt right – natural grip
    } else if (wType === "bow") {
      weaponGroup.position.set(0.16, -0.16, -0.40);
      weaponGroup.rotation.y = -0.12;
    } else {
      // crossbow
      weaponGroup.position.set(0.18, -0.22, -0.52);
      weaponGroup.rotation.y = -0.08;
    }
    camera.add(weaponGroup);
    weaponMeshRef.current = weaponGroup;
    scene.add(camera); // camera must be in scene for its children to render

    // Muzzle flash point light (parented to camera, at barrel tip)
    const muzzleFlash = new THREE.PointLight(0xffaa22, 0, 9);
    muzzleFlash.position.set(WEAPON_POS.x, WEAPON_POS.y + 0.01, WEAPON_POS.z - 0.25);
    camera.add(muzzleFlash);
    muzzleFlashRef.current = muzzleFlash;

    // ── Bow trajectory arc preview line ─────────────────────────────────────
    // Uses Line2 (from three/examples/jsm/lines) which supports pixel-width lines,
    // making the arc thick and always visible regardless of background.
    const TRAJ_ARC_POINTS = 80;
    // Pre-fill with dummy positions; will be overwritten every frame
    const trajInitPositions = new Float32Array(TRAJ_ARC_POINTS * 3);
    const trajGeom = new LineGeometry();
    trajGeom.setPositions(trajInitPositions);
    const trajMat = new LineMaterial({
      color: 0xffffff,       // white – maximum contrast against any background
      linewidth: 3,          // pixels; requires resolution to be set
      depthTest: false,      // always render in front of all geometry
      transparent: false,
    });
    trajMat.resolution.set(window.innerWidth, window.innerHeight);
    const trajectoryArc = new Line2(trajGeom, trajMat);
    trajectoryArc.visible = false;
    trajectoryArc.renderOrder = 9999; // ensure on top of all other renderOrder objects
    scene.add(trajectoryArc);
    trajectoryArcRef.current = trajectoryArc;

    // ── Lighting ────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);
    ambientRef.current = ambient;

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.4);
    sun.position.set(100, 150, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 700;
    sun.shadow.camera.left = -250;
    sun.shadow.camera.right = 250;
    sun.shadow.camera.top = 250;
    sun.shadow.camera.bottom = -250;
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    sunRef.current = sun;

    const fill = new THREE.DirectionalLight(0x8090ff, 0.3);
    fill.position.set(-80, 50, -80);
    scene.add(fill);

    // Moon light (cool blue, active at night)
    const moon = new THREE.DirectionalLight(0x8899cc, 0.0);
    moon.position.set(-100, 80, -50);
    scene.add(moon);
    moonRef.current = moon;

    // ── Sky sphere ──────────────────────────────────────────────────────────
    const skyGeo = new THREE.SphereGeometry(490, 16, 12);
    skyGeo.scale(-1, 1, -1);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
    skyMeshRef.current = skyMesh;

    // ── Visible sun disc ─────────────────────────────────────────────────────
    const sunDiscGeo = new THREE.SphereGeometry(9, 16, 16);
    const sunDiscMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.95, 0.8),
      transparent: true,
      opacity: 1.0,
    });
    const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    scene.add(sunDisc);
    sunDiscRef.current = sunDisc;

    // Corona halo — slightly larger, softer glow ring around sun disc
    const coronaGeo = new THREE.SphereGeometry(20, 12, 12);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.75, 0.35),
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
    });
    const sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    scene.add(sunCorona);
    sunCoronaRef.current = sunCorona;


    // ── Stars ───────────────────────────────────────────────────────────────
    const starPositions: number[] = [];
    const starColors: number[] = [];
    const starSizes: number[] = [];
    for (let i = 0; i < 8000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      // THREE.js y=up: standard spherical → cartesian
      const r = 460;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      // Color variation: blue-white, warm yellow, reddish, pure white
      const rnd = Math.random();
      if (rnd < 0.12) { starColors.push(0.65, 0.75, 1.0); }      // blue-white
      else if (rnd < 0.22) { starColors.push(1.0, 0.92, 0.75); } // warm yellow
      else if (rnd < 0.28) { starColors.push(1.0, 0.7, 0.7); }   // reddish
      else { starColors.push(1.0, 1.0, 1.0); }                    // pure white
      starSizes.push(1.2 + Math.random() * 3.5);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    starGeo.setAttribute("size", new THREE.Float32BufferAttribute(starSizes, 1));
    const starMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 2.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.visible = false;
    scene.add(stars);
    starsRef.current = stars;

    // ── Milky Way galaxy band ────────────────────────────────────────────────
    const galaxyPositions: number[] = [];
    const galaxyColors: number[] = [];
    // Band tilted ~62° — realistic Milky Way arch crossing the sky
    const bandTilt = 1.08;
    for (let i = 0; i < 12000; i++) {
      const t = Math.random() * Math.PI * 2;
      // Double-Gaussian: tight core + wide halo
      const isCoreParticle = Math.random() < 0.45;
      const spreadWidth = isCoreParticle ? 0.18 : 0.42;
      const spread = (Math.random() + Math.random() - 1.0) * spreadWidth;
      const bx = Math.cos(t);
      const by = Math.sin(t) * Math.cos(bandTilt) + spread * Math.sin(bandTilt);
      const bz = Math.sin(t) * Math.sin(bandTilt) - spread * Math.cos(bandTilt);
      const r = 455 + (Math.random() - 0.5) * 20;
      galaxyPositions.push(bx * r, by * r, bz * r);
      const cr = Math.random();
      if (isCoreParticle) {
        // Core: warm yellowish-white, brighter
        if (cr < 0.35) { galaxyColors.push(1.0, 0.97, 0.88); }       // warm white
        else if (cr < 0.65) { galaxyColors.push(0.95, 0.90, 1.0); }  // pale lavender
        else { galaxyColors.push(0.85, 0.88, 1.0); }                  // blue-white
      } else {
        // Halo: cooler, dimmer
        if (cr < 0.5) { galaxyColors.push(0.70, 0.78, 1.0); }        // blue-white
        else if (cr < 0.80) { galaxyColors.push(0.78, 0.74, 0.95); } // faint lavender
        else { galaxyColors.push(0.85, 0.82, 1.0); }                  // pale purple
      }
    }
    const galaxyGeo = new THREE.BufferGeometry();
    galaxyGeo.setAttribute("position", new THREE.Float32BufferAttribute(galaxyPositions, 3));
    galaxyGeo.setAttribute("color", new THREE.Float32BufferAttribute(galaxyColors, 3));
    const galaxyMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 1.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const galaxy = new THREE.Points(galaxyGeo, galaxyMat);
    galaxy.visible = false;
    scene.add(galaxy);
    galaxyRef.current = galaxy;

    // ── Terrain textures (see lib/terrainTextures.ts) ────────────────────────
    // Procedural canvas textures for each biome; sampled via triplanar mapping
    // in the fragment shader to add surface micro-detail without external assets.
    const terrainTexGrass = createTerrainTexture("grass");
    const terrainTexRock  = createTerrainTexture("rock");
    const terrainTexSand  = createTerrainTexture("sand");
    const terrainTexSnow  = createTerrainTexture("snow");
    const terrainTexDirt  = createTerrainTexture("dirt");

    // ── Terrain ─────────────────────────────────────────────────────────────
    const terrainGeo = new THREE.PlaneGeometry(
      WORLD_SIZE,
      WORLD_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS
    );
    terrainGeo.rotateX(-Math.PI / 2);

    const positions = terrainGeo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, getTerrainHeight(x, z));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir:       { value: new THREE.Vector3(0.58, 0.77, 0.27) },
        uSunColor:     { value: new THREE.Color(1.0, 0.95, 0.80) },
        uSunIntensity: { value: 1.0 },
        uAmbientColor: { value: new THREE.Color(0.30, 0.38, 0.52) },
        // Biome detail textures
        uTexGrass:     { value: terrainTexGrass },
        uTexRock:      { value: terrainTexRock  },
        uTexSand:      { value: terrainTexSand  },
        uTexSnow:      { value: terrainTexSnow  },
        uTexDirt:      { value: terrainTexDirt  },
        // Texture tiling scale (world units per tile repeat)
        uTexScale:     { value: 1.0 / 8.0 },
        // Texture blend strength (0 = no texture, 1 = full texture)
        uTexStrength:  { value: 0.40 },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying float vHeight;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vNormal   = normalize(normalMatrix * normal);
          vHeight   = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3  uSunDir;
        uniform vec3  uSunColor;
        uniform float uSunIntensity;
        uniform vec3  uAmbientColor;

        // Biome textures
        uniform sampler2D uTexGrass;
        uniform sampler2D uTexRock;
        uniform sampler2D uTexSand;
        uniform sampler2D uTexSnow;
        uniform sampler2D uTexDirt;
        uniform float     uTexScale;
        uniform float     uTexStrength;

        varying vec3  vWorldPos;
        varying vec3  vNormal;
        varying float vHeight;

        // ── Noise ────────────────────────────────────────────────────────────────
        vec2 hash2(vec2 p) {
          p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
          return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
          float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
          float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
          float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 0.5 + 0.5;
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * vnoise(p);
            p  = p * 2.0 + vec2(3.7, 1.3);
            a *= 0.5;
          }
          return v;
        }

        // ── Triplanar texture sampling ────────────────────────────────────────────
        // Blends top-projection with side-projections on steep slopes for
        // seamless texturing regardless of surface orientation.
        vec3 triplanar(sampler2D tex, vec3 worldPos, vec3 normal, float scale) {
          vec2 uvXZ = worldPos.xz * scale;
          vec2 uvXY = worldPos.xy * scale;
          vec2 uvZY = worldPos.zy * scale;
          vec3 blendW = abs(normal);
          blendW = pow(blendW, vec3(4.0));
          blendW /= (blendW.x + blendW.y + blendW.z + 0.0001);
          vec3 tXZ = texture2D(tex, uvXZ).rgb;
          vec3 tXY = texture2D(tex, uvXY).rgb;
          vec3 tZY = texture2D(tex, uvZY).rgb;
          return tXZ * blendW.y + tXY * blendW.z + tZY * blendW.x;
        }

        // ── Biome palette ─────────────────────────────────────────────────────────
        const vec3 cDeepWater    = vec3(0.10, 0.18, 0.44);
        const vec3 cShallowWater = vec3(0.20, 0.40, 0.65);
        const vec3 cSand         = vec3(0.78, 0.72, 0.48);
        const vec3 cSandDark     = vec3(0.62, 0.54, 0.32);
        const vec3 cBrightGrass  = vec3(0.38, 0.65, 0.20);
        const vec3 cMidGrass     = vec3(0.28, 0.52, 0.15);
        const vec3 cDarkGrass    = vec3(0.21, 0.40, 0.11);
        const vec3 cDryGrass     = vec3(0.55, 0.52, 0.28);
        const vec3 cRockBrown    = vec3(0.48, 0.40, 0.28);
        const vec3 cRockGray     = vec3(0.58, 0.55, 0.52);
        const vec3 cRockLight    = vec3(0.70, 0.66, 0.60);
        const vec3 cSnow         = vec3(0.90, 0.92, 0.96);

        void main() {
          vec2 uv = vWorldPos.xz;

          // ── Multi-scale noise ───────────────────────────────────────────────────
          float macro  = fbm(uv * 0.025);   // large patches  (~40 unit scale)
          float meso   = fbm(uv * 0.10);    // medium detail  (~10 unit scale)
          float micro  = vnoise(uv * 0.55); // fine grain     (~ 2 unit scale)
          float crack  = fbm(uv * 0.40);    // rock / cliff cracks

          // Noise-wobbled height for jagged biome borders
          float hWobble = vHeight + (macro * 2.0 - 1.0) * 2.2
                                  + (meso  * 2.0 - 1.0) * 0.7;

          // ── Biome color ────────────────────────────────────────────────────────
          vec3 col;

          // Biome texture weights (sum used for triplanar blending)
          float wGrass = 0.0;
          float wRock  = 0.0;
          float wSand  = 0.0;
          float wSnow  = 0.0;
          float wDirt  = 0.0;

          if (hWobble < -3.0) {
            col = cDeepWater;
            // Water: no texture blend (handled by water plane above)
          } else if (hWobble < -0.5) {
            float t = clamp((hWobble + 3.0) / 2.5, 0.0, 1.0);
            col = mix(cDeepWater, cShallowWater, t);
            wSand = t * 0.4;
          } else if (hWobble < 0.4) {
            float t = clamp((hWobble + 0.5) / 0.9, 0.0, 1.0);
            // Sand variation: lighter/darker patches
            vec3 sandVar = mix(cSandDark, cSand, vnoise(uv * 1.8));
            col = mix(cShallowWater, sandVar, t);
            wSand = t;
          } else if (hWobble < 2.5) {
            float t = clamp((hWobble - 0.4) / 2.1, 0.0, 1.0);
            // Patchy transition from sand to grass (dry tufts)
            vec3 grassVar = mix(cBrightGrass, cDryGrass, meso * 0.5);
            col = mix(cSand, grassVar, t);
            wSand  = 1.0 - t;
            wGrass = t;
          } else if (hWobble < 7.0) {
            float t = clamp((hWobble - 2.5) / 4.5, 0.0, 1.0);
            // Bright → mid grass: patchy colour variation from noise
            vec3 g1 = mix(cBrightGrass, cDryGrass,   macro * 0.35);
            vec3 g2 = mix(cMidGrass,    cBrightGrass, meso  * 0.40);
            col = mix(g1, g2, t + (micro - 0.5) * 0.25);
            wGrass = 1.0;
          } else if (hWobble < 17.0) {
            float t = clamp((hWobble - 7.0) / 10.0, 0.0, 1.0);
            vec3 g1 = mix(cMidGrass,  cBrightGrass, micro * 0.25);
            vec3 g2 = mix(cDarkGrass, cMidGrass,    meso  * 0.30);
            col = mix(g1, g2, t + (macro - 0.5) * 0.20);
            wGrass = 1.0 - t * 0.5;
            wDirt  = t * 0.5;
          } else if (hWobble < 28.0) {
            float t = clamp((hWobble - 17.0) / 11.0, 0.0, 1.0);
            vec3 rockVar = mix(cRockBrown, cRockGray, vnoise(uv * 1.2));
            col = mix(cDarkGrass, rockVar, t);
            wDirt = 1.0 - t;
            wRock = t;
          } else {
            float t = clamp((hWobble - 28.0) / 12.0, 0.0, 1.0);
            vec3 rockVar = mix(cRockBrown, cRockLight, vnoise(uv * 1.5));
            col = mix(rockVar, cSnow, t);
            wRock = 1.0 - t;
            wSnow = t;
          }

          // ── Slope → cliff rock overlay ────────────────────────────────────────
          float slope     = 1.0 - vNormal.y;
          float rockBlend = smoothstep(0.38, 0.65, slope);
          if (rockBlend > 0.001 && vHeight > 0.5) {
            float crackDetail = crack * 0.5 + 0.5;
            vec3  cliffCol    = mix(cRockBrown, cRockGray, vnoise(uv * 0.9 + vec2(7.3, 2.1)));
            cliffCol *= mix(0.72, 1.05, crackDetail); // darker cracks, lighter faces
            col = mix(col, cliffCol, rockBlend);
            // Shift texture weights towards rock on steep slopes
            float rShift = rockBlend;
            wGrass *= (1.0 - rShift);
            wSand  *= (1.0 - rShift);
            wDirt  *= (1.0 - rShift * 0.5);
            wSnow  *= (1.0 - rShift * 0.7);
            wRock  = clamp(wRock + rShift, 0.0, 1.0);
          }

          // ── Texture detail sampling (triplanar projection) ────────────────────
          // Biome textures provide surface micro-detail to break up flat-colour look.
          // Each texture is sampled at two scales and blended.
          float totalW = wGrass + wRock + wSand + wSnow + wDirt + 0.0001;
          vec3 texDetail = vec3(0.5); // neutral grey (no detail)

          if (uTexStrength > 0.001) {
            vec3 tGrass = triplanar(uTexGrass, vWorldPos, vNormal, uTexScale);
            vec3 tRock  = triplanar(uTexRock,  vWorldPos, vNormal, uTexScale * 0.6);
            vec3 tSand  = triplanar(uTexSand,  vWorldPos, vNormal, uTexScale * 1.2);
            vec3 tSnow  = triplanar(uTexSnow,  vWorldPos, vNormal, uTexScale * 0.8);
            vec3 tDirt  = triplanar(uTexDirt,  vWorldPos, vNormal, uTexScale * 0.9);

            texDetail = (tGrass * wGrass + tRock * wRock + tSand * wSand
                         + tSnow * wSnow + tDirt * wDirt) / totalW;

            // Apply second (coarser) scale for depth
            vec3 tGrass2 = triplanar(uTexGrass, vWorldPos, vNormal, uTexScale * 0.25);
            vec3 tRock2  = triplanar(uTexRock,  vWorldPos, vNormal, uTexScale * 0.20);
            vec3 tSand2  = triplanar(uTexSand,  vWorldPos, vNormal, uTexScale * 0.30);
            vec3 tSnow2  = triplanar(uTexSnow,  vWorldPos, vNormal, uTexScale * 0.22);
            vec3 tDirt2  = triplanar(uTexDirt,  vWorldPos, vNormal, uTexScale * 0.24);

            vec3 texCoarse = (tGrass2 * wGrass + tRock2 * wRock + tSand2 * wSand
                              + tSnow2 * wSnow + tDirt2 * wDirt) / totalW;

            // Combine fine and coarse detail
            texDetail = texDetail * 0.65 + texCoarse * 0.35;

            // Remap: centre at 0.5 so blend is multiplicative-neutral
            // col * (1 + strength*(detail - 0.5)*2) keeps average brightness
            float detailFactor = 1.0 + uTexStrength * (texDetail.r * 0.4 + texDetail.g * 0.4 + texDetail.b * 0.2 - 0.5) * 2.0;
            col *= clamp(detailFactor, 0.55, 1.55);
          }

          // ── Micro-shading: subtle brightness variation ─────────────────────────
          col *= 0.90 + micro * 0.18;

          // ── Lambert lighting ──────────────────────────────────────────────────
          float diffuse  = max(0.0, dot(vNormal, normalize(uSunDir)));
          vec3  litColor = col * (uAmbientColor + uSunColor * diffuse * uSunIntensity);

          gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), 1.0);
        }
      `,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);
    terrainMeshRef.current = terrain;
    terrainMatRef.current  = terrainMat;

    // ── Building system: ghost block + sculpt indicator ──────────────────────
    const ghost = buildGhostMesh("wood");
    scene.add(ghost);
    ghostMeshRef.current = ghost;

    const sculptRing = buildSculptIndicator(SCULPT_RADIUS);
    scene.add(sculptRing);
    sculptIndicatorRef.current = sculptRing;

    // Restore placed blocks from localStorage
    const savedBlocks = loadBlocks();
    savedBlocks.forEach((b) => {
      const mesh = buildBlockMesh(b.material);
      mesh.position.set(b.x, b.y, b.z);
      scene.add(mesh);
      placedBlockMeshesRef.current.set(blockKey(b.x, b.y, b.z), mesh);
      placedBlocksDataRef.current.push(b);
    });
    if (savedBlocks.length > 0) {
      setBuildingUiState((s) => ({ ...s, blockCount: savedBlocks.length }));
    }

    // ── World items: placement ghost ─────────────────────────────────────────
    const itemGhost = buildPumpkinMesh(1.0);
    itemGhost.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = (m.material as THREE.MeshLambertMaterial).clone();
        mat.transparent = true;
        mat.opacity = 0.45;
        mat.depthWrite = false;
        m.material = mat;
      }
    });
    itemGhost.visible = false;
    scene.add(itemGhost);
    itemPlacementGhostRef.current = itemGhost;

    // ── World items: spawn initial pumpkins ──────────────────────────────────
    // Fixed spawn positions scattered around the world (near landmarks / paths)
    const pumpkinSpawns: Array<{ x: number; z: number; rotY: number }> = [
      { x: -24, z: 18,  rotY: 0.5 },  // near farmhouse
      { x:  30, z: 32,  rotY: 1.2 },  // near windmill
      { x:   8, z: -12, rotY: 2.4 },  // near spawn
      { x: -10, z: -8,  rotY: 0.8 },  // near spawn
      { x:  45, z: -35, rotY: 3.1 },  // open field
      { x: -50, z: 55,  rotY: 1.9 },  // northwest field
    ];
    const spawnSubset = pumpkinSpawns.slice(0, PUMPKIN_COUNT);

    // First check if there are user-placed items saved from a previous session
    const savedWorldItems = loadWorldItems();
    if (savedWorldItems.length > 0) {
      // Restore saved placements (overrides default spawns)
      savedWorldItems.forEach((saved) => {
        const mesh = buildPumpkinMesh(1.0);
        const groundY = getTerrainHeightSampled(saved.x, saved.z);
        mesh.position.set(saved.x, groundY, saved.z);
        mesh.rotation.y = saved.rotY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        worldItemsRef.current.push({
          id: Math.random().toString(36).slice(2),
          type: saved.type,
          mesh,
          isHeld: false,
        });
      });
    } else {
      // Default spawns at game start
      spawnSubset.forEach(({ x, z, rotY }) => {
        const mesh = buildPumpkinMesh(1.0);
        const groundY = getTerrainHeightSampled(x, z);
        mesh.position.set(x, groundY, z);
        mesh.rotation.y = rotY;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        worldItemsRef.current.push({
          id: Math.random().toString(36).slice(2),
          type: "pumpkin",
          mesh,
          isHeld: false,
        });
      });
    }

    // ── Bomb items scattered across the world ────────────────────────────────
    // Multiple throwable bombs placed at strategic locations — near catapults,
    // landmarks and remote areas so players always have bombs to find and throw.
    {
      const EXTRA_BOMB_SPAWNS: Array<{ id: string; x: number; z: number }> = [
        { id: "bomb-ruins-0",      x: BOMB_SPAWN_X, z: BOMB_SPAWN_Z },   // Ruins island (original)
        { id: "bomb-catapult-0",   x: 82,            z: 42  },            // Near north-east catapult
        { id: "bomb-catapult-1",   x: -74,           z: 57  },            // Near north-west catapult
        { id: "bomb-catapult-2",   x: 62,            z: -78 },            // Near south-east catapult
        { id: "bomb-lighthouse-0", x: 108,           z: -52 },            // Near lighthouse
        { id: "bomb-west-0",       x: -88,           z: 18  },            // Deep west
        { id: "bomb-north-0",      x: 22,            z: -105},            // Far north
        { id: "bomb-east-0",       x: 128,           z: 72  },            // East shore
        { id: "bomb-center-0",     x: 12,            z: 32  },            // Open centre field
      ];

      EXTRA_BOMB_SPAWNS.forEach(({ id, x, z }) => {
        const bombMesh = buildBombMesh(1.0);
        const groundY = getTerrainHeightSampled(x, z);
        bombMesh.position.set(x, groundY + 0.05, z);
        bombMesh.castShadow = true;
        scene.add(bombMesh);
        worldItemsRef.current.push({
          id,
          type: "bomb",
          mesh: bombMesh,
          isHeld: false,
        });
      });
    }

    // ── Water ───────────────────────────────────────────────────────────────
    // Reduced segment count for better performance while keeping smooth waves
    const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 64, 64);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.ShaderMaterial({
      uniforms: {
        time:         { value: 0.0 },
        sunDir:       { value: new THREE.Vector3(0, 1, 0) },
        skyCol:       { value: new THREE.Color(0.45, 0.65, 0.90) },
        sunColor:     { value: new THREE.Color(1.0, 0.90, 0.75) },
        sunIntensity: { value: 1.0 },
      },
      vertexShader: `
        uniform float time;
        varying vec3  vWorldPos;
        varying vec3  vNormal;
        varying vec2  vUv;
        varying float vHeight;

        #define PI 3.14159265

        // Gerstner wave: physically accurate ocean wave with horizontal displacement.
        // dir = wave travel direction (normalized), wavelength in world units,
        // amplitude = crest height, steepness Q in [0,1] (0=sine, 1=looped crest),
        // speed = phase velocity, phase = time offset.
        // Accumulates surface normal gradient into dNx/dNz.
        vec3 gerstnerWave(vec2 dir, float wavelength, float amplitude,
                          float steepness, float speed, float phase,
                          vec2 xz, inout float dNx, inout float dNz) {
          float k    = 2.0 * PI / wavelength;
          float phi  = dot(dir, xz) * k + time * speed + phase;
          float cp   = cos(phi);
          float sp   = sin(phi);
          // accumulate gradient for normal (∂Y/∂x and ∂Y/∂z)
          dNx += dir.x * k * amplitude * cp;
          dNz += dir.y * k * amplitude * cp;
          // displacement: horizontal (Gerstner loop) + vertical (cosine crest)
          // dir.x = world-X component, dir.y = world-Z component (vec2)
          return vec3(-dir.x * steepness * amplitude * sp,
                       amplitude * cp,
                      -dir.y * steepness * amplitude * sp);
        }

        void main() {
          vUv = uv;
          vec3 pos   = position;
          float dNx  = 0.0;
          float dNz  = 0.0;
          vec2  xz   = pos.xz; // evaluate all waves at rest position

          // ── Primary ocean swells (long, slow rolling waves) ────────────────
          vec3 d = vec3(0.0);
          d += gerstnerWave(normalize(vec2( 1.0,  0.7)), 34.0, 0.26, 0.38, 0.50, 0.00, xz, dNx, dNz);
          d += gerstnerWave(normalize(vec2(-0.7,  1.0)), 26.0, 0.20, 0.35, 0.44, 1.70, xz, dNx, dNz);
          d += gerstnerWave(normalize(vec2(-0.9, -0.4)), 42.0, 0.28, 0.28, 0.35, 0.90, xz, dNx, dNz);

          // ── Secondary chop (faster, shorter cross-waves) ───────────────────
          d += gerstnerWave(normalize(vec2( 1.5,  0.6)),  9.0, 0.065, 0.55, 0.84, 2.30, xz, dNx, dNz);
          d += gerstnerWave(normalize(vec2(-0.5,  0.8)),  7.0, 0.050, 0.60, 1.04, 4.10, xz, dNx, dNz);

          pos.x   += d.x;
          pos.z   += d.z;
          pos.y   += d.y;
          vHeight  = d.y; // y-displacement: positive at crests, used for foam

          vNormal   = normalize(vec3(-dNx, 1.0, -dNz));
          vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3  sunDir;
        uniform vec3  skyCol;
        uniform vec3  sunColor;
        uniform float sunIntensity;
        varying vec3  vWorldPos;
        varying vec3  vNormal;
        varying vec2  vUv;
        varying float vHeight;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec2 xz      = vWorldPos.xz;

          // ── Detail normals (2 layers of animated ripples) ─────────────────
          vec2 uv1 = xz * 0.16 + vec2( time * 0.07,  time * 0.05);
          vec2 uv2 = xz * 0.34 + vec2(-time * 0.06,  time * 0.09);

          float dn1x = cos(uv1.x * 2.0 + uv1.y * 0.4) * 0.070;
          float dn1z = cos(uv1.y * 2.0 - uv1.x * 0.4) * 0.070;
          float dn2x = cos(uv2.x * 2.0 + uv2.y * 0.6) * 0.048;
          float dn2z = cos(uv2.y * 2.0 + uv2.x * 0.6) * 0.048;

          float dnX = dn1x + dn2x;
          float dnZ = dn1z + dn2z;
          vec3  n   = normalize(vNormal + vec3(-dnX, 0.0, -dnZ));

          // ── Schlick Fresnel ────────────────────────────────────────────────
          float cosTheta = max(dot(n, viewDir), 0.0);
          float fresnel  = 0.04 + 0.96 * pow(1.0 - cosTheta, 5.0);
          fresnel        = clamp(fresnel, 0.0, 1.0);

          // ── Deep/shallow base colour ───────────────────────────────────────
          vec3 deepColor    = vec3(0.01, 0.07, 0.24);
          vec3 shallowColor = vec3(0.04, 0.28, 0.48);
          vec3 waterColor   = mix(deepColor, shallowColor, clamp(1.0 - fresnel * 1.8, 0.0, 1.0));

          // ── Sky reflection with horizon gradient + sun disk ────────────────
          vec3  reflDir   = reflect(-viewDir, n);
          float skyMix    = clamp(reflDir.y * 2.0 + 0.4, 0.0, 1.0);
          vec3  horizCol  = mix(skyCol * 0.55, vec3(0.85, 0.93, 1.0), 0.40);
          vec3  zenithCol = skyCol * 1.10;
          vec3  reflColor = mix(horizCol, zenithCol, skyMix);

          // Sun disk visible in reflection – bright spot centred on reflected sun
          float sunDot  = dot(reflDir, sunDir);
          float sunDisk = pow(max(sunDot, 0.0), 200.0) * 4.0;
          reflColor    += sunColor * sunDisk;

          waterColor = mix(waterColor, reflColor, fresnel * 0.90);

          // ── Sub-surface scattering (turquoise light through wave crests) ───
          // Gated by sunIntensity: SSS only occurs with actual sunlight, not at night.
          float sss = smoothstep(0.18, 0.80, vHeight * 1.5 + 0.28);
          waterColor += vec3(0.0, 0.18, 0.26) * sss * 0.38 * sunIntensity;

          // ── Specular: sharp sun glint + soft halo ─────────────────────────
          vec3  halfDir    = normalize(sunDir + viewDir);
          float NdotH      = max(dot(n, halfDir), 0.0);
          float specSharp  = pow(NdotH, 512.0) * 7.0;
          float specSoft   = pow(NdotH,  48.0) * 0.32;

          waterColor += sunColor * (specSharp + specSoft);

          // ── Foam at wave crests ────────────────────────────────────────────
          float foamNoise = 0.5 + 0.5 * sin(xz.x * 3.0 + time * 1.2) * sin(xz.y * 2.5 + time * 0.9);
          float crestFoam = smoothstep(0.36, 0.90, vHeight * 1.15) * foamNoise;
          waterColor = mix(waterColor, vec3(0.95, 0.98, 1.0), clamp(crestFoam, 0.0, 1.0) * 0.68);

          // ── Shore foam band ────────────────────────────────────────────────
          float sf = pow(max(sin(xz.x * 0.10 + time * 0.48)
                           * sin(xz.y * 0.08 + time * 0.40), 0.0), 4.0) * 0.06;
          waterColor += vec3(sf * 0.85, sf, sf);

          // ── Alpha: grazing = more opaque/reflective ────────────────────────
          float alpha = mix(0.72, 0.96, fresnel);

          gl_FragColor = vec4(waterColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -0.5;
    scene.add(water);
    waterMatRef.current = waterMat;

    // ── Grass ───────────────────────────────────────────────────────────────
    {
      // Optimised billboard sprite grass: each tuft = 2 quads crossed at 90°
      // (classic game "X" pattern, same technique as Unity terrain grass).
      // Old: ~180k blades × 3 planes × 7 segments ≈ 7M+ triangles + heavy shader
      // New:  ~60k tufts × 2 quads × 2 triangles  ≈ 240k triangles + lean shader
      const GRASS_COUNT = process.env.NODE_ENV === "test" ? 500 : 60000;
      const BLADE_H = 0.37;  // base tuft height (world units) — ~3× shorter than original 1.1
      const BLADE_W = 0.55; // base tuft width  (wider than individual blade to fill field)
      let gSeed = 7391;
      const gRng = () => {
        gSeed = (gSeed * 1664525 + 1013904223) & 0xffffffff;
        return (gSeed >>> 0) / 0xffffffff;
      };
      // Spatially-coherent hash for biome-patch colour variation
      const posHash = (x: number, z: number): number => {
        const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
        return s - Math.floor(s);
      };

      const gPos:      number[] = [];
      const gUV:       number[] = []; // x = horizontal (0–1), y = height (0=root, 1=tip)
      const gWindPhase: number[] = [];
      const gColorBot: number[] = []; // root colour (darker / soil-tinted)
      const gColorTip: number[] = []; // tip colour  (lighter / sun-bleached)

      let placed = 0;
      let tries  = 0;

      while (placed < GRASS_COUNT && tries < GRASS_COUNT * 8) {
        tries++;
        const wx = (gRng() - 0.5) * (WORLD_SIZE * 0.85);
        const wz = (gRng() - 0.5) * (WORLD_SIZE * 0.85);
        const wy = getTerrainHeightSampled(wx, wz);
        if (wy < 0.3 || wy > 14) continue; // only green terrain zones

        const hScale   = 0.5  + gRng() * 1.5;
        const wScale   = 0.6  + gRng() * 0.9;
        const h        = BLADE_H * hScale;
        const hw       = (BLADE_W * wScale) / 2;
        const topHW    = hw * 0.22; // top of sprite is narrower (tapered look)
        const phase    = wx * 0.48 + wz * 0.73 + gRng() * 2.0;
        const windStr  = 0.6 + gRng() * 0.8;

        // Slight static lean (persistent wind bias + random)
        const tiltX = (gRng() - 0.5) * 0.20 + 0.04;
        const tiltZ = (gRng() - 0.5) * 0.20;

        // ── Colour: terrain-zone + patch-hash colour variation ──────────────
        const pH     = posHash(Math.floor(wx / 14),  Math.floor(wz / 14));
        const pHFine = posHash(Math.floor(wx / 3.5), Math.floor(wz / 3.5));
        const isValley  = wy < 3.5;
        const isHigh    = wy > 8;
        const colorRoll = gRng();
        const lushBoost = isValley ? 0.18 : 0.0;
        // Reduced dryBoost (was 0.18) — previously caused up to ~50% brown grass at altitude
        const dryBoost  = isHigh   ? 0.06 : 0.0;
        // Reduced patchBias strength (was 0.16) — patches no longer go fully brown
        const patchBias = (pH - 0.5) * 0.06;

        let rB: number, gB: number, bB: number; // root colour
        let rT: number, gT: number, bT: number; // tip colour
        if (colorRoll < 0.02 + dryBoost + patchBias) {
          // Straw / bleached dry (rare accent only)
          rB = 0.22 + gRng()*0.08 + pHFine*0.04; gB = 0.20 + gRng()*0.08; bB = 0.01;
          rT = 0.58 + gRng()*0.14;                gT = 0.42 + gRng()*0.10; bT = 0.02;
        } else if (colorRoll < 0.05 + dryBoost + patchBias) {
          // Autumn rust (very rare)
          rB = 0.14 + gRng()*0.06; gB = 0.20 + gRng()*0.08; bB = 0.01;
          rT = 0.38 + gRng()*0.12; gT = 0.35 + gRng()*0.10; bT = 0.01;
        } else if (colorRoll < 0.14 + dryBoost + patchBias) {
          // Olive / yellowish-green
          rB = 0.08 + gRng()*0.05; gB = 0.28 + gRng()*0.10 + pHFine*0.04; bB = 0.02;
          rT = 0.24 + gRng()*0.10; gT = 0.52 + gRng()*0.14;                bT = 0.03;
        } else if (colorRoll < 0.55 + lushBoost - patchBias) {
          // Bright fresh green (dominant)
          rB = 0.02 + gRng()*0.03; gB = 0.28 + gRng()*0.10 + pHFine*0.05; bB = 0.03;
          rT = 0.14 + gRng()*0.09; gT = 0.72 + gRng()*0.16;                bT = 0.05;
        } else if (colorRoll < 0.82 + lushBoost - patchBias) {
          // Lush dark green
          rB = 0.02 + gRng()*0.02; gB = 0.22 + gRng()*0.08 + pHFine*0.04; bB = 0.04;
          rT = 0.12 + gRng()*0.06; gT = 0.52 + gRng()*0.12;                bT = 0.07;
        } else {
          // Blue-green — wet/shaded meadow
          rB = 0.01 + gRng()*0.02; gB = 0.24 + gRng()*0.08; bB = 0.08 + pHFine*0.03;
          rT = 0.09 + gRng()*0.06; gT = 0.56 + gRng()*0.13; bT = 0.18 + pHFine*0.04;
        }

        // ── Geometry: 2 quads at 90° (classic X billboard sprite) ────────
        const rotY = gRng() * Math.PI * 2;

        const pushQuad = (angle: number) => {
          const ca = Math.cos(angle);
          const sa = Math.sin(angle);
          // Tip world position (lean offsets tip for natural droop)
          const tx = wx + tiltX * h * windStr;
          const tz = wz + tiltZ * h * windStr;
          const ty = wy + h;

          // 2 triangles = 6 vertices (non-indexed)
          // tri 1: bottom-left, bottom-right, top-left
          // tri 2: top-left,    bottom-right, top-right
          const push = (x: number, y: number, z: number,
                        u: number, v: number,
                        rC: number, gC: number, bC: number,
                        rTp: number, gTp: number, bTp: number) => {
            gPos.push(x, y, z);
            gUV.push(u, v);
            gWindPhase.push(phase + windStr * 0.4);
            gColorBot.push(rC,  gC,  bC);
            gColorTip.push(rTp, gTp, bTp);
          };

          // bottom-left
          push(wx - hw*ca, wy, wz - hw*sa, 0, 0, rB, gB, bB, rT, gT, bT);
          // bottom-right
          push(wx + hw*ca, wy, wz + hw*sa, 1, 0, rB, gB, bB, rT, gT, bT);
          // top-left
          push(tx - topHW*ca, ty, tz - topHW*sa, 0, 1, rB, gB, bB, rT, gT, bT);
          // top-left  (second tri)
          push(tx - topHW*ca, ty, tz - topHW*sa, 0, 1, rB, gB, bB, rT, gT, bT);
          // bottom-right
          push(wx + hw*ca, wy, wz + hw*sa, 1, 0, rB, gB, bB, rT, gT, bT);
          // top-right
          push(tx + topHW*ca, ty, tz + topHW*sa, 1, 1, rB, gB, bB, rT, gT, bT);
        };

        pushQuad(rotY);
        pushQuad(rotY + Math.PI * 0.5); // second quad perpendicular → X shape

        placed++;
      }

      const grassGeo = new THREE.BufferGeometry();
      grassGeo.setAttribute("position",  new THREE.Float32BufferAttribute(gPos,       3));
      grassGeo.setAttribute("grassUV",   new THREE.Float32BufferAttribute(gUV,        2));
      grassGeo.setAttribute("windPhase", new THREE.Float32BufferAttribute(gWindPhase, 1));
      grassGeo.setAttribute("colorBot",  new THREE.Float32BufferAttribute(gColorBot,  3));
      grassGeo.setAttribute("colorTip",  new THREE.Float32BufferAttribute(gColorTip,  3));

      const grassMat = new THREE.ShaderMaterial({
        uniforms: {
          time:          { value: 0.0 },
          sunDir:        { value: new THREE.Vector3(0.5, 0.8, 0.3) },
          sunIntensity:  { value: 1.0 },
          moonIntensity: { value: 0.0 },
          dayFraction:   { value: 0.5 },
          windDir:       { value: new THREE.Vector2(0.82, 0.38) },
        },
        vertexShader: `
          attribute vec2  grassUV;
          attribute float windPhase;
          attribute vec3  colorBot;
          attribute vec3  colorTip;
          uniform float time;
          uniform vec3  sunDir;
          uniform float sunIntensity;
          uniform float moonIntensity;
          uniform float dayFraction;
          uniform vec2  windDir;
          varying vec3  vColor;
          varying float vV;

          void main() {
            vec3 pos = position;
            float vH = grassUV.y; // 0 = root, 1 = tip

            // ── Wind: 3-component sway, quadratic root-pin ───────────────
            float curve = vH * vH; // roots pinned, tip swings freely
            float sway  = sin(windPhase + time * 1.80) * 0.42
                        + cos(windPhase * 0.71 + time * 1.12) * 0.24
                        + sin(time * 0.28 + windPhase * 0.036) * 0.52; // slow gust

            pos.x += sway * curve * 0.22 * windDir.x;
            pos.z += sway * curve * 0.22 * windDir.y;
            pos.y -= abs(sway) * curve * 0.035; // slight droop under load

            // ── Basic lighting ───────────────────────────────────────────
            float ao       = 0.12 + vH * 0.88;
            float sunFace  = max(0.0, sunDir.y) * 0.35 + 0.65;

            // Time-of-day
            float nightFactor = max(0.0,
              1.0 - smoothstep(0.25, 0.50, dayFraction)
                  * smoothstep(0.75, 0.50, dayFraction));
            float goldenHour = smoothstep(0.18, 0.28, dayFraction)
                             * (1.0 - smoothstep(0.72, 0.82, dayFraction));

            // Root → tip colour gradient
            vec3 col = mix(colorBot, colorTip, vH) * ao * sunFace
                     * (sunIntensity * 0.85 + 0.15);

            // Golden-hour warm tips
            col.r += goldenHour * vH * 0.18 * sunIntensity;
            col.g += goldenHour * vH * 0.07 * sunIntensity;

            // Night desaturation + moonlight
            col  = mix(col, vec3(0.04, 0.07, 0.13) * ao, nightFactor * 0.75);
            col += vec3(0.03, 0.04, 0.08) * moonIntensity * (0.2 + vH * 0.8);

            vColor = col;
            vV     = vH;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3  vColor;
          varying float vV;

          void main() {
            // Tip fade → pointed silhouette
            float alpha = 1.0 - smoothstep(0.70, 1.00, vV) * 0.92;
            // Root fade → smooth ground merge
            alpha *= smoothstep(0.0, 0.06, vV);

            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.10,
        depthWrite: true,
      });

      const grassMesh = new THREE.Mesh(grassGeo, grassMat);
      grassMesh.receiveShadow = false;
      scene.add(grassMesh);
      grassMatRef.current = grassMat;
    }

    // ── Wildflowers ─────────────────────────────────────────────────────────
    {
      const FLOWER_COUNT = 700;
      let fSeed = 4219;
      const fRng = () => {
        fSeed = (fSeed * 1664525 + 1013904223) & 0xffffffff;
        return (fSeed >>> 0) / 0xffffffff;
      };

      // Each flower: a small cross of 2 quads (petals) + thin stem triangle
      const flowerPalette: [number, number, number][] = [
        [1.00, 0.95, 0.15], // golden yellow
        [0.98, 0.98, 0.98], // white
        [0.92, 0.30, 0.52], // pink
        [0.65, 0.25, 0.88], // violet
        [1.00, 0.52, 0.08], // orange
        [0.20, 0.72, 0.95], // sky blue
      ];

      const fPos: number[] = [];
      const fCol: number[] = [];

      let placed = 0;
      let tries = 0;
      while (placed < FLOWER_COUNT && tries < FLOWER_COUNT * 8) {
        tries++;
        const wx = (fRng() - 0.5) * (WORLD_SIZE * 0.75);
        const wz = (fRng() - 0.5) * (WORLD_SIZE * 0.75);
        const wy = getTerrainHeightSampled(wx, wz);
        if (wy < 0.5 || wy > 10) continue;

        const ps = 0.07 + fRng() * 0.09;  // petal size
        const sh = 0.25 + fRng() * 0.45;  // stem height
        const [cr, cg, cb] = flowerPalette[Math.floor(fRng() * flowerPalette.length)];

        // Two diamond-shaped crossed petals
        const petals: [number, number, number][] = [
          // Petal quad 1 (XY plane)
          [-ps, sh, 0], [0, sh + ps * 1.4, 0], [ps, sh, 0],
          [-ps, sh, 0], [ps, sh, 0],             [0, sh - ps * 0.5, 0],
          // Petal quad 2 (ZY plane)
          [0, sh, -ps], [0, sh + ps * 1.4, 0], [0, sh, ps],
          [0, sh, -ps], [0, sh, ps],             [0, sh - ps * 0.5, 0],
        ];
        // Thin green stem
        const stem: [number, number, number][] = [
          [-0.015, 0, 0], [0.015, 0, 0], [0, sh, 0],
          [0, 0, -0.015], [0, 0, 0.015], [0, sh, 0],
        ];

        for (const [bx, by, bz] of petals) {
          fPos.push(wx + bx, wy + by, wz + bz);
          fCol.push(cr, cg, cb);
        }
        for (const [bx, by, bz] of stem) {
          fPos.push(wx + bx, wy + by, wz + bz);
          fCol.push(0.18, 0.58, 0.12); // green stem
        }
        placed++;
      }

      const flowerGeo = new THREE.BufferGeometry();
      flowerGeo.setAttribute("position", new THREE.Float32BufferAttribute(fPos, 3));
      flowerGeo.setAttribute("color",    new THREE.Float32BufferAttribute(fCol, 3));
      const flowerMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      const flowerMesh = new THREE.Mesh(flowerGeo, flowerMat);
      scene.add(flowerMesh);
    }

    // ── Clouds ───────────────────────────────────────────────────────────────
    function makeCloud(): THREE.Group {
      const cloud = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({
        color: 0xfafafa,
        transparent: true,
        opacity: 0.9,
      });
      const puffCount = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < puffCount; i++) {
        const r = 4 + Math.random() * 5;
        const geo = new THREE.SphereGeometry(r, 7, 5);
        const puff = new THREE.Mesh(geo, mat);
        puff.position.set(
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 9
        );
        cloud.add(puff);
      }
      return cloud;
    }
    for (let i = 0; i < 35; i++) {
      const cloud = makeCloud();
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 220;
      cloud.position.set(
        Math.cos(angle) * dist,
        48 + Math.random() * 45,
        Math.sin(angle) * dist
      );
      scene.add(cloud);
      // Each cloud drifts at a random direction and speed
      const driftAngle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      cloudsRef.current.push({
        mesh: cloud,
        vx: Math.cos(driftAngle) * speed,
        vz: Math.sin(driftAngle) * speed,
      });
    }

    // ── Rain Particles ───────────────────────────────────────────────────────
    {
      const rainGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(RAIN_DROP_COUNT * 3);
      for (let i = 0; i < RAIN_DROP_COUNT; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * RAIN_SPREAD * 2;
        positions[i * 3 + 1] = RAIN_Y_MIN + Math.random() * RAIN_HEIGHT_RANGE;
        positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_SPREAD * 2;
      }
      rainGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const rainMat = new THREE.PointsMaterial({
        color: 0xaaddff,
        size: 0.18,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const rain = new THREE.Points(rainGeo, rainMat);
      rain.visible = false;
      scene.add(rain);
      rainRef.current = rain;
    }

    // ── Lightning bolt ───────────────────────────────────────────────────────
    {
      const boltGeo = new THREE.BufferGeometry();
      // Placeholder flat line; will be rebuilt each time lightning strikes
      boltGeo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3)
      );
      const boltMat = new THREE.LineBasicMaterial({
        color: 0xddeeff,
        linewidth: 2,
        transparent: true,
        opacity: 0,
      });
      const bolt = new THREE.Line(boltGeo, boltMat);
      bolt.visible = false;
      scene.add(bolt);
      lightningBoltRef.current = bolt;
    }

    // ── Trees ───────────────────────────────────────────────────────────────
    let treeSeed = 123;
    const treeRng = () => {
      treeSeed = (treeSeed * 1664525 + 1013904223) & 0xffffffff;
      return (treeSeed >>> 0) / 0xffffffff;
    };
    const treePoints = generateSpawnPoints(TREE_COUNT, 20, 380, 123);
    treePoints.forEach((p) => {
      const result = buildTreeMesh(treeRng);
      result.group.position.set(p.x, p.y, p.z);
      scene.add(result.group);

      // Register foliage for wind animation (skip dead trees with empty foliage)
      if (result.foliageGroup.children.length > 0) {
        floraRef.current.push({
          foliageGroup: result.foliageGroup,
          rootMesh: result.group,
          windPhase: treeRng() * Math.PI * 2,
          windSpeed: 0.65 + treeRng() * 0.7,
          maxSway: result.hasCollision ? 0.025 : 0.045, // large trees sway less
          posX: p.x,
          posZ: p.z,
        });
      }

      // Register large trees for player collision
      if (result.hasCollision) {
        treeCollisionRef.current.push({
          x: p.x,
          z: p.z,
          radius: result.trunkRadius + PLAYER_RADIUS,
        });
      }
    });

    // ── Bushes / Shrubs ─────────────────────────────────────────────────────
    let bushSeed = 7391;
    const bushRng = () => {
      bushSeed = (bushSeed * 1664525 + 1013904223) & 0xffffffff;
      return (bushSeed >>> 0) / 0xffffffff;
    };
    // Bushes spawn closer to trees (min 8, max 340) and more densely
    const bushPoints = generateSpawnPoints(BUSH_COUNT, 8, 340, 7391);
    bushPoints.forEach((p) => {
      const result = buildBushMesh(bushRng);
      result.group.position.set(p.x, p.y, p.z);
      // Random rotation so all bushes face different ways
      result.group.rotation.y = bushRng() * Math.PI * 2;
      scene.add(result.group);

      // Bushes sway more than trees (flexible shrubs)
      floraRef.current.push({
        foliageGroup: result.foliageGroup,
        rootMesh: result.group,
        windPhase: bushRng() * Math.PI * 2,
        windSpeed: 0.9 + bushRng() * 0.9,
        maxSway: 0.06 + bushRng() * 0.04,
        posX: p.x,
        posZ: p.z,
      });
    });

    // ── Rocks ───────────────────────────────────────────────────────────────
    let rockSeed = 456;
    const rockRng = () => {
      rockSeed = (rockSeed * 1664525 + 1013904223) & 0xffffffff;
      return (rockSeed >>> 0) / 0xffffffff;
    };
    const rockPoints = generateSpawnPoints(ROCK_COUNT, 15, 380, 456);
    rockPoints.forEach((p) => {
      const { mesh: rock, collisionRadius: rockCollRadius } = buildRockMesh(rockRng);
      rock.position.set(p.x, p.y + 0.2, p.z);
      rock.rotation.y = rockRng() * Math.PI * 2;
      scene.add(rock);
      // All rocks block the player — even small ones are solid obstacles
      treeCollisionRef.current.push({ x: p.x, z: p.z, radius: rockCollRadius + PLAYER_RADIUS });
    });

    // ── Sheep ────────────────────────────────────────────────────────────────
    const sheepPoints = generateSpawnPoints(SHEEP_COUNT, 10, 120, 789);
    sheepListRef.current = sheepPoints.map((p) => {
      const parts: SheepMeshParts = buildSheepMesh();
      const { group, legPivots, headGroup, bodyGroup, tailGroup } = parts;
      group.position.set(p.x, p.y, p.z);
      const initialAngle = Math.random() * Math.PI * 2;
      group.rotation.y = -initialAngle;
      scene.add(group);

      // Spread out phase offsets so sheep don't all graze/move in lockstep
      const phaseOffset = Math.random() * Math.PI * 2;

      // Stagger grazing — half start grazing, half start walking
      const startGrazing = Math.random() < 0.3;

      return {
        mesh: group,
        velocity: new THREE.Vector2(0, 0),
        targetAngle: initialAngle,
        currentAngle: initialAngle,
        wanderTimer: 1.5 + Math.random() * 4,
        isFleeing: false,
        bleating: false,
        bleatTimer: 5 + Math.random() * 20,
        // animation
        walkPhase: phaseOffset,
        phaseOffset,
        legPivots,
        headGroup,
        bodyGroup,
        tailGroup,
        isGrazing: startGrazing,
        grazingTimer: startGrazing
          ? 2 + Math.random() * 6     // will start in graze
          : 10 + Math.random() * 25,  // will start walking
        headPitchTarget: startGrazing ? -0.65 : 0,
        headPitchCurrent: 0,
        // combat
        hp: 30,
        maxHp: 30,
        isAlive: true,
        hitFlashTimer: 0,
        isDying: false,
        deathTimer: 0,
        deathRotationY: initialAngle,
      };
    });

    // ── Foxes ────────────────────────────────────────────────────────────────
    const foxPoints = generateSpawnPoints(FOX_COUNT, 60, 200, 321);
    foxListRef.current = foxPoints.map((p) => {
      const mesh = buildFoxMesh();
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(mesh);
      return {
        mesh,
        wanderTimer: Math.random() * 4,
        wanderAngle: Math.random() * Math.PI * 2,
        hp: FOX_MAX_HP,
        maxHp: FOX_MAX_HP,
        isAlive: true,
        attackCooldown: Math.random() * 2,
        hitFlashTimer: 0,
        cachedNearestSheep: null,
        sheepSearchTimer: Math.random() * 0.25, // stagger initial searches
      };
    });

    // ── Catapults ─────────────────────────────────────────────────────────────
    // Placed at fixed strategic positions around the map (not random so they
    // don't spawn in water). 4 distant + 2 closer ones for early encounters.
    const catapultPositions = [
      { x:  80, z:  40 },
      { x: -75, z:  55 },
      { x:  60, z: -80 },
      { x: -55, z: -65 },
      { x:  38, z:  32 },   // closer to spawn — encountered early
      { x: -34, z: -38 },   // closer to spawn — encountered early
    ];
    catapultListRef.current = catapultPositions.slice(0, CATAPULT_COUNT).reduce<CatapultData[]>((acc, p) => {
      const ty = getTerrainHeightSampled(p.x, p.z);
      // Skip positions that would place the catapult in water
      if (ty < WATER_LEVEL) return acc;
      const { group, armGroup } = buildCatapultMesh();
      group.position.set(p.x, ty, p.z);
      // Face toward the map centre (player spawn area)
      group.rotation.y = Math.atan2(-p.x, -p.z);
      scene.add(group);
      acc.push({
        mesh: group,
        armGroup,
        hp: CATAPULT_MAX_HP,
        maxHp: CATAPULT_MAX_HP,
        isAlive: true,
        fireCooldown: 1 + Math.random() * 3, // stagger initial shots
        hitFlashTimer: 0,
        firingAnimation: 0,
      });
      return acc;
    }, []);

    // ── Cave ─────────────────────────────────────────────────────────────────
    {
      const caveY = getTerrainHeightSampled(CAVE_X, CAVE_Z);
      const caveGroup = buildCaveMesh();
      caveGroup.position.set(CAVE_X, caveY, CAVE_Z);
      // Cave entrance faces south (toward player spawn)
      caveGroup.rotation.y = Math.PI;
      scene.add(caveGroup);

      // ── Torches inside cave ──────────────────────────────────────────────
      // Positions are relative to cave entrance, along cave interior (-Z axis)
      const torchOffsets: Array<[number, number, number]> = [
        [-3.5, 2.8, -5],   // left wall near entrance
        [ 3.5, 2.8, -5],   // right wall near entrance
        [-3.5, 2.8, -12],  // left wall mid-cave
        [ 3.5, 2.8, -12],  // right wall mid-cave
        [-3.5, 2.8, -19],  // left wall deep
        [ 3.5, 2.8, -19],  // right wall deep
      ];

      caveTorchesRef.current = torchOffsets.map(([tx, ty, tz]) => {
        const torchMesh = buildTorchMesh();

        // Convert local offset to world position (cave faces PI rotation)
        const worldX = CAVE_X + Math.cos(Math.PI) * tx - Math.sin(Math.PI) * tz;
        const worldZ = CAVE_Z + Math.sin(Math.PI) * tx + Math.cos(Math.PI) * tz;
        const worldY = caveY + ty;

        torchMesh.position.set(worldX, worldY, worldZ);
        // Torch leans toward cave interior
        torchMesh.rotation.x = 0.25;
        scene.add(torchMesh);

        const light = new THREE.PointLight(0xff8822, 1.4, 12, 1.5);
        light.position.set(worldX, worldY + 0.8, worldZ);
        scene.add(light);

        return {
          mesh: torchMesh,
          light,
          baseIntensity: 1.4,
          flickerTimer: Math.random() * Math.PI * 2,
        };
      });

      // ── Treasure chest deep in cave ──────────────────────────────────────
      // Placed at the back of the cave interior
      const chestLocalX = 1.5;
      const chestLocalZ = -18;
      const chestWorldX = CAVE_X + Math.cos(Math.PI) * chestLocalX - Math.sin(Math.PI) * chestLocalZ;
      const chestWorldZ = CAVE_Z + Math.sin(Math.PI) * chestLocalX + Math.cos(Math.PI) * chestLocalZ;
      const chestWorldY = caveY;

      const { group: chestGroup, lidGroup } = buildTreasureChestMesh();
      chestGroup.position.set(chestWorldX, chestWorldY, chestWorldZ);
      chestGroup.rotation.y = Math.PI * 0.5;
      scene.add(chestGroup);

      // Subtle ambient glow near chest
      const chestLight = new THREE.PointLight(0xd4a017, 0.6, 6, 2);
      chestLight.position.set(chestWorldX, chestWorldY + 1.5, chestWorldZ);
      scene.add(chestLight);

      treasureChestRef.current = {
        mesh: chestGroup,
        lidGroup,
        isOpened: false,
        x: chestWorldX,
        z: chestWorldZ,
        rewardCoins: CHEST_REWARD_COINS,
      };

      // ── Spider spawning ──────────────────────────────────────────────────
      const isMob = IS_MOBILE;
      const allSpiders: SpiderData[] = [];
      (["small", "medium", "large"] as SpiderType[]).forEach((type) => {
        const cfg = SPIDER_TYPE_CONFIGS[type];
        const count = isMob ? SPIDER_COUNTS[type][1] : SPIDER_COUNTS[type][0];

        for (let i = 0; i < count; i++) {
          // Spawn spiders at random positions inside cave interior
          const angle = Math.random() * Math.PI * 2;
          const radius = 4 + Math.random() * 14;
          const spiderLocalX = Math.cos(angle) * radius * 0.5; // cave is narrow
          const spiderLocalZ = -(6 + Math.random() * 14);      // inside cave depth

          const spiderWorldX = CAVE_X + Math.cos(Math.PI) * spiderLocalX - Math.sin(Math.PI) * spiderLocalZ;
          const spiderWorldZ = CAVE_Z + Math.sin(Math.PI) * spiderLocalX + Math.cos(Math.PI) * spiderLocalZ;
          const spiderWorldY = caveY;

          const spiderMesh = buildSpiderMesh();
          spiderMesh.scale.setScalar(cfg.scale);
          spiderMesh.position.set(spiderWorldX, spiderWorldY, spiderWorldZ);
          spiderMesh.rotation.y = Math.random() * Math.PI * 2;
          scene.add(spiderMesh);

          allSpiders.push({
            mesh: spiderMesh,
            type,
            hp: cfg.maxHp,
            maxHp: cfg.maxHp,
            isAlive: true,
            attackCooldown: Math.random() * cfg.attackCooldown,
            hitFlashTimer: 0,
            wanderTimer: Math.random() * 3,
            wanderAngle: Math.random() * Math.PI * 2,
            caveX: CAVE_X,
            caveZ: CAVE_Z,
          });
        }
      });
      spiderListRef.current = allSpiders;
    }

    // ── Coins / Gems ─────────────────────────────────────────────────────────
    const coinPoints = generateSpawnPoints(COIN_COUNT, 20, 350, 555);
    coinsRef.current = coinPoints.map((p) => {
      const mesh = buildCoinMesh();
      mesh.position.set(p.x, p.y + 0.8, p.z);
      scene.add(mesh);
      return { mesh, collected: false };
    });

    // ── Fence / Pen ──────────────────────────────────────────────────────────
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
    const penPositions = [
      { x: 15, z: 0, ry: 0 },
      { x: -15, z: 0, ry: 0 },
      { x: 0, z: 15, ry: Math.PI / 2 },
      { x: 0, z: -15, ry: Math.PI / 2 },
    ];
    penPositions.forEach(({ x, z, ry }) => {
      for (let i = 0; i < 3; i++) {
        const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6);
        const post = new THREE.Mesh(postGeo, fenceMat);
        const py = getTerrainHeightSampled(
          x + (i - 1) * 3 * Math.cos(ry),
          z + (i - 1) * 3 * Math.sin(ry)
        );
        post.position.set(
          x + (i - 1) * 3 * Math.cos(ry),
          py + 0.6,
          z + (i - 1) * 3 * Math.sin(ry)
        );
        scene.add(post);
      }
      const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 9, 6);
      const rail = new THREE.Mesh(railGeo, fenceMat);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = ry;
      const ry2 = getTerrainHeightSampled(x, z);
      rail.position.set(x, ry2 + 0.9, z);
      scene.add(rail);
    });

    // ── Windmill (near the pen) ───────────────────────────────────────────────
    const { group: windmillGroup, blades } = buildWindmill();
    const windmillX = 28;
    const windmillZ = 28;
    windmillGroup.position.set(windmillX, getTerrainHeightSampled(windmillX, windmillZ), windmillZ);
    scene.add(windmillGroup);
    windmillBladesRef.current = blades;
    // Cylinder collider for the windmill tower (base radius 1.1)
    treeCollisionRef.current.push({ x: windmillX, z: windmillZ, radius: 1.1 + PLAYER_RADIUS });

    // ── Farmhouse (near the pen) ──────────────────────────────────────────────
    let houseSeed = 88;
    const houseRng = () => {
      houseSeed = (houseSeed * 1664525 + 1013904223) & 0xffffffff;
      return (houseSeed >>> 0) / 0xffffffff;
    };
    const house = buildHouse(houseRng);
    const houseX = -28;
    const houseZ = 22;
    house.position.set(houseX, getTerrainHeightSampled(houseX, houseZ), houseZ);
    house.rotation.y = Math.PI * 0.15;
    scene.add(house);
    // Box collider for the house walls (7×5.5 footprint, same rotation as the mesh)
    boxCollidersRef.current.push({ cx: houseX, cz: houseZ, halfW: 3.5, halfD: 2.75, rotY: Math.PI * 0.15 });

    // ── Ruins (distant location) ──────────────────────────────────────────────
    let ruinsSeed = 999;
    const ruinsRng = () => {
      ruinsSeed = (ruinsSeed * 1664525 + 1013904223) & 0xffffffff;
      return (ruinsSeed >>> 0) / 0xffffffff;
    };
    const { group: ruins, boxColliders: ruinsBoxes, cylColliders: ruinsCyls }: RuinsResult = buildRuins(ruinsRng);
    const ruinsX = 180;
    const ruinsZ = -120;
    const ruinsRotY = 0.4;
    ruins.position.set(ruinsX, getTerrainHeightSampled(ruinsX, ruinsZ), ruinsZ);
    ruins.rotation.y = ruinsRotY;
    scene.add(ruins);
    // Register ruins box colliders in world space (rotate local positions by ruinsRotY)
    {
      const cosR = Math.cos(ruinsRotY);
      const sinR = Math.sin(ruinsRotY);
      for (const bc of ruinsBoxes) {
        boxCollidersRef.current.push({
          cx: ruinsX + bc.lx * cosR - bc.lz * sinR,
          cz: ruinsZ + bc.lx * sinR + bc.lz * cosR,
          halfW: bc.halfW,
          halfD: bc.halfD,
          rotY: bc.rotY + ruinsRotY,
        });
      }
      for (const cc of ruinsCyls) {
        treeCollisionRef.current.push({
          x: ruinsX + cc.lx * cosR - cc.lz * sinR,
          z: ruinsZ + cc.lx * sinR + cc.lz * cosR,
          radius: cc.radius + PLAYER_RADIUS,
        });
      }
    }

    // ── Lighthouse (on a coastal rise) ───────────────────────────────────────
    const { group: lighthouse, beamPivot, lighthouseLight } = buildLighthouse();
    lighthouse.position.set(LIGHTHOUSE_X, getTerrainHeightSampled(LIGHTHOUSE_X, LIGHTHOUSE_Z), LIGHTHOUSE_Z);
    scene.add(lighthouse);
    lighthouseBeamRef.current = beamPivot;
    lighthouseLightRef.current = lighthouseLight;
    // Cylinder collider for the lighthouse base (base radius 2.2)
    treeCollisionRef.current.push({ x: LIGHTHOUSE_X, z: LIGHTHOUSE_Z, radius: 2.2 + PLAYER_RADIUS });

    // ── Mountain with waterfall and cave (southwest quadrant) ─────────────────
    {
      const mountainGroundY = getTerrainHeightSampled(MOUNTAIN_X, MOUNTAIN_Z);
      const mountainResult: CityResult = buildMountainWithWaterfallAndCave();
      mountainResult.group.position.set(MOUNTAIN_X, mountainGroundY, MOUNTAIN_Z);
      scene.add(mountainResult.group);

      // Register colliders in world space
      for (const bc of mountainResult.boxColliders) {
        boxCollidersRef.current.push({
          cx: MOUNTAIN_X + bc.lx,
          cz: MOUNTAIN_Z + bc.lz,
          halfW: bc.halfW,
          halfD: bc.halfD,
          rotY: bc.rotY,
        });
      }
      for (const cc of mountainResult.cylColliders) {
        treeCollisionRef.current.push({
          x: MOUNTAIN_X + cc.lx,
          z: MOUNTAIN_Z + cc.lz,
          radius: cc.radius + PLAYER_RADIUS,
        });
      }
    }

    // ── Boat (rowboat floating near the shore) ────────────────────────────────
    // Scan outward from player spawn to find the nearest water tile deep enough
    // for a boat to float, then place it just offshore.
    let boatSpawnX = 0;
    let boatSpawnZ = 0;
    let boatFound = false;
    for (let dist = 18; dist < 130 && !boatFound; dist += 6) {
      for (let angleDeg = 0; angleDeg < 360 && !boatFound; angleDeg += 12) {
        const a = (angleDeg * Math.PI) / 180;
        const tx = Math.cos(a) * dist;
        const tz = Math.sin(a) * dist;
        if (getTerrainHeight(tx, tz) < WATER_LEVEL - 1.0) {
          boatSpawnX = tx;
          boatSpawnZ = tz;
          boatFound = true;
        }
      }
    }
    const boat = buildBoatMesh();
    boat.position.set(boatSpawnX, WATER_LEVEL + 0.5, boatSpawnZ);
    scene.add(boat);
    boatRef.current = boat;

    // ── Harbor (dock + two sailboats) ─────────────────────────────────────────
    // Find a coastal spot: land at HARBOR_SEARCH_DIST, open water just beyond.
    const harborPos = findHarborPosition(getTerrainHeight, WATER_LEVEL, HARBOR_SEARCH_DIST);
    if (harborPos) {
      // Build and place the dock structure
      const dock = buildHarborDockMesh();
      const dockTerrainY = getTerrainHeight(harborPos.x, harborPos.z);
      dock.position.set(harborPos.x, dockTerrainY, harborPos.z);
      // Rotate so dock faces seaward (local +Z → seaward direction)
      dock.rotation.y = harborPos.angle + Math.PI; // +PI because angle points outward from origin
      scene.add(dock);
      harborDockRef.current = dock;

      // Compute the seaward dock-end position (where sailboats will be moored)
      const dockAngle = harborPos.angle;   // radians, points toward sea
      const DOCK_LEN  = 22;
      const dockEndX  = harborPos.x + Math.cos(dockAngle) * DOCK_LEN;
      const dockEndZ  = harborPos.z + Math.sin(dockAngle) * DOCK_LEN;

      // Perpendicular to dock direction (for side-by-side mooring)
      const perpAngle = dockAngle + Math.PI / 2;
      const MOORING_OFFSET = 5; // units to port/starboard of dock end

      const mooringPositions = [
        {
          x: dockEndX + Math.cos(perpAngle) * MOORING_OFFSET,
          z: dockEndZ + Math.sin(perpAngle) * MOORING_OFFSET,
          id: "harbor-ship-1",
        },
        {
          x: dockEndX + Math.cos(perpAngle) * -MOORING_OFFSET,
          z: dockEndZ + Math.sin(perpAngle) * -MOORING_OFFSET,
          id: "harbor-ship-2",
        },
      ];

      mooringPositions.forEach(({ x, z, id }) => {
        // Verify the mooring spot is in water; shift further out if needed
        let mx = x;
        let mz = z;
        for (let extra = 0; extra < 20; extra += 2) {
          if (getTerrainHeight(mx, mz) < WATER_LEVEL) break;
          mx = x + Math.cos(dockAngle) * extra;
          mz = z + Math.sin(dockAngle) * extra;
        }

        const { group: sailboat, sailMesh, sailGroup } = buildSailboatMesh();
        sailboat.position.set(mx, WATER_LEVEL + 0.55, mz);
        // Face the boat toward open sea
        sailboat.rotation.y = dockAngle;
        scene.add(sailboat);

        harborShipsRef.current.push({
          mesh: sailboat,
          id,
          velocity: 0,
          yaw: dockAngle,
          sailMesh,
          sailGroup,
        });
      });
    }

    // ── MotherShip ────────────────────────────────────────────────────────────
    // Massive alien mothership hovering high in the sky above the world center.
    // Scaled to 0.55× so the outer ring (~52 unit radius) reads well at distance.
    const { group: shipGroup, lights: shipLights } = buildMotherShipMesh();
    shipGroup.scale.setScalar(0.55);
    // Position above the world, slightly to the north, tilted to look dramatic
    shipGroup.position.set(0, 170, -60);
    shipGroup.rotation.z = 0.06; // very slight list
    scene.add(shipGroup);
    motherShipRef.current = shipGroup;
    motherShipLightsRef.current = shipLights;

    // ── Rocket & Launch Pad ────────────────────────────────────────────────────
    // Fixed position on flat ground, roughly aimed at the mothership above.
    {
      // Find the nearest above-water position starting from the preferred spawn
      let rx = ROCKET_SPAWN_X;
      let rz = ROCKET_SPAWN_Z;
      if (getTerrainHeightSampled(rx, rz) < WATER_LEVEL) {
        outer_rocket: for (let r = 5; r <= 80; r += 5) {
          for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            const tx = ROCKET_SPAWN_X + Math.cos(angle) * r;
            const tz = ROCKET_SPAWN_Z + Math.sin(angle) * r;
            if (getTerrainHeightSampled(tx, tz) >= WATER_LEVEL) {
              rx = tx; rz = tz;
              break outer_rocket;
            }
          }
        }
      }
      const groundY = Math.max(getTerrainHeightSampled(rx, rz), WATER_LEVEL);
      const { group: rocketGroup, flameGroup, launchPad, exhaustParticles } = buildRocketMesh();
      // Rocket sits above the ground; launch pad stays fixed on the ground separately
      rocketGroup.position.set(rx, groundY, rz);
      scene.add(rocketGroup);
      // Launch pad is added directly to the scene so it stays grounded while rocket flies
      launchPad.position.set(rx, groundY, rz);
      scene.add(launchPad);

      rocketDataRef.current = {
        mesh: rocketGroup,
        flameGroup,
        launchPadMesh: launchPad,
        state: 'idle',
        launchProgress: 0,
        groundY,
        spawnX: rx,
        spawnZ: rz,
        countdown: 3,
        countdownTimer: 0,
        exhaustParticles,
      };
    }

    // ── Space Station Interior ─────────────────────────────────────────────────
    {
      const stationResult = buildSpaceStationInterior();
      stationResult.group.position.set(
        SPACE_STATION_WORLD_X,
        SPACE_STATION_WORLD_Y,
        SPACE_STATION_WORLD_Z
      );
      scene.add(stationResult.group);
      spaceStationGroupRef.current = stationResult.group;
      spaceStationRoomsRef.current = stationResult.rooms;
      spaceStationLightsRef.current = stationResult.lights;
      spaceStationAnimMeshesRef.current = stationResult.animatedMeshes;
    }

    // ── Airplane & Airstrip ────────────────────────────────────────────────────
    {
      // Find the nearest above-water position starting from the preferred spawn
      let ax = AIRPLANE_SPAWN_X;
      let az = AIRPLANE_SPAWN_Z;
      if (getTerrainHeightSampled(ax, az) < WATER_LEVEL) {
        outer_airplane: for (let r = 5; r <= 80; r += 5) {
          for (let a = 0; a < 16; a++) {
            const angle = (a / 16) * Math.PI * 2;
            const tx = AIRPLANE_SPAWN_X + Math.cos(angle) * r;
            const tz = AIRPLANE_SPAWN_Z + Math.sin(angle) * r;
            if (getTerrainHeightSampled(tx, tz) >= WATER_LEVEL) {
              ax = tx; az = tz;
              break outer_airplane;
            }
          }
        }
      }
      const groundY = Math.max(getTerrainHeightSampled(ax, az), WATER_LEVEL);

      // Airstrip runway (stays on ground)
      const airstrip = buildAirstripMesh();
      airstrip.position.set(ax, groundY + 0.04, az);
      scene.add(airstrip);

      // Directional sign near spawn — rotated so its +X arrow points toward the airstrip
      // Airstrip is at ~(50, ?, 20) from spawn (0,0). Angle = atan2(50, 20) ≈ 1.19 rad from +Z
      {
        const signGy = getTerrainHeightSampled(8, 4);
        const sign = buildAirstripSignMesh();
        sign.position.set(8, signGy, 4);
        // Rotate so the arrow (+X local) points from (8,4) toward airstrip centre
        const dirX = ax - 8;
        const dirZ = az - 4;
        sign.rotation.y = -Math.atan2(dirX, dirZ);
        scene.add(sign);
      }

      // Airplane mesh
      const { group: airplaneGroup, propeller } = buildAirplane3DMesh();
      airplaneGroup.position.set(ax, groundY + AIRPLANE_START_HEIGHT, az);
      // Nose faces +Z by default — rotate 180° so nose faces -Z (south) ready for take-off run
      airplaneGroup.rotation.y = Math.PI;
      scene.add(airplaneGroup);

      airplaneDataRef.current = {
        mesh: airplaneGroup,
        propeller,
        state: 'idle',
        position: new THREE.Vector3(ax, groundY + AIRPLANE_START_HEIGHT, az),
        velocity: new THREE.Vector3(0, 0, 0),
        pitch: 0,
        yaw: Math.PI,
        roll: 0,
        speed: 0,
        groundY,
        spawnX: ax,
        spawnZ: az,
      };
    }

    // ── Two-scene separation: Earth world vs Space Station interior ───────────
    // Group all Earth-world objects so we can toggle them invisible while inside
    // the space station, eliminating hundreds of draw calls and AI updates.
    {
      const earthGroup = new THREE.Group();
      earthGroup.name = 'earthWorld';
      const stationGroup = spaceStationGroupRef.current!;
      // Collect every current scene child EXCEPT the camera and the station group.
      // The camera must stay as a direct scene child so its children (weapon, etc.)
      // always render regardless of which scene the player is in.
      const toMove: THREE.Object3D[] = [];
      scene.children.forEach((child) => {
        if (child !== stationGroup && child !== camera) {
          toMove.push(child);
        }
      });
      toMove.forEach((child) => {
        scene.remove(child);
        earthGroup.add(child);
      });
      scene.add(earthGroup);
      earthSceneGroupRef.current = earthGroup;
      // Station starts hidden — only made visible when the player enters it.
      stationGroup.visible = false;
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    // ── Helper: place held item via raycast from camera ───────────────────────
    const tryPlaceHeldItemViaRaycast = (): boolean => {
      if (!heldItemRef.current || !cameraRef.current || !terrainMeshRef.current) return false;
      const cam = cameraRef.current;
      const raycaster = buildRaycasterRef.current;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
      // Gather objects to intersect: terrain + placed blocks
      const targets: THREE.Object3D[] = [terrainMeshRef.current, ...Array.from(placedBlockMeshesRef.current.values())];
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const hit = hits[0];
        // Place on top of the hit surface
        const pos = hit.point.clone();
        pos.y = getTerrainHeightSampled(pos.x, pos.z);
        placeHeldItem(pos, cam.rotation.y);
        return true;
      }
      return false;
    };

    // ── Mouse click — attack OR build depending on current mode ───────────────
    const onMouseDown = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      if (e.button === 0) {
        // If holding an item, left click places it (or throws bomb)
        if (heldItemRef.current && buildModeRef.current === "explore") {
          if (heldItemRef.current.type === "bomb") {
            throwBomb();
          } else {
            tryPlaceHeldItemViaRaycast();
          }
          return;
        }
        if (buildModeRef.current === "build") {
          if (ghostMeshRef.current?.visible) {
            placeBlock(ghostMeshRef.current.position.clone());
          }
        } else if (buildModeRef.current === "explore") {
          if (selectedWeaponRef.current === "bow") {
            // Bow: start charging on press — fire on release
            isBowChargingRef.current = true;
            bowChargeStartRef.current = performance.now();
            bowChargeRef.current = 0;
            if (bowChargeBarRef.current) {
              bowChargeBarRef.current.style.width = "0%";
              bowChargeBarRef.current.parentElement!.style.opacity = "1";
            }
          } else {
            isMouseHeldRef.current = true; // start auto-fire loop for other weapons
            doAttack(); // fire immediately on first click
          }
        }
        // sculpt mode: scroll wheel sculpts, left click does nothing extra
      } else if (e.button === 2 && buildModeRef.current !== "explore") {
        removeBlock();
      }
    };
    document.addEventListener("mousedown", onMouseDown);

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        // ── Bow release: fire with power proportional to draw time ──────────
        if (isBowChargingRef.current && buildModeRef.current === "explore") {
          isBowChargingRef.current = false;
          const chargeSeconds = (performance.now() - bowChargeStartRef.current) / 1000;
          const power = Math.min(1.0, Math.max(0.1, chargeSeconds / BOW_MAX_CHARGE_TIME));
          bowChargeRef.current = 0;
          if (bowChargeBarRef.current) {
            bowChargeBarRef.current.style.width = "0%";
            bowChargeBarRef.current.parentElement!.style.opacity = "0";
          }
          doAttack(power);
        }
        isMouseHeldRef.current = false;
        isBowChargingRef.current = false;
      }
    };
    document.addEventListener("mouseup", onMouseUp);

    // Suppress context menu while pointer is locked (needed for right-click removal)
    const onContextMenu = (e: MouseEvent) => {
      if (isLockedRef.current) e.preventDefault();
    };
    document.addEventListener("contextmenu", onContextMenu);

    const IMPLEMENT_WORD = "IMPLEMENT";
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === "keydown";

      // F key: place held item (if carrying one) OR attack in explore mode
      // Bombs are thrown with G, not placed — skip placement for bomb type
      if (e.type === "keydown" && e.code === "KeyF" && buildModeRef.current === "explore") {
        if (heldItemRef.current && heldItemRef.current.type !== "bomb") {
          tryPlaceHeldItemViaRaycast();
        } else if (!heldItemRef.current) {
          doAttack();
        }
      }

      // E key: board/exit boat, board rocket, enter/exit space station, OR possess/unpossess nearby sheep
      if (e.type === "keydown" && e.code === "KeyE") {
        // ── Enter space station (when rocket has arrived at mothership) ───────
        if (rocketArrivedRef.current && !inSpaceStationRef.current && cameraRef.current) {
          inSpaceStationRef.current = true;
          setInSpaceStation(true);
          setRocketArrived(false);
          rocketArrivedRef.current = false;
          // Player leaves the rocket and enters the station
          onRocketRef.current = false;
          setOnRocket(false);
          stationWelcomeTimerRef.current = 4;
          setStationWelcome(true);
          const cam = cameraRef.current;
          // Teleport player into station airlock
          cam.position.set(
            SPACE_STATION_WORLD_X + 0,
            SPACE_STATION_WORLD_Y + 1.8,
            SPACE_STATION_WORLD_Z + 0
          );
          playerBodyPosRef.current.copy(cam.position);
          playerRef.current.velY = 0;
          playerRef.current.onGround = true;
          if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
          // ── Scene switch: hide Earth world, show station interior ───────────
          // Hiding earthGroup eliminates rendering of ~300+ Earth objects, curing lag.
          if (earthSceneGroupRef.current) earthSceneGroupRef.current.visible = false;
          if (spaceStationGroupRef.current) spaceStationGroupRef.current.visible = true;
          // Deep-space background — no fog (station interior is small, fog not needed)
          scene.fog = null;
          scene.background = new THREE.Color(0x000510);
          return;
        }

        // ── Exit space station via airlock — teleport back to Earth ─────────
        if (inSpaceStationRef.current && cameraRef.current) {
          const cam = cameraRef.current;
          const localX = cam.position.x - SPACE_STATION_WORLD_X;
          const localZ = cam.position.z - SPACE_STATION_WORLD_Z;
          const nearAirlock = Math.abs(localX) <= 5.5 && Math.abs(localZ) <= 5.5;
          if (nearAirlock) {
            inSpaceStationRef.current = false;
            setInSpaceStation(false);
            setNearAirlockExit(false);
            setStationWelcome(false);
            stationWelcomeTimerRef.current = 0;
            // Return player to Earth near the rocket launch pad
            const rd = rocketDataRef.current;
            const rSpawnX = rd ? rd.spawnX : ROCKET_SPAWN_X;
            const rSpawnZ = rd ? rd.spawnZ : ROCKET_SPAWN_Z;
            const landX = rSpawnX + 4;
            const landZ = rSpawnZ + 4;
            const landY = getTerrainHeightSampled(landX, landZ);
            cam.position.set(landX, landY + PLAYER_HEIGHT, landZ);
            if (rd) {
              rd.state = 'idle';
              rd.launchProgress = 0;
              rd.mesh.position.set(rSpawnX, rd.groundY, rSpawnZ);
            }
            playerBodyPosRef.current.copy(cam.position);
            playerRef.current.velY = 0;
            playerRef.current.onGround = true;
            if (weaponMeshRef.current) weaponMeshRef.current.visible = cameraModeRef.current === "first";
            // ── Scene switch: restore Earth world, hide station interior ───────
            if (earthSceneGroupRef.current) earthSceneGroupRef.current.visible = true;
            if (spaceStationGroupRef.current) spaceStationGroupRef.current.visible = false;
            // Restore Earth atmosphere — fog density will be set on next animation frame
            scene.fog = new THREE.FogExp2(0x87ceeb, 0.006);
            // scene.background will be restored by the day/night cycle on the next frame
            return;
          }
        }

        if (onAirplaneRef.current) {
          // ── Exit airplane — parachute player to ground ─────────────────────
          const ad = airplaneDataRef.current;
          if (ad && cameraRef.current) {
            // Drop player below airplane, let normal gravity take over
            const ex = ad.position.x + 4;
            const ez = ad.position.z;
            const ey = ad.position.y;
            cameraRef.current.position.set(ex, ey, ez);
            playerBodyPosRef.current.copy(cameraRef.current.position);
            playerRef.current.velY = -2;
            playerRef.current.onGround = false;
            // Leave airplane flying on autopilot (keep going straight)
            ad.state = 'flying';
          }
          onAirplaneRef.current = false;
          setOnAirplane(false);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = cameraModeRef.current === "first";
        } else if (nearAirplaneForBoardRef.current && !possessedSheepRef.current && !onBoatRef.current && !onRocketRef.current) {
          // ── Board the airplane ──────────────────────────────────────────────
          const ad = airplaneDataRef.current;
          if (ad && (ad.state === 'idle' || ad.state === 'flying')) {
            onAirplaneRef.current = true;
            setOnAirplane(true);
            ad.state = 'flying';
            if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
          }
        } else if (onRocketRef.current) {
          // ── Exit rocket (only allowed while idle/boarded, not during launch) ─
          const rd = rocketDataRef.current;
          if (rd && (rd.state === 'idle' || rd.state === 'boarded') && cameraRef.current) {
            // Place player at the base of the rocket
            const gx = rd.mesh.position.x + 3;
            const gz = rd.mesh.position.z;
            const gy = getTerrainHeightSampled(gx, gz);
            cameraRef.current.position.set(gx, gy + PLAYER_HEIGHT, gz);
            playerBodyPosRef.current.copy(cameraRef.current.position);
            playerRef.current.velY = 0;
            playerRef.current.onGround = true;
            rd.state = 'idle';
          }
          onRocketRef.current = false;
          setOnRocket(false);
          setRocketCountdown(null);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = cameraModeRef.current === "first";
        } else if (nearRocketForBoardRef.current && !possessedSheepRef.current && !onBoatRef.current) {
          // ── Board the rocket ────────────────────────────────────────────────
          const rd = rocketDataRef.current;
          if (rd && rd.state === 'idle') {
            onRocketRef.current = true;
            setOnRocket(true);
            rd.state = 'boarded';
            if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
          }
        } else if (activeHarborShipRef.current) {
          // ── Exit harbor sailboat ───────────────────────────────────────────
          const ship = activeHarborShipRef.current;
          if (cameraRef.current) {
            // Find nearest land to disembark
            let landX = ship.mesh.position.x;
            let landZ = ship.mesh.position.z;
            let foundLand = false;
            for (let d = 4; d < 50 && !foundLand; d += 2) {
              for (let a = 0; a < Math.PI * 2 && !foundLand; a += 0.25) {
                const tx = ship.mesh.position.x + Math.cos(a) * d;
                const tz = ship.mesh.position.z + Math.sin(a) * d;
                if (getTerrainHeightSampled(tx, tz) >= WATER_LEVEL) {
                  landX = tx;
                  landZ = tz;
                  foundLand = true;
                }
              }
            }
            const landY = getTerrainHeightSampled(landX, landZ);
            cameraRef.current.position.set(landX, landY + PLAYER_HEIGHT, landZ);
            playerBodyPosRef.current.copy(cameraRef.current.position);
            playerRef.current.velY = 0;
            playerRef.current.onGround = true;
          }
          // Stop ship movement on disembark
          ship.velocity = 0;
          activeHarborShipRef.current = null;
          setOnHarborShip(false);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = cameraModeRef.current === "first";
        } else if (nearHarborShipRef.current && !possessedSheepRef.current && !onBoatRef.current) {
          // ── Board a harbor sailboat ────────────────────────────────────────
          const ship = nearHarborShipRef.current;
          activeHarborShipRef.current = ship;
          setOnHarborShip(true);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
        } else if (onBoatRef.current) {
          // ── Exit boat: find nearest land to place the player ───────────────
          const boat = boatRef.current;
          if (boat && cameraRef.current) {
            let landX = boat.position.x;
            let landZ = boat.position.z;
            let foundLand = false;
            for (let d = 4; d < 40 && !foundLand; d += 2) {
              for (let a = 0; a < Math.PI * 2 && !foundLand; a += 0.25) {
                const tx = boat.position.x + Math.cos(a) * d;
                const tz = boat.position.z + Math.sin(a) * d;
                if (getTerrainHeightSampled(tx, tz) >= WATER_LEVEL) {
                  landX = tx;
                  landZ = tz;
                  foundLand = true;
                }
              }
            }
            const landY = getTerrainHeightSampled(landX, landZ);
            cameraRef.current.position.set(landX, landY + PLAYER_HEIGHT, landZ);
            playerBodyPosRef.current.copy(cameraRef.current.position);
            playerRef.current.velY = 0;
            playerRef.current.onGround = true;
          }
          onBoatRef.current = false;
          setOnBoat(false);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = cameraModeRef.current === "first";
        } else if (nearBoatForBoardRef.current && !possessedSheepRef.current) {
          // ── Board the boat ─────────────────────────────────────────────────
          onBoatRef.current = true;
          setOnBoat(true);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
        } else if (heldItemRef.current) {
          // ── Drop held item at player's feet ──────────────────────────────
          dropHeldItem();
        } else if (nearestPickableItemRef.current && !possessedSheepRef.current) {
          // ── Pick up nearby item ───────────────────────────────────────────
          pickUpItem(nearestPickableItemRef.current);
          nearestPickableItemRef.current = null;
          setNearItemPrompt(null);
        } else if (possessedSheepRef.current) {
          // Exit possession — place player above the sheep's current position
          const sheep = possessedSheepRef.current;
          if (cameraRef.current) {
            const groundY = getTerrainHeightSampled(
              sheep.mesh.position.x,
              sheep.mesh.position.z
            );
            cameraRef.current.position.set(
              sheep.mesh.position.x,
              groundY + PLAYER_HEIGHT,
              sheep.mesh.position.z
            );
            playerRef.current.velY = 0;
            playerRef.current.onGround = true;
          }
          // Remove highlight before clearing ref
          setSheepEmissive(sheep, 0x000000);
          highlightedSheepRef.current = null;
          possessedSheepRef.current = null;
          setIsPossessed(false);
          // Restore weapon visibility only in first-person mode
          if (weaponMeshRef.current) weaponMeshRef.current.visible = cameraModeRef.current === "first";
        } else if (nearestSheepForPossessRef.current) {
          // Enter sheep body
          possessedSheepRef.current = nearestSheepForPossessRef.current;
          setIsPossessed(true);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
        }
      }

      // Space key — launch rocket when boarded (start countdown)
      if (e.type === "keydown" && e.code === "Space" && onRocketRef.current) {
        const rd = rocketDataRef.current;
        if (rd && rd.state === 'boarded') {
          rd.state = 'countdown';
          rd.countdown = 3;
          rd.countdownTimer = 0;
          setRocketCountdown(3);
        }
      }

      // V key — toggle first/third-person camera (works in explore mode AND while possessing a sheep)
      if (e.type === "keydown" && e.code === "KeyV") {
        const newMode = cameraModeRef.current === "first" ? "third" : "first";
        cameraModeRef.current = newMode;
        setCameraMode(newMode);
        if (weaponMeshRef.current) {
          // Weapon hidden while possessed or on rocket regardless of camera mode
          weaponMeshRef.current.visible = newMode === "first" && !possessedSheepRef.current && !onRocketRef.current;
        }
        if (playerBodyRef.current) {
          // Player body only shown in 3rd-person when NOT possessing a sheep and NOT on rocket
          playerBodyRef.current.visible = newMode === "third" && !possessedSheepRef.current && !onRocketRef.current;
        }
        // Snap camera back to eye-level when returning to first-person (explore mode only)
        if (newMode === "first" && cameraRef.current && !possessedSheepRef.current && !onRocketRef.current) {
          cameraRef.current.position.set(
            playerBodyPosRef.current.x,
            playerBodyPosRef.current.y + PLAYER_HEIGHT,
            playerBodyPosRef.current.z
          );
        }
      }

      // G key — throw held bomb
      if (e.type === "keydown" && e.code === "KeyG" && buildModeRef.current === "explore") {
        if (heldItemRef.current?.type === "bomb") {
          throwBomb();
        }
      }

      // B key — toggle build mode on/off
      if (e.type === "keydown" && e.code === "KeyB") {
        const next: BuildMode = buildModeRef.current !== "explore" ? "explore" : "build";
        buildModeRef.current = next;
        if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
        if (sculptIndicatorRef.current) sculptIndicatorRef.current.visible = false;
        setBuildingUiState((s) => ({ ...s, mode: next }));
      }

      // T key — toggle sculpt sub-mode (only when already in build mode)
      if (e.type === "keydown" && e.code === "KeyT" && buildModeRef.current !== "explore") {
        const next: BuildMode = buildModeRef.current === "sculpt" ? "build" : "sculpt";
        buildModeRef.current = next;
        if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
        if (sculptIndicatorRef.current) sculptIndicatorRef.current.visible = false;
        setBuildingUiState((s) => ({ ...s, mode: next }));
      }

      // T key — open chat (only in explore mode; build mode uses T for sculpt)
      if (e.type === "keydown" && e.code === "KeyT" && buildModeRef.current === "explore" && isLockedRef.current) {
        e.preventDefault();
        document.exitPointerLock();
        setChatOpen(true);
      }

      // Digit keys 1–3 — select weapon in explore mode
      if (e.type === "keydown" && buildModeRef.current === "explore") {
        const WEAPON_ORDER: WeaponType[] = ["sword", "bow", "crossbow"];
        if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") {
          const idx = parseInt(e.code.replace("Digit", "")) - 1;
          const newWeapon = WEAPON_ORDER[idx];
          setSelectedWeapon(newWeapon);
          selectedWeaponRef.current = newWeapon;
          swapWeaponMesh(newWeapon);
        }
      }

      // Digit keys 1–8 — select block material in build mode
      if (e.type === "keydown" && buildModeRef.current !== "explore") {
        const digit = parseInt(e.key);
        if (digit >= 1 && digit <= 8) {
          const newMat = BLOCK_MATERIAL_ORDER[digit - 1];
          selectedMaterialRef.current = newMat;
          if (ghostMeshRef.current) updateGhostMaterial(ghostMeshRef.current, newMat);
          setBuildingUiState((s) => ({ ...s, selectedMaterial: newMat }));
        }
      }

      // IMPLEMENT word detection — any single printable character
      if (e.type === "keydown" && e.key.length === 1) {
        implementBufferRef.current += e.key.toUpperCase();
        if (implementBufferRef.current.length > IMPLEMENT_WORD.length) {
          implementBufferRef.current = implementBufferRef.current.slice(
            -IMPLEMENT_WORD.length
          );
        }
        if (implementBufferRef.current === IMPLEMENT_WORD) {
          implementBufferRef.current = "";
          // Release pointer lock first so user can interact with the panel
          if (document.pointerLockElement) document.exitPointerLock();
          window.dispatchEvent(new CustomEvent("openFeedback"));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    const onMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      const sens = 0.002;
      yawRef.current -= e.movementX * sens;
      pitchRef.current -= e.movementY * sens;
      pitchRef.current = Math.max(
        -Math.PI / 2.2,
        Math.min(Math.PI / 2.2, pitchRef.current)
      );
    };
    document.addEventListener("mousemove", onMouseMove);

    const onLockChange = () => {
      const locked = document.pointerLockElement === mountRef.current;
      isLockedRef.current = locked;
      if (!locked) isMouseHeldRef.current = false; // stop auto-fire when pointer lock is released
      setGameState((s) => ({ ...s, isLocked: locked }));
      if (locked) {
        setShowIntro(false);
        setGameStarted(true);
        if (!gameEverStartedRef.current) {
          // First lock – bootstrap audio and start the loop for the first time
          gameEverStartedRef.current = true;
          soundManager.init();
        } else {
          // Returning from pause – resume audio and restart the rAF loop
          soundManager.resume();
          prevTimeRef.current = performance.now();
          restartAnimLoopRef.current?.();
        }
      } else if (gameEverStartedRef.current) {
        // Game paused – stop the loop and silence all audio
        cancelAnimationFrame(animFrameRef.current);
        soundManager.pause();
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);

    // ── Mouse wheel — sculpt terrain or cycle materials ───────────────────────
    const onWheel = (e: WheelEvent) => {
      if (!isLockedRef.current) return;

      if (buildModeRef.current === "sculpt") {
        const cam = cameraRef.current;
        const terrainMesh = terrainMeshRef.current;
        if (!cam || !terrainMesh) return;

        const raycaster = buildRaycasterRef.current;
        raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
        raycaster.far = BUILD_RANGE * 2;
        const hits = raycaster.intersectObject(terrainMesh, false);
        if (hits.length > 0) {
          const delta = e.deltaY > 0 ? -SCULPT_STRENGTH : SCULPT_STRENGTH;
          modifyTerrainHeight(hits[0].point.x, hits[0].point.z, delta, SCULPT_RADIUS);
          updateTerrainGeometry(terrainMesh);
          soundManager.playTerrainSculpt();
        }
      } else if (buildModeRef.current === "build") {
        const cur = BLOCK_MATERIAL_ORDER.indexOf(selectedMaterialRef.current);
        const next =
          (cur + (e.deltaY > 0 ? 1 : -1) + BLOCK_MATERIAL_ORDER.length) %
          BLOCK_MATERIAL_ORDER.length;
        const newMat = BLOCK_MATERIAL_ORDER[next];
        selectedMaterialRef.current = newMat;
        if (ghostMeshRef.current) updateGhostMaterial(ghostMeshRef.current, newMat);
        setBuildingUiState((s) => ({ ...s, selectedMaterial: newMat }));
      } else if (buildModeRef.current === "explore") {
        // Mouse wheel — cycle through weapons
        const WEAPON_ORDER: WeaponType[] = ["sword", "bow", "crossbow"];
        const cur = WEAPON_ORDER.indexOf(selectedWeaponRef.current);
        const next = (cur + (e.deltaY > 0 ? 1 : -1) + WEAPON_ORDER.length) % WEAPON_ORDER.length;
        const newWeapon = WEAPON_ORDER[next];
        setSelectedWeapon(newWeapon);
        selectedWeaponRef.current = newWeapon;
        swapWeaponMesh(newWeapon);
      }
    };
    // passive: false would suppress default scrolling, but we keep passive:true
    // since we don't need to block page scroll (pointer lock suppresses it anyway)
    window.addEventListener("wheel", onWheel);

    // ── Animation loop ────────────────────────────────────────────────────────
    let elapsed = 0;
    let frameCount = 0; // incremented each frame — used to throttle expensive updates
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - prevTimeRef.current) / 1000, 0.05);
      prevTimeRef.current = now;
      elapsed += dt;
      frameCount++;

      // ── Sync player body position in first-person (always matches cam.position) ──
      if (cameraModeRef.current === "first" && cameraRef.current) {
        playerBodyPosRef.current.copy(cameraRef.current.position);
      }

      // ── Earth-world visual updates (skipped while inside the space station) ──
      // When inSpaceStation, earthGroup.visible=false already prevents rendering,
      // but we also skip these CPU-side updates to avoid touching null fog, running
      // AI for 200 sheep, weather transitions, etc.
      const _inStation = inSpaceStationRef.current;

      // ── Day / Night cycle ──────────────────────────────────────────────────
      dayTimeRef.current = (dayTimeRef.current + dt) % DAY_DURATION;
      const dayFraction = dayTimeRef.current / DAY_DURATION;
      // Smooth night factor: 1.0 at full night, 0.0 at full day
      // Transitions over sunrise (0.18→0.25) and sunset (0.75→0.82)
      const nightFactor =
        dayFraction < 0.18   ? 1.0
        : dayFraction < 0.25 ? 1.0 - smoothstep(0.18, 0.25, dayFraction)
        : dayFraction < 0.75 ? 0.0
        : dayFraction < 0.82 ? smoothstep(0.75, 0.82, dayFraction)
        : 1.0;
      soundManager.updateDaytime(dayFraction);

      const baseSkyColor = getSkyColor(dayFraction);
      // Tint sky toward storm grey based on current weather cloud darkness
      const stormBlend =
        weatherBlendRef.current < 1
          ? lerpWeatherConfig(
              WEATHER_CONFIGS[weatherPrevStateRef.current],
              WEATHER_CONFIGS[weatherStateRef.current],
              weatherBlendRef.current
            ).cloudDarkness
          : WEATHER_CONFIGS[weatherStateRef.current].cloudDarkness;
      const stormGrey = new THREE.Color(0.38, 0.40, 0.45);
      const skyColor = baseSkyColor.clone().lerp(stormGrey, stormBlend * 0.7);
      // Only update Earth sky/fog visuals when NOT in the station (fog is null there)
      if (!_inStation) {
        scene.background = skyColor;
        if (scene.fog) (scene.fog as THREE.FogExp2).color = skyColor;
        if (skyMeshRef.current) {
          (skyMeshRef.current.material as THREE.MeshBasicMaterial).color = skyColor;
        }
      }

      if (sunRef.current) {
        const sunAngle = (dayFraction - 0.25) * Math.PI * 2;
        sunRef.current.position.set(
          Math.cos(sunAngle) * 200,
          Math.sin(sunAngle) * 180,
          80
        );
        sunRef.current.intensity = getSunIntensity(dayFraction);

        // ── Volumetric sun disc + corona ────────────────────────────────────
        const sunIntensity = getSunIntensity(dayFraction);
        const isDaytime = sunIntensity > 0;
        if (sunDiscRef.current) {
          // Place sun disc on the sky sphere surface along same direction as light
          const sunDir = sunRef.current.position.clone().normalize();
          sunDiscRef.current.position.copy(sunDir.multiplyScalar(450));
          sunDiscRef.current.visible = isDaytime;
          // Shift colour toward orange at dawn/dusk, white-yellow at noon
          const mat = sunDiscRef.current.material as THREE.MeshBasicMaterial;
          if (isDaytime) {
            const isGoldenHour = dayFraction < 0.32 || dayFraction > 0.68;
            if (isGoldenHour) {
              mat.color.set(new THREE.Color(2.2, 0.9, 0.25)); // deep orange HDR
            } else {
              mat.color.set(new THREE.Color(2.0, 1.6, 1.0)); // warm white HDR
            }
          }
        }
        if (sunCoronaRef.current) {
          const sunDir2 = sunRef.current.position.clone().normalize();
          sunCoronaRef.current.position.copy(sunDir2.multiplyScalar(448));
          sunCoronaRef.current.visible = isDaytime;
          const coronaMat = sunCoronaRef.current.material as THREE.MeshBasicMaterial;
          if (isDaytime) {
            const isGoldenHour = dayFraction < 0.32 || dayFraction > 0.68;
            coronaMat.color.set(
              isGoldenHour ? new THREE.Color(1.1, 0.42, 0.07) : new THREE.Color(1.0, 0.75, 0.35)
            );
            // Pulse corona opacity subtly over time
            coronaMat.opacity = 0.07 + Math.sin(elapsed * 0.4) * 0.025;
          }
        }
      }

      if (moonRef.current) {
        const moonAngle = (dayFraction + 0.25) * Math.PI * 2;
        moonRef.current.position.set(
          Math.cos(moonAngle) * 200,
          Math.sin(moonAngle) * 180,
          -80
        );
        moonRef.current.intensity =
          smoothstep(0.82, 0.9, dayFraction) * 0.35 +
          smoothstep(0.18, 0.1, dayFraction) * 0.35;
      }

      if (ambientRef.current) {
        ambientRef.current.intensity = getAmbientIntensity(dayFraction);
      }

      // Sky dome, stars and galaxy follow the camera so they're always centered
      if (cameraRef.current) {
        const camPos = cameraRef.current.position;
        if (skyMeshRef.current) skyMeshRef.current.position.copy(camPos);
        if (starsRef.current) starsRef.current.position.copy(camPos);
        if (galaxyRef.current) galaxyRef.current.position.copy(camPos);
      }

      // Stars & galaxy: smooth opacity fade tied to twilight transitions
      let starOpacity = 0;
      if (dayFraction < 0.18) {
        starOpacity = smoothstep(0.18, 0.11, dayFraction);
      } else if (dayFraction > 0.82) {
        starOpacity = smoothstep(0.82, 0.89, dayFraction);
      }

      if (starsRef.current) {
        starsRef.current.visible = starOpacity > 0.01;
        (starsRef.current.material as THREE.PointsMaterial).opacity = starOpacity;
      }

      if (galaxyRef.current) {
        galaxyRef.current.visible = starOpacity > 0.01;
        (galaxyRef.current.material as THREE.PointsMaterial).opacity = starOpacity * 0.92;
      }

      // ── Moving clouds ──────────────────────────────────────────────────────
      const cloudBound = WORLD_SIZE * 0.52;
      cloudsRef.current.forEach((c) => {
        c.mesh.position.x += c.vx * dt;
        c.mesh.position.z += c.vz * dt;
        // Wrap: teleport to opposite side when drifting too far
        if (c.mesh.position.x > cloudBound) c.mesh.position.x = -cloudBound + 10;
        else if (c.mesh.position.x < -cloudBound) c.mesh.position.x = cloudBound - 10;
        if (c.mesh.position.z > cloudBound) c.mesh.position.z = -cloudBound + 10;
        else if (c.mesh.position.z < -cloudBound) c.mesh.position.z = cloudBound - 10;
      });

      // ── Weather system ────────────────────────────────────────────────────
      {
        // Advance state timer
        weatherTimerRef.current -= dt;
        if (weatherTimerRef.current <= 0) {
          const prev = weatherStateRef.current;
          const next = nextWeatherState(prev);
          weatherPrevStateRef.current = prev;
          weatherStateRef.current = next;
          weatherBlendRef.current = 0;
          weatherTimerRef.current = randomDuration(next);
          setWeatherLabel(WEATHER_CONFIGS[next].label);
        }

        // Blend toward current config
        weatherBlendRef.current = Math.min(
          1,
          weatherBlendRef.current + dt * WEATHER_TRANSITION_SPEED
        );
        const blendT = weatherBlendRef.current;
        const prevCfg = WEATHER_CONFIGS[weatherPrevStateRef.current];
        const curCfg = WEATHER_CONFIGS[weatherStateRef.current];
        const wCfg = lerpWeatherConfig(prevCfg, curCfg, blendT);

        // Apply ambient / sun multipliers on top of day/night values
        if (ambientRef.current) {
          ambientRef.current.intensity = getAmbientIntensity(dayFraction) * wCfg.ambientMult;
        }
        if (sunRef.current) {
          sunRef.current.intensity = getSunIntensity(dayFraction) * wCfg.sunMult;
        }

        // Dim / hide sun disc during cloud cover
        if (sunDiscRef.current) {
          (sunDiscRef.current.material as THREE.MeshBasicMaterial).opacity =
            Math.max(0, 1 - wCfg.cloudDarkness * 1.4);
        }
        if (sunCoronaRef.current) {
          (sunCoronaRef.current.material as THREE.MeshBasicMaterial).opacity =
            Math.max(0, (0.07 + Math.sin(elapsed * 0.4) * 0.025) * (1 - wCfg.cloudDarkness));
        }

        // Fog density (unless underwater which overrides separately, or in station where fog is null)
        if (!isUnderwaterRef.current && !_inStation && scene.fog) {
          (scene.fog as THREE.FogExp2).density = wCfg.fogDensity;
        }

        // Cloud colour darkening during storms
        const cloudColor = new THREE.Color(1, 1, 1).lerp(
          new THREE.Color(0.28, 0.28, 0.32),
          wCfg.cloudDarkness
        );
        cloudsRef.current.forEach((c) => {
          c.mesh.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
              (obj.material as THREE.MeshLambertMaterial).color.copy(cloudColor);
            }
          });
        });

        // Rain particles
        if (rainRef.current) {
          const rainIntensity = wCfg.rainIntensity;
          rainRef.current.visible = rainIntensity > 0.01;
          const rainMat = rainRef.current.material as THREE.PointsMaterial;
          rainMat.opacity = Math.min(0.65, rainIntensity * 0.65);

          if (rainIntensity > 0.01 && cameraRef.current) {
            // Move rain with the camera so it always surrounds the player
            const camPos = cameraRef.current.position;
            const pos = rainRef.current.geometry.attributes.position as THREE.BufferAttribute;
            const arr = pos.array as Float32Array;
            for (let i = 0; i < RAIN_DROP_COUNT; i++) {
              // Fall downward
              arr[i * 3 + 1] -= RAIN_SPEED * dt;
              // Reset to top when below ground level
              if (arr[i * 3 + 1] < RAIN_Y_MIN) {
                arr[i * 3]     = camPos.x + (Math.random() - 0.5) * RAIN_SPREAD * 2;
                arr[i * 3 + 1] = camPos.y + RAIN_HEIGHT_RANGE * 0.5 + Math.random() * RAIN_HEIGHT_RANGE * 0.5;
                arr[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * RAIN_SPREAD * 2;
              }
            }
            pos.needsUpdate = true;
            // Keep rain cloud centered on camera
            rainRef.current.position.set(0, 0, 0);
          }
        }

        // Lightning
        const isStormy = wCfg.lightningInterval > 0.5;
        if (isStormy) {
          lightningTimerRef.current -= dt;
          if (lightningTimerRef.current <= 0) {
            // Schedule next lightning with randomness around the interval
            lightningTimerRef.current =
              wCfg.lightningInterval * (0.4 + Math.random() * 1.2);

            // Trigger a lightning flash
            lightningFlashRef.current = 1.0;
            setLightningFlash(1);

            // Rebuild the lightning bolt geometry near the player
            if (lightningBoltRef.current && cameraRef.current) {
              const camPos = cameraRef.current.position;
              const boltX = camPos.x + (Math.random() - 0.5) * 160;
              const boltZ = camPos.z + (Math.random() - 0.5) * 160;
              const boltPath = generateLightningPath(boltX, boltZ, camPos.y + 90, camPos.y - 5);
              lightningBoltRef.current.geometry.setAttribute(
                "position",
                new THREE.BufferAttribute(boltPath, 3)
              );
              lightningBoltRef.current.geometry.attributes.position.needsUpdate = true;
              lightningBoltRef.current.visible = true;
              (lightningBoltRef.current.material as THREE.LineBasicMaterial).opacity = 0.95;
            }

            // Play thunder via Web Audio after 1–4 second delay
            const thunderDelay = 1000 + Math.random() * 3000;
            setTimeout(() => {
              soundManager.playThunder?.();
            }, thunderDelay);
          }
        }

        // Decay the lightning flash
        if (lightningFlashRef.current > 0) {
          lightningFlashRef.current = Math.max(
            0,
            lightningFlashRef.current - dt / LIGHTNING_FLASH_DURATION
          );
          setLightningFlash(lightningFlashRef.current);

          // Spike ambient during flash for dramatic effect
          if (ambientRef.current && lightningFlashRef.current > 0.05) {
            ambientRef.current.intensity = Math.max(
              ambientRef.current.intensity,
              lightningFlashRef.current * 3.5
            );
          }

          // Hide bolt when flash fades
          if (lightningFlashRef.current < 0.05 && lightningBoltRef.current) {
            lightningBoltRef.current.visible = false;
          } else if (lightningBoltRef.current) {
            (lightningBoltRef.current.material as THREE.LineBasicMaterial).opacity =
              lightningFlashRef.current * 0.9;
          }
        }
      }

      // ── Terrain lighting ──────────────────────────────────────────────────
      if (terrainMatRef.current && sunRef.current) {
        const tm = terrainMatRef.current;
        tm.uniforms.uSunDir.value.copy(sunRef.current.position).normalize();
        const si = getSunIntensity(dayFraction);
        tm.uniforms.uSunIntensity.value = si;
        const isGolden = dayFraction < 0.32 || dayFraction > 0.68;
        if (si > 0) {
          if (isGolden) tm.uniforms.uSunColor.value.setRGB(1.0, 0.62, 0.18);
          else          tm.uniforms.uSunColor.value.setRGB(1.0, 0.95, 0.80);
        } else {
          tm.uniforms.uSunColor.value.setRGB(0.15, 0.18, 0.30);
        }
        // Ambient brightens a bit at golden hour
        const ambR = 0.25 + si * 0.08;
        const ambG = 0.32 + si * 0.08;
        const ambB = 0.48 + (1.0 - si) * 0.08;
        tm.uniforms.uAmbientColor.value.setRGB(ambR, ambG, ambB);
      }

      // ── Grass wind & lighting ─────────────────────────────────────────────
      if (grassMatRef.current && sunRef.current) {
        const gm = grassMatRef.current;
        gm.uniforms.time.value = elapsed;
        gm.uniforms.sunDir.value.copy(sunRef.current.position).normalize();
        gm.uniforms.sunIntensity.value = getSunIntensity(dayFraction);
        gm.uniforms.moonIntensity.value = moonRef.current ? moonRef.current.intensity : 0;
        gm.uniforms.dayFraction.value = dayFraction;
        // Slowly rotate global wind direction so grass sways from varying angles
        const windAngle = elapsed * 0.04;
        gm.uniforms.windDir.value.set(Math.cos(windAngle), Math.sin(windAngle));
      }

      // ── Water wave animation ───────────────────────────────────────────────
      if (waterMatRef.current) {
        waterMatRef.current.uniforms.time.value = elapsed;
        // Keep sun direction in sync with the day/night cycle
        if (sunRef.current) {
          const sd = sunRef.current.position.clone().normalize();
          waterMatRef.current.uniforms.sunDir.value.copy(sd);
        }
        // Tint reflected sky to match current sky colour
        waterMatRef.current.uniforms.skyCol.value.copy(
          scene.background instanceof THREE.Color ? scene.background : new THREE.Color(0.45, 0.65, 0.90)
        );
        // Sun colour tints specular highlight (orange at golden hour, white at noon)
        const isGoldenHourWater = dayFraction < 0.32 || dayFraction > 0.68;
        const sunIntWater = getSunIntensity(dayFraction);
        // Pass sunIntensity so the shader can gate SSS and caustics at night
        waterMatRef.current.uniforms.sunIntensity.value = sunIntWater;
        if (sunIntWater > 0) {
          if (isGoldenHourWater) {
            waterMatRef.current.uniforms.sunColor.value.setRGB(1.0, 0.55, 0.12);
          } else {
            waterMatRef.current.uniforms.sunColor.value.setRGB(1.0, 0.92, 0.78);
          }
        } else {
          // Night: dim blue moonlight specular
          waterMatRef.current.uniforms.sunColor.value.setRGB(0.18, 0.22, 0.35);
        }
      }

      // ── Flora (tree & bush foliage) wind sway + visibility LOD ───────────
      // Skip entirely when in space station — earthGroup is already hidden, and
      // iterating 300+ flora objects for nothing wastes CPU budget.
      if (!_inStation) {
        // Visibility culling: on mobile hide objects beyond a tight radius to keep
        // the GPU load proportional to what the player can actually see.
        const LOD_FLORA_DIST_SQ = 80 * 80;
        // On mobile use a shorter visibility radius; desktop shows full world.
        const LOD_FLORA_VIS_SQ = IS_MOBILE ? 110 * 110 : 220 * 220;
        const camPosX = cameraRef.current ? cameraRef.current.position.x : 0;
        const camPosZ = cameraRef.current ? cameraRef.current.position.z : 0;
        // Wind sway updated every other frame — motion is continuous so
        // halving the update rate is imperceptible and saves ~1–2 ms.
        const updateFloraWind = frameCount % 2 === 0;
        floraRef.current.forEach((flora) => {
          const dx = flora.posX - camPosX;
          const dz = flora.posZ - camPosZ;
          const dSq = dx * dx + dz * dz;
          // Visibility LOD — hide very distant plants
          flora.rootMesh.visible = dSq < LOD_FLORA_VIS_SQ;
          if (!updateFloraWind || dSq > LOD_FLORA_DIST_SQ) return;
          const t = elapsed * flora.windSpeed + flora.windPhase;
          // Gentle sinusoidal sway: X axis tilts forward/back, Z tilts side-to-side
          flora.foliageGroup.rotation.x = Math.sin(t) * flora.maxSway;
          flora.foliageGroup.rotation.z = Math.cos(t * 0.71) * flora.maxSway * 0.6;
        });
      }

      // ── Windmill blades ────────────────────────────────────────────────────
      if (windmillBladesRef.current) {
        windmillBladesRef.current.rotation.x += dt * 0.8;
      }

      // ── Lighthouse rotating beam ────────────────────────────────────────────
      if (lighthouseBeamRef.current) {
        lighthouseBeamRef.current.rotation.y = elapsed * 1.2; // ~0.19 rot/s
      }
      // Brighten lighthouse light at night, dim at day (smooth transition)
      if (lighthouseLightRef.current) {
        lighthouseLightRef.current.intensity = 1.5 + nightFactor * 4.5;
      }

      // ── MotherShip animation ──────────────────────────────────────────────
      if (motherShipRef.current) {
        // Ultra-slow rotation — full revolution in ~5 real minutes
        motherShipRef.current.rotation.y = elapsed * 0.018;
        // Gentle vertical bob
        motherShipRef.current.position.y = 170 + Math.sin(elapsed * 0.12) * 1.8;
        // Faint lateral sway
        motherShipRef.current.rotation.z = 0.06 + Math.sin(elapsed * 0.07) * 0.008;
        // Flickering orange lights
        motherShipLightsRef.current.forEach((light, i) => {
          const base = (light as THREE.PointLight & { _base?: number })._base ?? light.intensity;
          light.intensity = base * (0.82 + Math.sin(elapsed * (1.2 + i * 0.37) + i) * 0.18);
        });
      }

      // ── Station welcome message timer ────────────────────────────────────
      if (stationWelcomeTimerRef.current > 0) {
        stationWelcomeTimerRef.current -= dt;
        if (stationWelcomeTimerRef.current <= 0) {
          stationWelcomeTimerRef.current = 0;
          setStationWelcome(false);
        }
      }

      // ── Space Station interior movement & animation ───────────────────────
      if (isLockedRef.current && inSpaceStationRef.current) {
        const cam = cameraRef.current!;
        const keys = keysRef.current;

        const speed = MOVE_SPEED;
        const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
        const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
        const move = new THREE.Vector3();

        if (keys["KeyW"] || keys["ArrowUp"]) move.addScaledVector(forward, speed * dt);
        if (keys["KeyS"] || keys["ArrowDown"]) move.addScaledVector(forward, -speed * dt);
        if (keys["KeyA"] || keys["ArrowLeft"]) move.addScaledVector(right, -speed * dt);
        if (keys["KeyD"] || keys["ArrowRight"]) move.addScaledVector(right, speed * dt);

        const prevPos = cam.position.clone();
        cam.position.add(move);

        // Collision: check if player is inside any room (XZ plane)
        const isInRoom = (px: number, pz: number) =>
          spaceStationRoomsRef.current.some(
            (room) =>
              px >= room.min.x - PLAYER_RADIUS + SPACE_STATION_WORLD_X &&
              px <= room.max.x + PLAYER_RADIUS + SPACE_STATION_WORLD_X &&
              pz >= room.min.z - PLAYER_RADIUS + SPACE_STATION_WORLD_Z &&
              pz <= room.max.z + PLAYER_RADIUS + SPACE_STATION_WORLD_Z
          );

        if (!isInRoom(cam.position.x, cam.position.z)) {
          // Try X-only movement
          cam.position.x = prevPos.x + move.x;
          cam.position.z = prevPos.z;
          if (!isInRoom(cam.position.x, cam.position.z)) {
            cam.position.x = prevPos.x;
            // Try Z-only movement
            cam.position.z = prevPos.z + move.z;
            if (!isInRoom(cam.position.x, cam.position.z)) {
              cam.position.z = prevPos.z;
            }
          }
        }

        // Vertical physics (gravity + floor)
        const player = playerRef.current;
        const stationFloorY = SPACE_STATION_WORLD_Y + PLAYER_HEIGHT;
        if (!player.onGround) {
          player.velY += GRAVITY * dt;
        }
        cam.position.y += player.velY * dt;
        if (cam.position.y <= stationFloorY) {
          cam.position.y = stationFloorY;
          player.velY = 0;
          player.onGround = true;
        } else {
          player.onGround = false;
        }
        // Ceiling clamp
        if (cam.position.y > SPACE_STATION_WORLD_Y + 5.8) {
          cam.position.y = SPACE_STATION_WORLD_Y + 5.8;
          player.velY = 0;
        }
        // Jump
        if (keys["Space"] && player.onGround) {
          player.velY = JUMP_FORCE;
          player.onGround = false;
        }

        playerBodyPosRef.current.copy(cam.position);
        cam.rotation.order = "YXZ";
        cam.rotation.y = yawRef.current;
        cam.rotation.x = pitchRef.current;

        // Airlock proximity check for exit prompt
        const localX = cam.position.x - SPACE_STATION_WORLD_X;
        const localZ = cam.position.z - SPACE_STATION_WORLD_Z;
        const isNearAirlock = Math.abs(localX) <= 5.5 && Math.abs(localZ) <= 5.5;
        setNearAirlockExit(isNearAirlock);

        // Animate station lights (flicker)
        spaceStationLightsRef.current.forEach(({ light, baseIntensity, phase }) => {
          light.intensity = baseIntensity * (0.88 + Math.sin(elapsed * (1.1 + phase * 0.3) + phase) * 0.12);
        });

        // Animate hologram/reactor/panel meshes
        spaceStationAnimMeshesRef.current.forEach(({ mesh, type }) => {
          if (type === 'hologram') {
            mesh.rotation.y += dt * 0.8;
            const scale = 0.95 + Math.sin(elapsed * 1.5) * 0.05;
            mesh.scale.setScalar(scale);
          } else if (type === 'reactor') {
            mesh.rotation.y += dt * 1.2;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = 2.0 + Math.sin(elapsed * 3.0) * 1.0;
            }
          } else if (type === 'panel') {
            // Blink indicators
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = Math.random() > 0.02 ? mat.emissiveIntensity : (mat.emissiveIntensity > 0.5 ? 0.0 : 2.5);
            }
          }
        });
      }

      // ── Player movement (only when NOT possessing an entity, on boat, on rocket, on airplane, in station, or sailing) ─
      if (isLockedRef.current && !possessedSheepRef.current && !onBoatRef.current && !inSpaceStationRef.current && !onRocketRef.current && !onAirplaneRef.current && !activeHarborShipRef.current) {
        const cam = cameraRef.current!;
        const keys = keysRef.current;

        // In 3rd-person, temporarily restore cam.position to player body position
        // so all movement + collision code runs against the correct world position.
        if (cameraModeRef.current === "third") {
          cam.position.copy(playerBodyPosRef.current);
        }

        // Stamina
        const wantSprint = keys["ShiftLeft"] || keys["ShiftRight"];
        const canSprint = staminaRef.current > 5;
        const sprinting = wantSprint && canSprint;
        if (sprinting) {
          staminaRef.current = Math.max(0, staminaRef.current - STAMINA_DRAIN * dt);
        } else {
          staminaRef.current = Math.min(
            STAMINA_MAX,
            staminaRef.current + STAMINA_REGEN * dt
          );
        }

        const inWater = getTerrainHeightSampled(cam.position.x, cam.position.z) < WATER_LEVEL;
        const speed = inWater ? SWIM_SPEED : (sprinting ? SPRINT_SPEED : MOVE_SPEED);
        const forward = new THREE.Vector3(
          -Math.sin(yawRef.current),
          0,
          -Math.cos(yawRef.current)
        );
        const right = new THREE.Vector3(
          Math.cos(yawRef.current),
          0,
          -Math.sin(yawRef.current)
        );
        const move = new THREE.Vector3();

        if (keys["KeyW"] || keys["ArrowUp"]) move.addScaledVector(forward, speed * dt);
        if (keys["KeyS"] || keys["ArrowDown"]) move.addScaledVector(forward, -speed * dt);
        if (keys["KeyA"] || keys["ArrowLeft"]) move.addScaledVector(right, -speed * dt);
        if (keys["KeyD"] || keys["ArrowRight"]) move.addScaledVector(right, speed * dt);

        const playerPrevX = cam.position.x;
        const playerPrevZ = cam.position.z;
        cam.position.add(move);

        cam.position.x = Math.max(
          -WORLD_SIZE / 2 + 10,
          Math.min(WORLD_SIZE / 2 - 10, cam.position.x)
        );
        cam.position.z = Math.max(
          -WORLD_SIZE / 2 + 10,
          Math.min(WORLD_SIZE / 2 - 10, cam.position.z)
        );

        // Swimming: allow entry into water but clamp terrain height lookup

        // Tree trunk collision: push player out of large tree trunks
        for (const tree of treeCollisionRef.current) {
          const tdx = cam.position.x - tree.x;
          const tdz = cam.position.z - tree.z;
          const tdist = Math.sqrt(tdx * tdx + tdz * tdz);
          if (tdist < tree.radius && tdist > 0.001) {
            // Push player to the edge of the collision cylinder
            const nx = tdx / tdist;
            const nz = tdz / tdist;
            cam.position.x = tree.x + nx * tree.radius;
            cam.position.z = tree.z + nz * tree.radius;
          }
        }

        // Box colliders: houses, ruins walls — OBB push-out in 2D
        for (const box of boxCollidersRef.current) {
          const cosR = Math.cos(box.rotY);
          const sinR = Math.sin(box.rotY);
          const dx = cam.position.x - box.cx;
          const dz = cam.position.z - box.cz;
          // Transform to box-local space (rotate by -rotY)
          const lx = dx * cosR + dz * sinR;
          const lz = -dx * sinR + dz * cosR;
          const inflW = box.halfW + PLAYER_RADIUS;
          const inflD = box.halfD + PLAYER_RADIUS;
          if (Math.abs(lx) < inflW && Math.abs(lz) < inflD) {
            // Push out along the axis of least penetration
            const overlapX = inflW - Math.abs(lx);
            const overlapZ = inflD - Math.abs(lz);
            let pushLx = 0, pushLz = 0;
            if (overlapX < overlapZ) {
              pushLx = overlapX * Math.sign(lx);
            } else {
              pushLz = overlapZ * Math.sign(lz);
            }
            const newLx = lx + pushLx;
            const newLz = lz + pushLz;
            // Rotate back to world space
            cam.position.x = box.cx + newLx * cosR - newLz * sinR;
            cam.position.z = box.cz + newLx * sinR + newLz * cosR;
          }
        }

        // Building block horizontal collision — AABB per block
        for (const block of placedBlocksDataRef.current) {
          const bdx = cam.position.x - block.x;
          const bdz = cam.position.z - block.z;
          if (Math.abs(bdx) > 1.5 || Math.abs(bdz) > 1.5) continue; // quick distance cull
          const playerFeetY = cam.position.y - PLAYER_HEIGHT;
          const blockTop = block.y + 0.5;
          const blockBottom = block.y - 0.5;
          // Only apply horizontal push when player height overlaps with block
          if (playerFeetY >= blockTop || cam.position.y <= blockBottom) continue;
          const inflH = 0.5 + PLAYER_RADIUS;
          if (Math.abs(bdx) < inflH && Math.abs(bdz) < inflH) {
            const overlapX = inflH - Math.abs(bdx);
            const overlapZ = inflH - Math.abs(bdz);
            if (overlapX < overlapZ) {
              cam.position.x += overlapX * Math.sign(bdx);
            } else {
              cam.position.z += overlapZ * Math.sign(bdz);
            }
          }
        }

        const player = playerRef.current;
        const terrainY = getTerrainHeightSampled(cam.position.x, cam.position.z);
        const isOverWater = terrainY < WATER_LEVEL;

        if (isOverWater) {
          // ── Aquatic physics: buoyancy + free vertical movement ───────────
          // Ctrl = dive down, Space = swim up, default = drift to surface
          const waterSurfaceY = WATER_LEVEL + PLAYER_HEIGHT;
          const diving = keys["ControlLeft"] || keys["ControlRight"];
          const submerged = cam.position.y < waterSurfaceY - 0.05;

          if (diving) {
            // Active dive: pull player downward
            player.velY = -DIVE_SPEED;
            player.onGround = false;
          } else if (keys["Space"] && submerged) {
            // Active swim upward while submerged
            player.velY = SWIM_RISE_SPEED;
            player.onGround = false;
          } else if (submerged) {
            // Natural buoyancy: gradually drift back to surface
            player.velY += SWIM_BUOYANCY * dt;
            player.velY = Math.min(player.velY, 2.0); // cap gentle rise speed
            player.onGround = false;
          } else {
            // At or above surface: float still
            player.velY = 0;
            cam.position.y = waterSurfaceY;
            player.onGround = true;
          }

          cam.position.y += player.velY * dt;

          // Cannot go below the ocean / lake floor
          const floorY = terrainY + PLAYER_HEIGHT;
          if (cam.position.y < floorY) {
            cam.position.y = floorY;
            player.velY = 0;
            player.onGround = true;
          }

          // Cap at surface when buoyancy brings player back up
          if (!diving && cam.position.y > waterSurfaceY) {
            cam.position.y = waterSurfaceY;
            player.velY = 0;
            player.onGround = true;
          }
        } else {
          // ── Land physics: gravity, jump, ground detection ────────────────
          if (keys["Space"] && player.onGround) {
            player.velY = JUMP_FORCE;
            player.onGround = false;
            soundManager.playJump();
          }
          player.velY += GRAVITY * dt;
          cam.position.y += player.velY * dt;

          // Ground detection: terrain height or top of placed blocks
          let groundY = terrainY + PLAYER_HEIGHT;
          for (const block of placedBlocksDataRef.current) {
            const bdx = Math.abs(cam.position.x - block.x);
            const bdz = Math.abs(cam.position.z - block.z);
            if (bdx <= 0.5 && bdz <= 0.5) {
              const blockGroundY = block.y + 0.5 + PLAYER_HEIGHT;
              if (blockGroundY > groundY) groundY = blockGroundY;
            }
          }
          if (cam.position.y <= groundY) {
            cam.position.y = groundY;
            player.velY = 0;
            player.onGround = true;
          }
        }

        // Save player body position (same in both modes at this point)
        playerBodyPosRef.current.copy(cam.position);

        // ── Underwater visual state + fog ────────────────────────────────
        // Camera eye is below water surface when player Y - PLAYER_HEIGHT < WATER_LEVEL
        const nowUnderwater = cam.position.y - PLAYER_HEIGHT < WATER_LEVEL;
        const nowSwimming = isOverWater; // player is in / on water (terrain below WATER_LEVEL)
        if (nowUnderwater !== isUnderwaterRef.current) {
          isUnderwaterRef.current = nowUnderwater;
          setIsUnderwater(nowUnderwater);
        }
        if (nowSwimming !== isSwimmingRef.current) {
          isSwimmingRef.current = nowSwimming;
          setIsSwimming(nowSwimming);
        }
        if (nowUnderwater) {
          // Override fog to deep blue-green while submerged
          (scene.fog as THREE.FogExp2).color.setRGB(0.04, 0.18, 0.32);
          (scene.fog as THREE.FogExp2).density = 0.08;
        } else {
          // Restore normal fog density (colour is set each frame by day/night cycle)
          (scene.fog as THREE.FogExp2).density = 0.006;
        }

        if (cameraModeRef.current === "third") {
          // ── 3rd-person: orbit camera behind and above the player ─────────
          const behindX = Math.sin(yawRef.current) * TP_DISTANCE;
          const behindZ = Math.cos(yawRef.current) * TP_DISTANCE;
          // Pitch tilts camera up/down while preserving "looking at player" feel
          const pitchOffset = Math.sin(pitchRef.current) * TP_DISTANCE * 0.5;
          cam.position.set(
            playerBodyPosRef.current.x + behindX,
            playerBodyPosRef.current.y + TP_HEIGHT + pitchOffset,
            playerBodyPosRef.current.z + behindZ
          );
          cam.lookAt(
            playerBodyPosRef.current.x,
            playerBodyPosRef.current.y + 0.8,
            playerBodyPosRef.current.z
          );
        } else {
          cam.rotation.order = "YXZ";
          cam.rotation.y = yawRef.current;
          cam.rotation.x = pitchRef.current;
        }

        // ── Broadcast position to other players ─────────────────────────────
        sendUpdateRef.current?.({
          x: playerBodyPosRef.current.x,
          y: playerBodyPosRef.current.y,
          z: playerBodyPosRef.current.z,
          rotY: yawRef.current,
          pitch: pitchRef.current,
        });

        // ── Footstep sounds ─────────────────────────────────────────────────
        const isMovingHoriz =
          keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"] ||
          keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
        if (isMovingHoriz && playerRef.current.onGround) {
          footstepTimerRef.current -= dt;
          if (footstepTimerRef.current <= 0) {
            soundManager.playFootstep(sprinting);
            footstepTimerRef.current = sprinting ? 0.27 : 0.42;
          }
        } else {
          footstepTimerRef.current = 0;
        }

        // ── Water ambient sound (only near water) ───────────────────────────
        {
          const px = playerBodyPosRef.current.x;
          const pz = playerBodyPosRef.current.z;
          // Sample a coarse ring around the player to find the nearest water tile.
          // Water is defined as terrain height < WATER_LEVEL (-0.5).
          const WATER_HEAR_RADIUS = 30;
          const checkOffsets: [number, number][] = [
            [0, 0],
            [12, 0], [-12, 0], [0, 12], [0, -12],
            [24, 0], [-24, 0], [0, 24], [0, -24],
          ];
          let waterVolume = 0;
          for (const [dx, dz] of checkOffsets) {
            if (getTerrainHeightSampled(px + dx, pz + dz) < WATER_LEVEL) {
              const d = Math.hypot(dx, dz);
              waterVolume = Math.max(waterVolume, 1 - d / WATER_HEAR_RADIUS);
              break;
            }
          }

          if (waterVolume > 0) {
            waterAmbienceTimerRef.current -= dt;
            if (waterAmbienceTimerRef.current <= 0) {
              soundManager.playWaterAmbient(waterVolume);
              // Reschedule: more frequent when very close to water
              waterAmbienceTimerRef.current = 1.2 + Math.random() * 0.8 * (1 - waterVolume * 0.7);
            }
          } else {
            waterAmbienceTimerRef.current = 0;
          }
        }
      }

      // ── Boat: bobbing, proximity prompt, and on-boat movement ────────────────
      if (boatRef.current) {
        const boat = boatRef.current;

        if (!onBoatRef.current) {
          // Gentle passive bobbing when nobody is on board
          boat.position.y = WATER_LEVEL + 0.5 + 0.07 * Math.sin(elapsed * 1.3 + 0.5);
          boat.rotation.x = 0.018 * Math.sin(elapsed * 1.1);
          boat.rotation.z = 0.018 * Math.cos(elapsed * 0.9 + 1.0);

          // Proximity check for boarding prompt
          const playerPos2 = playerBodyPosRef.current;
          const boatDx = boat.position.x - playerPos2.x;
          const boatDz = boat.position.z - playerPos2.z;
          const boatDist = Math.sqrt(boatDx * boatDx + boatDz * boatDz);
          const isNear = boatDist < BOAT_BOARD_RADIUS && !possessedSheepRef.current;
          nearBoatForBoardRef.current = isNear;
          setNearBoatPrompt(isNear);
        } else {
          // ── On-boat movement ───────────────────────────────────────────────
          nearBoatForBoardRef.current = false;
          setNearBoatPrompt(false);

          if (isLockedRef.current && cameraRef.current) {
            const cam = cameraRef.current;
            const keys = keysRef.current;

            const fwd = new THREE.Vector3(
              -Math.sin(yawRef.current), 0, -Math.cos(yawRef.current)
            );
            const right = new THREE.Vector3(
              Math.cos(yawRef.current), 0, -Math.sin(yawRef.current)
            );
            const boatMove = new THREE.Vector3();

            if (keys["KeyW"] || keys["ArrowUp"])    boatMove.addScaledVector(fwd, BOAT_SPEED * dt);
            if (keys["KeyS"] || keys["ArrowDown"])  boatMove.addScaledVector(fwd, -BOAT_SPEED * dt);
            if (keys["KeyA"] || keys["ArrowLeft"])  boatMove.addScaledVector(right, -BOAT_SPEED * dt);
            if (keys["KeyD"] || keys["ArrowRight"]) boatMove.addScaledVector(right, BOAT_SPEED * dt);

            const prevBoatX = boat.position.x;
            const prevBoatZ = boat.position.z;

            boat.position.x += boatMove.x;
            boat.position.z += boatMove.z;

            // World bounds
            const half = WORLD_SIZE / 2 - 10;
            boat.position.x = Math.max(-half, Math.min(half, boat.position.x));
            boat.position.z = Math.max(-half, Math.min(half, boat.position.z));

            // Boat must stay in water — revert if it would ground itself
            if (getTerrainHeightSampled(boat.position.x, boat.position.z) >= WATER_LEVEL) {
              boat.position.x = prevBoatX;
              boat.position.z = prevBoatZ;
            }

            // Bobbing while occupied
            boat.position.y = WATER_LEVEL + 0.5 + 0.06 * Math.sin(elapsed * 1.4);
            boat.rotation.x = 0.015 * Math.sin(elapsed * 1.1);
            boat.rotation.z = 0.015 * Math.cos(elapsed * 0.9);

            // Turn boat to face movement direction (smooth)
            if (boatMove.lengthSq() > 0.0001) {
              const targetYaw = Math.atan2(boatMove.x, boatMove.z);
              let diff = targetYaw - boat.rotation.y;
              // Wrap to [-π, π]
              while (diff > Math.PI)  diff -= 2 * Math.PI;
              while (diff < -Math.PI) diff += 2 * Math.PI;
              boat.rotation.y += diff * Math.min(1, dt * 4);
            }

            // Camera follows the boat at player eye-height
            cam.position.set(boat.position.x, boat.position.y + BOAT_CAM_HEIGHT, boat.position.z);
            playerBodyPosRef.current.copy(cam.position);

            cam.rotation.order = "YXZ";
            cam.rotation.y = yawRef.current;
            cam.rotation.x = pitchRef.current;

            // Broadcast position
            sendUpdateRef.current?.({
              x: playerBodyPosRef.current.x,
              y: playerBodyPosRef.current.y,
              z: playerBodyPosRef.current.z,
              rotY: yawRef.current,
              pitch: pitchRef.current,
            });
          }
        }
      }

      // ── Harbor ships: bobbing, proximity, active sailing ─────────────────────
      {
        const ships = harborShipsRef.current;
        const playerPos = playerBodyPosRef.current;
        const activeShip = activeHarborShipRef.current;

        // Update each ship
        let closestShip: HarborShipData | null = null;
        let closestDist = SAILBOAT_BOARD_RADIUS;

        ships.forEach((ship) => {
          if (ship === activeShip) return; // active ship handled separately

          // Idle bobbing
          ship.mesh.position.y = WATER_LEVEL + 0.55 + 0.06 * Math.sin(elapsed * 1.1 + ship.id.length);
          ship.mesh.rotation.x = 0.016 * Math.sin(elapsed * 0.9 + ship.id.length);
          ship.mesh.rotation.z = 0.016 * Math.cos(elapsed * 1.2 + ship.id.length);

          // Gentle sail flutter even when moored
          ship.sailGroup.rotation.y = 0.04 * Math.sin(elapsed * 0.7 + ship.id.length);

          // Proximity to player
          const dx = ship.mesh.position.x - playerPos.x;
          const dz = ship.mesh.position.z - playerPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < closestDist && !possessedSheepRef.current && !onBoatRef.current) {
            closestDist = dist;
            closestShip = ship;
          }
        });

        nearHarborShipRef.current = closestShip;
        setNearHarborShipPrompt(closestShip !== null && !activeShip);

        // ── Active sailing physics ───────────────────────────────────────────
        if (activeShip && isLockedRef.current && cameraRef.current) {
          const cam = cameraRef.current;
          const keys = keysRef.current;

          // A/D → turn the ship heading
          if (keys["KeyA"] || keys["ArrowLeft"])  activeShip.yaw += SAILBOAT_TURN_SPEED * dt;
          if (keys["KeyD"] || keys["ArrowRight"]) activeShip.yaw -= SAILBOAT_TURN_SPEED * dt;

          // W/S → accelerate / brake
          if (keys["KeyW"] || keys["ArrowUp"]) {
            activeShip.velocity = Math.min(
              SAILBOAT_MAX_SPEED,
              activeShip.velocity + SAILBOAT_ACCEL * dt
            );
          } else if (keys["KeyS"] || keys["ArrowDown"]) {
            activeShip.velocity = Math.max(
              -SAILBOAT_MAX_SPEED * 0.4,
              activeShip.velocity - SAILBOAT_BRAKE * dt
            );
          } else {
            // Natural drag / deceleration
            const drag = SAILBOAT_BRAKE * 0.35 * dt;
            if (activeShip.velocity > 0) activeShip.velocity = Math.max(0, activeShip.velocity - drag);
            else if (activeShip.velocity < 0) activeShip.velocity = Math.min(0, activeShip.velocity + drag);
          }

          // Move ship in heading direction
          const prevX = activeShip.mesh.position.x;
          const prevZ = activeShip.mesh.position.z;
          const newX  = prevX + Math.sin(activeShip.yaw) * activeShip.velocity * dt;
          const newZ  = prevZ + Math.cos(activeShip.yaw) * activeShip.velocity * dt;

          // Bounds and water check
          const half = WORLD_SIZE / 2 - 12;
          const clampedX = Math.max(-half, Math.min(half, newX));
          const clampedZ = Math.max(-half, Math.min(half, newZ));

          if (getTerrainHeightSampled(clampedX, clampedZ) < WATER_LEVEL) {
            activeShip.mesh.position.x = clampedX;
            activeShip.mesh.position.z = clampedZ;
          } else {
            // Hit ground — stop immediately
            activeShip.velocity = 0;
          }

          // Apply heading to mesh
          activeShip.mesh.rotation.y = activeShip.yaw;

          // Bobbing while sailing
          const speed = Math.abs(activeShip.velocity);
          activeShip.mesh.position.y = WATER_LEVEL + 0.55 + 0.05 * Math.sin(elapsed * 1.5);
          activeShip.mesh.rotation.x = 0.012 * Math.sin(elapsed * 1.0) - speed * 0.003;
          activeShip.mesh.rotation.z = 0.012 * Math.cos(elapsed * 0.8) + activeShip.velocity * SAILBOAT_TURN_SPEED * 0.015;

          // Sail animation — fills with wind when moving, luffs when stopped
          const fillAngle = speed > 0.5 ? 0.18 * (speed / SAILBOAT_MAX_SPEED) : 0.04 * Math.sin(elapsed * 1.1);
          activeShip.sailGroup.rotation.y = fillAngle;

          // Camera: follow behind stern at a fixed offset based on ship yaw
          const behindX = Math.sin(activeShip.yaw) * -SAILBOAT_CAM_DIST;
          const behindZ = Math.cos(activeShip.yaw) * -SAILBOAT_CAM_DIST;
          cam.position.set(
            activeShip.mesh.position.x + behindX,
            activeShip.mesh.position.y + SAILBOAT_CAM_HEIGHT,
            activeShip.mesh.position.z + behindZ
          );
          // Camera looks toward the bow
          cam.rotation.order = "YXZ";
          cam.rotation.y = activeShip.yaw;
          cam.rotation.x = -0.22; // slight downward angle looking at deck
          playerBodyPosRef.current.copy(cam.position);

          // Broadcast position
          sendUpdateRef.current?.({
            x: playerBodyPosRef.current.x,
            y: playerBodyPosRef.current.y,
            z: playerBodyPosRef.current.z,
            rotY: activeShip.yaw,
            pitch: -0.22,
          });
        }
      }

      // ── Rocket: proximity, countdown, launch flight ───────────────────────────
      {
        const rd = rocketDataRef.current;
        if (rd && cameraRef.current) {
          const cam = cameraRef.current;
          const rocketPos = rd.mesh.position;

          if (rd.state === 'idle') {
            // Proximity check — show boarding prompt
            const playerPos3 = playerBodyPosRef.current;
            const dx = rocketPos.x - playerPos3.x;
            const dz = rocketPos.z - playerPos3.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const isNear = dist < ROCKET_BOARD_RADIUS && !possessedSheepRef.current && !onBoatRef.current;
            nearRocketForBoardRef.current = isNear;
            setNearRocketPrompt(isNear);
          } else {
            nearRocketForBoardRef.current = false;
            setNearRocketPrompt(false);
          }

          if (rd.state === 'boarded' && isLockedRef.current) {
            // Keep camera locked to the rocket (1st or 3rd person)
            if (cameraModeRef.current === "third") {
              const behindX = Math.sin(yawRef.current) * (TP_DISTANCE + 4);
              const behindZ = Math.cos(yawRef.current) * (TP_DISTANCE + 4);
              cam.position.set(
                rocketPos.x + behindX,
                rd.groundY + TP_HEIGHT + 6,
                rocketPos.z + behindZ
              );
              cam.lookAt(rocketPos.x, rd.groundY + 6, rocketPos.z);
            } else {
              cam.position.set(rocketPos.x, rd.groundY + ROCKET_CAM_HEIGHT, rocketPos.z);
              cam.rotation.order = "YXZ";
              cam.rotation.y = yawRef.current;
              cam.rotation.x = pitchRef.current;
            }
            playerBodyPosRef.current.copy(rocketPos);
          }

          if (rd.state === 'countdown') {
            // Tick countdown timer
            rd.countdownTimer += dt;
            if (rd.countdownTimer >= 1.0) {
              rd.countdownTimer -= 1.0;
              rd.countdown -= 1;
              setRocketCountdown(rd.countdown);
              if (rd.countdown <= 0) {
                // Begin actual launch
                rd.state = 'launching';
                rd.launchProgress = 0;
                rd.flameGroup.visible = true;
                rd.exhaustParticles.forEach((p) => { p.visible = true; });
                setRocketCountdown(null);
                setRocketLaunching(true);
              }
            }

            // While counting down — keep camera on rocket, slight pre-ignition shaking
            if (isLockedRef.current) {
              const shake = rd.countdown <= 1 ? 0.04 : 0.015;
              if (cameraModeRef.current === "third") {
                const behindX = Math.sin(yawRef.current) * (TP_DISTANCE + 4);
                const behindZ = Math.cos(yawRef.current) * (TP_DISTANCE + 4);
                cam.position.set(
                  rocketPos.x + behindX + (Math.random() - 0.5) * shake,
                  rd.groundY + TP_HEIGHT + 6 + (Math.random() - 0.5) * shake,
                  rocketPos.z + behindZ + (Math.random() - 0.5) * shake
                );
                cam.lookAt(rocketPos.x, rd.groundY + 6, rocketPos.z);
              } else {
                cam.position.set(
                  rocketPos.x + (Math.random() - 0.5) * shake,
                  rd.groundY + ROCKET_CAM_HEIGHT + (Math.random() - 0.5) * shake,
                  rocketPos.z + (Math.random() - 0.5) * shake
                );
                cam.rotation.order = "YXZ";
                cam.rotation.y = yawRef.current;
                cam.rotation.x = pitchRef.current;
              }
              playerBodyPosRef.current.copy(rocketPos);
            }
          }

          if (rd.state === 'launching') {
            rd.launchProgress += dt / ROCKET_FLIGHT_DURATION;
            rd.launchProgress = Math.min(rd.launchProgress, 1);

            // Ease-in-out curve for smooth acceleration then deceleration
            const t = rd.launchProgress;
            const eased = t < 0.5
              ? 2 * t * t
              : 1 - Math.pow(-2 * t + 2, 2) / 2;

            // Move rocket from ground toward mothership — interpolate from spawn to target
            const targetX = 0;     // mothership X
            const targetZ = -60;   // mothership Z
            rd.mesh.position.x = rd.spawnX + (targetX - rd.spawnX) * eased;
            rd.mesh.position.y = rd.groundY + (ROCKET_TARGET_Y - rd.groundY) * eased;
            rd.mesh.position.z = rd.spawnZ + (targetZ - rd.spawnZ) * eased;

            // Animate exhaust flame — flicker and pulse
            const flameScale = 1.0 + Math.sin(elapsed * 18) * 0.25 + eased * 0.5;
            rd.flameGroup.scale.setScalar(flameScale);

            // Animate smoke puffs offset below the rocket
            rd.exhaustParticles.forEach((puff, i) => {
              const puffMat = puff.material as THREE.MeshLambertMaterial;
              puff.position.set(
                (Math.random() - 0.5) * 0.4,
                -1.5 - i * 0.6 - eased * 3,
                (Math.random() - 0.5) * 0.4
              );
              puffMat.opacity = Math.max(0, 0.55 - i * 0.06 - eased * 0.3);
            });

            // Camera follows rocket during ascent — 1st or 3rd person
            if (isLockedRef.current) {
              const shakeMag = 0.04 * (1 - eased * 0.5);
              if (cameraModeRef.current === "third") {
                const behindX = Math.sin(yawRef.current) * (TP_DISTANCE + 4);
                const behindZ = Math.cos(yawRef.current) * (TP_DISTANCE + 4);
                cam.position.set(
                  rd.mesh.position.x + behindX + (Math.random() - 0.5) * shakeMag,
                  rd.mesh.position.y + TP_HEIGHT + 6 + (Math.random() - 0.5) * shakeMag,
                  rd.mesh.position.z + behindZ + (Math.random() - 0.5) * shakeMag
                );
                cam.lookAt(rd.mesh.position.x, rd.mesh.position.y + 6, rd.mesh.position.z);
              } else {
                cam.position.set(
                  rd.mesh.position.x + (Math.random() - 0.5) * shakeMag,
                  rd.mesh.position.y + ROCKET_CAM_HEIGHT + (Math.random() - 0.5) * shakeMag,
                  rd.mesh.position.z + (Math.random() - 0.5) * shakeMag
                );
                cam.rotation.order = "YXZ";
                cam.rotation.y = yawRef.current;
                cam.rotation.x = pitchRef.current;
              }
              playerBodyPosRef.current.copy(rd.mesh.position);
            }

            // Reached mothership — park rocket and let player decide to enter via E
            if (rd.launchProgress >= 1) {
              rd.state = 'arrived';
              rd.flameGroup.visible = false;
              rd.exhaustParticles.forEach((p) => { p.visible = false; });
              setRocketLaunching(false);
              // Signal that player is now at the mothership (E key will enter station)
              rocketArrivedRef.current = true;
              setRocketArrived(true);
              // Player stays on rocket (onRocketRef stays true) — camera handled in 'arrived' block below
            }
          }

          if (rd.state === 'arrived' || rd.state === 'docked') {
            // Keep rocket parked near mothership — gentle idle drift
            rd.mesh.position.y = ROCKET_TARGET_Y + Math.sin(elapsed * 0.4) * 0.8;

            // If player is still aboard (arrived, not yet entered station), keep camera locked to rocket
            if (onRocketRef.current && isLockedRef.current) {
              if (cameraModeRef.current === "third") {
                const behindX = Math.sin(yawRef.current) * (TP_DISTANCE + 4);
                const behindZ = Math.cos(yawRef.current) * (TP_DISTANCE + 4);
                cam.position.set(
                  rd.mesh.position.x + behindX,
                  rd.mesh.position.y + TP_HEIGHT + 6,
                  rd.mesh.position.z + behindZ
                );
                cam.lookAt(rd.mesh.position.x, rd.mesh.position.y + 6, rd.mesh.position.z);
              } else {
                cam.position.set(rd.mesh.position.x, rd.mesh.position.y + ROCKET_CAM_HEIGHT, rd.mesh.position.z);
                cam.rotation.order = "YXZ";
                cam.rotation.y = yawRef.current;
                cam.rotation.x = pitchRef.current;
              }
              playerBodyPosRef.current.copy(rd.mesh.position);
              playerRef.current.velY = 0;
            }
          }
        }
      }

      // ── Airplane update ────────────────────────────────────────────────────────
      {
        const ad = airplaneDataRef.current;
        if (ad && cameraRef.current) {
          const cam = cameraRef.current;
          const keys = keysRef.current;

          if (ad.state === 'idle') {
            // Proximity check — show boarding prompt
            const playerPos3 = playerBodyPosRef.current;
            const dx = ad.position.x - playerPos3.x;
            const dz = ad.position.z - playerPos3.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            const isNear = dist < AIRPLANE_BOARD_RADIUS && !possessedSheepRef.current && !onBoatRef.current && !onRocketRef.current;
            nearAirplaneForBoardRef.current = isNear;
            setNearAirplanePrompt(isNear);
          } else {
            nearAirplaneForBoardRef.current = false;
            setNearAirplanePrompt(false);
          }

          if (ad.state === 'flying') {
            // ── Flight controls ─────────────────────────────────────────────
            const isSprinting = keys["ShiftLeft"] || keys["ShiftRight"];

            // Throttle
            if (keys["KeyW"]) {
              ad.speed = Math.min(ad.speed + AIRPLANE_ACCEL * dt, isSprinting ? AIRPLANE_MAX_SPEED : AIRPLANE_CRUISE_SPEED);
            } else {
              ad.speed = Math.max(ad.speed - AIRPLANE_DECEL * dt, 0);
            }

            // Pitch: S pitches nose up (climb), Space pitches up too
            if (keys["KeyS"] || keys["Space"]) {
              ad.pitch = Math.min(ad.pitch + AIRPLANE_PITCH_RATE * dt, AIRPLANE_MAX_PITCH);
            } else if (keys["KeyX"]) {
              ad.pitch = Math.max(ad.pitch - AIRPLANE_PITCH_RATE * dt, -AIRPLANE_MAX_PITCH);
            } else {
              // Auto-level pitch when no input
              ad.pitch *= Math.pow(0.92, dt * 60);
            }

            // Roll / bank: A rolls right, D rolls left (coordinated left/right turn)
            if (keys["KeyA"] || keys["ArrowLeft"]) {
              ad.roll = Math.max(ad.roll - AIRPLANE_ROLL_RATE * dt, -AIRPLANE_MAX_ROLL);
            } else if (keys["KeyD"] || keys["ArrowRight"]) {
              ad.roll = Math.min(ad.roll + AIRPLANE_ROLL_RATE * dt, AIRPLANE_MAX_ROLL);
            } else {
              // Auto-level roll
              ad.roll *= Math.pow(0.88, dt * 60);
            }

            // Yaw from bank (coordinated turn — roll causes yaw)
            ad.yaw += -ad.roll * AIRPLANE_YAW_RATE * dt;

            // ── Physics ──────────────────────────────────────────────────────
            // Forward direction based on yaw and pitch
            const cosP = Math.cos(ad.pitch);
            const sinP = Math.sin(ad.pitch);
            const cosY = Math.cos(ad.yaw);
            const sinY = Math.sin(ad.yaw);

            const fwdX = sinY * cosP;
            const fwdY = sinP;
            const fwdZ = cosY * cosP;

            // Stall effect: gravity if too slow
            const stallFactor = ad.speed < AIRPLANE_STALL_SPEED ? (1 - ad.speed / AIRPLANE_STALL_SPEED) : 0;

            ad.velocity.set(
              fwdX * ad.speed,
              fwdY * ad.speed + AIRPLANE_STALL_GRAVITY * stallFactor * dt,
              fwdZ * ad.speed
            );

            ad.position.addScaledVector(ad.velocity, dt);

            // Clamp to not go underground
            const terrainY = getTerrainHeightSampled(ad.position.x, ad.position.z);
            if (ad.position.y < terrainY + 1.5) {
              ad.position.y = terrainY + 1.5;
              ad.pitch = 0;
              ad.velocity.y = 0;
              // Slow down on "landing" / ground contact
              ad.speed *= 0.95;
              // If very slow — transition to idle (parked)
              if (ad.speed < 1) {
                ad.speed = 0;
                ad.state = 'idle';
                if (onAirplaneRef.current) {
                  // Graceful landing — keep player on board
                }
              }
            }

            // Update mesh transform
            ad.mesh.position.copy(ad.position);
            ad.mesh.rotation.order = "YXZ";
            ad.mesh.rotation.y = ad.yaw;
            ad.mesh.rotation.x = -ad.pitch;
            ad.mesh.rotation.z = ad.roll;

            // Spin propeller — faster at higher speeds
            const propSpeed = 8 + ad.speed * 0.5;
            (ad.propeller as unknown as THREE.Group).rotation.z += propSpeed * dt;

            // ── Camera while player is on the airplane ────────────────────────
            if (onAirplaneRef.current && isLockedRef.current) {
              if (cameraModeRef.current === "third") {
                // 3rd-person: camera behind and above the airplane
                const behindX = -Math.sin(ad.yaw) * AIRPLANE_CAM_DIST;
                const behindZ = -Math.cos(ad.yaw) * AIRPLANE_CAM_DIST;
                const targetCamPos = new THREE.Vector3(
                  ad.position.x + behindX,
                  ad.position.y + AIRPLANE_CAM_HEIGHT_TP,
                  ad.position.z + behindZ
                );
                cam.position.lerp(targetCamPos, Math.min(1, dt * 8));
                cam.lookAt(ad.position.x, ad.position.y + 0.5, ad.position.z);
              } else {
                // 1st-person: camera in cockpit
                const cockpitOffsetX = Math.sin(ad.yaw) * 0.8;
                const cockpitOffsetZ = Math.cos(ad.yaw) * 0.8;
                cam.position.set(
                  ad.position.x + cockpitOffsetX,
                  ad.position.y + AIRPLANE_CAM_HEIGHT,
                  ad.position.z + cockpitOffsetZ
                );
                cam.rotation.order = "YXZ";
                cam.rotation.y = ad.yaw + Math.PI; // face forward (nose is +Z in local space)
                cam.rotation.x = -ad.pitch * 0.7;
                cam.rotation.z = ad.roll * 0.3;
              }
              playerBodyPosRef.current.copy(ad.position);
            }
          }
        }
      }

      // ── Build mode: ghost block preview & sculpt indicator position ───────────
      if (buildModeRef.current !== "explore" && cameraRef.current) {
        const cam = cameraRef.current;
        const raycaster = buildRaycasterRef.current;
        raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);

        if (buildModeRef.current === "build") {
          raycaster.far = BUILD_RANGE;
          const rayTargets: THREE.Object3D[] = terrainMeshRef.current
            ? [terrainMeshRef.current, ...placedBlockMeshesRef.current.values()]
            : [...placedBlockMeshesRef.current.values()];
          const hits = raycaster.intersectObjects(rayTargets, false);
          if (hits.length > 0 && hits[0].face && ghostMeshRef.current) {
            const placePos = getPlacementPosition(hits[0].point, hits[0].face.normal);
            ghostMeshRef.current.position.copy(placePos);
            ghostMeshRef.current.visible = true;
          } else if (ghostMeshRef.current) {
            ghostMeshRef.current.visible = false;
          }
          if (sculptIndicatorRef.current) sculptIndicatorRef.current.visible = false;
        } else if (buildModeRef.current === "sculpt") {
          raycaster.far = BUILD_RANGE * 2;
          if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
          if (terrainMeshRef.current && sculptIndicatorRef.current) {
            const hits = raycaster.intersectObject(terrainMeshRef.current, false);
            if (hits.length > 0) {
              const h = getTerrainHeightSampled(hits[0].point.x, hits[0].point.z);
              sculptIndicatorRef.current.position.set(hits[0].point.x, h + 0.12, hits[0].point.z);
              sculptIndicatorRef.current.visible = true;
            } else {
              sculptIndicatorRef.current.visible = false;
            }
          }
        }
      } else {
        if (ghostMeshRef.current) ghostMeshRef.current.visible = false;
        if (sculptIndicatorRef.current) sculptIndicatorRef.current.visible = false;
      }

      // ── Possessed sheep control ────────────────────────────────────────────
      if (isLockedRef.current && possessedSheepRef.current) {
        const sheep = possessedSheepRef.current;
        const s = sheep.mesh;
        const keys = keysRef.current;
        const cam = cameraRef.current!;

        // Move sheep with WASD using the camera yaw for direction
        const sheepFwd = new THREE.Vector3(
          -Math.sin(yawRef.current), 0, -Math.cos(yawRef.current)
        );
        const sheepRight = new THREE.Vector3(
          Math.cos(yawRef.current), 0, -Math.sin(yawRef.current)
        );
        const sheepMove = new THREE.Vector3();
        const sheepSpeed = SHEEP_FLEE_SPEED; // controlled sheep moves at flee speed

        if (keys["KeyW"] || keys["ArrowUp"])    sheepMove.addScaledVector(sheepFwd, sheepSpeed * dt);
        if (keys["KeyS"] || keys["ArrowDown"])  sheepMove.addScaledVector(sheepFwd, -sheepSpeed * dt);
        if (keys["KeyA"] || keys["ArrowLeft"])  sheepMove.addScaledVector(sheepRight, -sheepSpeed * dt);
        if (keys["KeyD"] || keys["ArrowRight"]) sheepMove.addScaledVector(sheepRight, sheepSpeed * dt);

        const sheepPrevX = s.position.x;
        const sheepPrevZ = s.position.z;
        s.position.add(sheepMove);

        // World bounds
        const half = WORLD_SIZE / 2 - 20;
        s.position.x = Math.max(-half, Math.min(half, s.position.x));
        s.position.z = Math.max(-half, Math.min(half, s.position.z));

        // Water boundary
        if (getTerrainHeightSampled(s.position.x, s.position.z) < WATER_LEVEL) {
          s.position.x = sheepPrevX;
          s.position.z = sheepPrevZ;
        }

        // Snap to terrain
        s.position.y = getTerrainHeightSampled(s.position.x, s.position.z);

        // Sheep body faces the direction of movement; stays put when idle
        // Formula: sheep face is at local +X, so to face world direction (dx, dz):
        //   s.rotation.y = Math.atan2(-dz, dx)
        // Verified: W(yaw=0)→(-Z)✓, A→(-X)✓, D→(+X)✓, S→(+Z)✓
        if (sheepMove.lengthSq() > 0.0001) {
          const targetAngle = Math.atan2(-sheepMove.z, sheepMove.x);
          let diff = targetAngle - sheep.currentAngle;
          while (diff > Math.PI)  diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          sheep.currentAngle += diff * Math.min(1, dt * 8);
        }
        s.rotation.y = sheep.currentAngle;

        // Walk animation
        const isSheepMoving =
          keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"] ||
          keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
        const actualSheepSpeed = isSheepMoving ? sheepSpeed : 0;
        sheep.walkPhase += actualSheepSpeed * SHEEP_STEP_FREQ * dt;

        const legA =  SHEEP_LEG_SWING_FLEE * Math.sin(sheep.walkPhase);
        const legB = -SHEEP_LEG_SWING_FLEE * Math.sin(sheep.walkPhase);
        if (sheep.legPivots.length === 4) {
          sheep.legPivots[0].rotation.z = legA;
          sheep.legPivots[1].rotation.z = legB;
          sheep.legPivots[2].rotation.z = legB;
          sheep.legPivots[3].rotation.z = legA;
        }

        const bodyLift = isSheepMoving ? 0.07 * Math.abs(Math.sin(sheep.walkPhase)) : 0;
        sheep.bodyGroup.position.y = bodyLift;
        sheep.bodyGroup.rotation.x = 0;

        // Head gently nods
        const headTarget = isSheepMoving
          ? 0.08 * Math.sin(sheep.walkPhase * 2 + sheep.phaseOffset)
          : -0.1;
        sheep.headPitchCurrent += (headTarget - sheep.headPitchCurrent) * Math.min(1, dt * 3);
        sheep.headGroup.rotation.z = sheep.headPitchCurrent;
        sheep.headGroup.rotation.y = 0;

        // Tail wag
        sheep.tailGroup.rotation.y = 0.6 * Math.sin(elapsed * 4.5 + sheep.phaseOffset);

        // Position camera based on current mode
        if (cameraModeRef.current === "third") {
          // 3rd-person: orbit camera behind and above the sheep
          const behindX = Math.sin(yawRef.current) * TP_DISTANCE;
          const behindZ = Math.cos(yawRef.current) * TP_DISTANCE;
          const pitchOffset = Math.sin(pitchRef.current) * TP_DISTANCE * 0.5;
          cam.position.set(
            s.position.x + behindX,
            s.position.y + TP_HEIGHT + pitchOffset,
            s.position.z + behindZ
          );
          cam.lookAt(s.position.x, s.position.y + 0.7, s.position.z);
        } else {
          // 1st-person: camera at sheep head level
          cam.position.set(s.position.x, s.position.y + POSSESS_CAM_HEIGHT, s.position.z);
          cam.rotation.order = "YXZ";
          cam.rotation.y = yawRef.current;
          cam.rotation.x = pitchRef.current;
        }
      }

      // ── Third-person player body mesh: position, rotation, walk animation ────
      if (playerBodyRef.current) {
        if (cameraModeRef.current === "third" && !possessedSheepRef.current) {
          playerBodyRef.current.visible = true;
          // Place body so feet rest on terrain (cam Y = terrain + PLAYER_HEIGHT,
          // remote mesh origin is at body centre ≈ 0.825 above foot level)
          playerBodyRef.current.position.set(
            playerBodyPosRef.current.x,
            playerBodyPosRef.current.y - PLAYER_HEIGHT + 0.825,
            playerBodyPosRef.current.z
          );
          // Body faces forward (same direction as yaw, flipped to face away from camera)
          playerBodyRef.current.rotation.y = yawRef.current + Math.PI;

          // Walk cycle animation
          const isMovingNow = !!(
            keysRef.current["KeyW"] || keysRef.current["KeyS"] ||
            keysRef.current["KeyA"] || keysRef.current["KeyD"]
          );
          if (isMovingNow && isLockedRef.current) playerBodyLegPhaseRef.current += dt * 6;
          const swing = isMovingNow ? 0.5 * Math.sin(playerBodyLegPhaseRef.current) : 0;
          const pbLegL = playerBodyRef.current.getObjectByName("legL");
          const pbLegR = playerBodyRef.current.getObjectByName("legR");
          const pbArmL = playerBodyRef.current.getObjectByName("armL");
          const pbArmR = playerBodyRef.current.getObjectByName("armR");
          if (pbLegL) pbLegL.rotation.x = swing;
          if (pbLegR) pbLegR.rotation.x = -swing;
          if (pbArmL) pbArmL.rotation.x = -swing * 0.5;
          if (pbArmR) pbArmR.rotation.x = swing * 0.5;
        } else {
          playerBodyRef.current.visible = false;
        }
      }

      // ── Coin collection & rotation ─────────────────────────────────────────
      // Use playerBodyPosRef so gameplay logic is always based on player body
      // position (in 3rd-person cam.position is the camera offset, not the body).
      const playerPos = playerBodyPosRef.current;
      let collected = coinsCollectedRef.current;
      coinsRef.current.forEach((coin) => {
        if (coin.collected) return;
        coin.mesh.rotation.y += dt * 2.2;
        coin.mesh.position.y =
          getTerrainHeightSampled(coin.mesh.position.x, coin.mesh.position.z) +
          0.8 +
          Math.sin(elapsed * 2 + coin.mesh.position.x) * 0.15;

        const dx = playerPos.x - coin.mesh.position.x;
        const dz = playerPos.z - coin.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < COIN_COLLECT_RADIUS) {
          coin.collected = true;
          coin.mesh.visible = false;
          coinsCollectedRef.current++;
          collected = coinsCollectedRef.current;
          soundManager.playCoinCollect();
          // Coins restore player HP — connects the collection mechanic to the combat system
          const healedAmount = Math.min(COIN_HEAL_AMOUNT, PLAYER_MAX_HP - playerHpRef.current);
          if (healedAmount > 0) {
            playerHpRef.current = Math.min(PLAYER_MAX_HP, playerHpRef.current + COIN_HEAL_AMOUNT);
            setAttackEffect(`+${healedAmount} HP`);
            setTimeout(() => setAttackEffect(null), 700);
          }
        }
      });

      // ── Attack cooldown ────────────────────────────────────────────────────
      if (playerAttackCooldownRef.current > 0) {
        playerAttackCooldownRef.current = Math.max(0, playerAttackCooldownRef.current - dt);
      }

      // ── Auto-fire while left mouse button is held (explore mode, non-bow) ──
      if (isMouseHeldRef.current && buildModeRef.current === "explore" && selectedWeaponRef.current !== "bow") {
        doAttack();
      }

      // ── Bow charge: update charge level and charge bar each frame ───────────
      if (isBowChargingRef.current) {
        const chargeSeconds = (performance.now() - bowChargeStartRef.current) / 1000;
        bowChargeRef.current = Math.min(1.0, chargeSeconds / BOW_MAX_CHARGE_TIME);
        if (bowChargeBarRef.current) {
          bowChargeBarRef.current.style.width = `${bowChargeRef.current * 100}%`;
          // Colour transitions: green → yellow → red as charge fills up
          const r = Math.round(bowChargeRef.current * 220);
          const g = Math.round(200 - bowChargeRef.current * 100);
          bowChargeBarRef.current.style.backgroundColor = `rgb(${r},${g},60)`;
        }
      }

      // ── Bow trajectory arc: simulate and render predicted arrow path ─────────
      {
        const arc = trajectoryArcRef.current;
        const cam = cameraRef.current;
        if (arc && cam && isBowChargingRef.current) {
          const TRAJ_ARC_POINTS = 80;
          const TRAJ_DT = 0.06; // seconds per simulation step

          // Start trajectory from the bow mesh world position so the arc
          // visually originates from the bow rather than the camera centre.
          const startPos = new THREE.Vector3();
          if (weaponMeshRef.current) {
            weaponMeshRef.current.getWorldPosition(startPos);
          } else {
            cam.getWorldPosition(startPos);
          }
          const fwd = new THREE.Vector3(0, 0, -1);
          fwd.transformDirection(cam.matrixWorld);

          const power = bowChargeRef.current;
          const effectiveSpeed = WEAPON_CONFIGS["bow"].bulletSpeed * Math.max(0.15, power);
          const vel = fwd.clone().multiplyScalar(effectiveSpeed);
          const pos = startPos.clone();

          // Line2 uses a flat Float32Array of XYZ triplets via setPositions()
          const posArr = new Float32Array(TRAJ_ARC_POINTS * 3);
          let endIndex = TRAJ_ARC_POINTS;

          for (let i = 0; i < TRAJ_ARC_POINTS; i++) {
            posArr[i * 3]     = pos.x;
            posArr[i * 3 + 1] = pos.y;
            posArr[i * 3 + 2] = pos.z;

            // Stop arc at terrain level
            const groundY = getTerrainHeightSampled(pos.x, pos.z);
            if (i > 0 && pos.y <= groundY + 0.05) {
              endIndex = i + 1;
              break;
            }

            // Advance physics (same as bullet update)
            vel.y += ARROW_GRAVITY * TRAJ_DT;
            pos.addScaledVector(vel, TRAJ_DT);
          }

          // Rebuild LineGeometry with the computed points (truncated to endIndex)
          (arc.geometry as LineGeometry).setPositions(posArr.subarray(0, endIndex * 3));
          arc.computeLineDistances();
          arc.visible = true;
        } else if (arc) {
          arc.visible = false;
        }
      }

      // ── Weapon sway & recoil animation ─────────────────────────────────────
      if (weaponMeshRef.current) {
        const wep = weaponMeshRef.current;
        // Recoil: kick back in z then spring forward
        weaponRecoilRef.current = Math.max(0, weaponRecoilRef.current - dt * 8);
        const recoil = weaponRecoilRef.current;

        // Idle sway: gentle bob while moving
        const isMoving =
          keysRef.current["KeyW"] || keysRef.current["KeyS"] ||
          keysRef.current["KeyA"] || keysRef.current["KeyD"] ||
          keysRef.current["ArrowUp"] || keysRef.current["ArrowDown"];
        const swayAmt = isMoving ? 0.012 : 0.005;
        const swaySpeed = isMoving ? 7 : 3;

        const wType = selectedWeaponRef.current;
        const baseX = wType === "bow" ? 0.16 : wType === "crossbow" ? 0.18 : 0.25; // sword: 0.25
        const baseY = wType === "bow" ? -0.16 : wType === "crossbow" ? -0.22 : -0.28; // sword: -0.28
        const baseZ = wType === "bow" ? -0.40 : wType === "crossbow" ? -0.52 : -0.48; // sword: -0.48

        if (wType === "sword") {
          // ── Sword swing animation ─────────────────────────────────────────
          const SWORD_SWING_DURATION = 0.30; // seconds for one full slash
          if (swordSwingTimerRef.current < SWORD_SWING_DURATION) {
            swordSwingTimerRef.current += dt;
          }
          const swingProgress = Math.min(1, swordSwingTimerRef.current / SWORD_SWING_DURATION);
          // Bell-curve: 0 → peak at 0.5 → 0. Gives a smooth out-and-back slash.
          const swingAngle = Math.sin(swingProgress * Math.PI);

          // Position: subtle forward thrust at peak of swing
          wep.position.set(
            baseX + Math.sin(elapsed * swaySpeed * 0.5) * swayAmt * 0.6 - swingAngle * 0.04,
            baseY + Math.abs(Math.sin(elapsed * swaySpeed)) * swayAmt,
            baseZ - swingAngle * 0.06
          );
          // Rotation: tip starts up (-π/2), swings forward to near-horizontal, then returns
          wep.rotation.x = -Math.PI / 2 + swingAngle * 1.5; // tip up → swing forward
          wep.rotation.y = -0.3 + swingAngle * 0.25;         // slight outward sweep
          wep.rotation.z = 0.3  - swingAngle * 0.55;         // slash from right to left
        } else {
          wep.position.set(
            baseX + Math.sin(elapsed * swaySpeed * 0.5) * swayAmt * 0.6,
            baseY + Math.abs(Math.sin(elapsed * swaySpeed)) * swayAmt - recoil * 0.04,
            baseZ + recoil * 0.12
          );
          wep.rotation.x = recoil * 0.18 + Math.sin(elapsed * swaySpeed) * swayAmt * 0.4;
        }

        // ── Bow draw animation ──────────────────────────────────────────────
        // When the player holds the mouse, drawProgress = bowChargeRef (0→1).
        // Otherwise (idle / after firing) use cooldown-based relaxed state.
        if (wType === "bow") {
          let drawProgress: number;
          if (isBowChargingRef.current) {
            // Active draw: reflect real charge amount
            drawProgress = bowChargeRef.current;
          } else {
            // Relaxed / reload state: string returns to rest as cooldown expires
            const bowCooldown = WEAPON_CONFIGS["bow"].cooldown;
            drawProgress = bowCooldown > 0
              ? 1 - Math.min(1, playerAttackCooldownRef.current / bowCooldown)
              : 1;
            // Keep string slack until player draws again
            drawProgress *= 0.15; // partially visible tension at rest
          }

          const bowstringGroup = wep.getObjectByName("bowstring");
          if (bowstringGroup) {
            // Pull string back toward the archer (+Z in bow-local space)
            const pullZ = drawProgress * 0.034;
            bowstringGroup.position.z = pullZ;
            // Slightly pull string away from limb tips when drawn
            bowstringGroup.position.x = drawProgress * -0.008;
          }

          // Tilt bow and pull weapon back slightly when fully drawn (aiming posture)
          wep.rotation.z = drawProgress * -0.10;
          if (isBowChargingRef.current) {
            // Pull bow slightly toward player as string is drawn
            wep.position.z += drawProgress * 0.06;
          }
        }
      }

      // ── Bullet update ──────────────────────────────────────────────────────
      const toRemove: BulletData[] = [];
      bulletsRef.current.forEach((bullet) => {
        // ── Stuck arrows: count down and remove after their embedded lifetime ──
        if (bullet.isStuck) {
          bullet.stuckLifetime = (bullet.stuckLifetime ?? 0) - dt;
          if (bullet.stuckLifetime <= 0) toRemove.push(bullet);
          return; // no further physics or collision for stuck arrows
        }

        bullet.lifetime -= dt;
        if (bullet.lifetime <= 0) {
          toRemove.push(bullet);
          return;
        }

        // Apply gravity and orient arrow along velocity (bow arrows only)
        if (bullet.useGravity) {
          bullet.velocity.y += ARROW_GRAVITY * dt;
          if (bullet.velocity.lengthSq() > 0.001) {
            const dir = bullet.velocity.clone().normalize();
            bullet.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
          }
        }

        // Move bullet forward
        bullet.mesh.position.addScaledVector(bullet.velocity, dt);

        // ── Arrow ground sticking (bow arrows only) ──────────────────────────
        if (bullet.useGravity && !bullet.isStuck) {
          const groundY = getTerrainHeightSampled(
            bullet.mesh.position.x,
            bullet.mesh.position.z
          );
          if (bullet.mesh.position.y <= groundY + 0.05) {
            // Snap arrow tip to just above terrain
            bullet.mesh.position.y = groundY + 0.05;
            // Freeze the arrow in place (orientation already set by gravity loop above)
            bullet.velocity.set(0, 0, 0);
            bullet.isStuck = true;
            bullet.stuckLifetime = 12; // visible in ground for 12 seconds then removed
            return; // skip collision checks — arrow is stuck in the ground
          }
        }

        // Check fox collisions
        let bulletHit = false;
        for (const fox of foxListRef.current) {
          if (!fox.isAlive) continue;
          const dist = bullet.mesh.position.distanceTo(fox.mesh.position);
          if (dist < BULLET_HIT_RADIUS) {
            // Use the weapon that fired this bullet (not the currently selected weapon)
            const weaponKey = bullet.weaponType ?? selectedWeaponRef.current;
            const baseDmg = WEAPON_CONFIGS[weaponKey].damage;
            // Scale bow arrow damage by the draw power stored on the bullet
            const dmg = bullet.power !== undefined
              ? Math.round(baseDmg * (0.5 + 0.5 * bullet.power))
              : baseDmg;
            fox.hp = Math.max(0, fox.hp - dmg);
            fox.hitFlashTimer = 0.25;
            flashFoxMesh(fox.mesh);
            soundManager.playFoxHit();
            setAttackEffect(`-${dmg}`);
            setTimeout(() => setAttackEffect(null), 700);
            if (fox.hp <= 0) {
              fox.isAlive = false;
              foxesDefeatedRef.current++;
              soundManager.playFoxDeath();
            }
            toRemove.push(bullet);
            bulletHit = true;
            break;
          }
        }

        // Check catapult collisions (bullets can damage catapults)
        if (!bulletHit) {
          for (const cat of catapultListRef.current) {
            if (!cat.isAlive) continue;
            const dist = bullet.mesh.position.distanceTo(cat.mesh.position);
            if (dist < CATAPULT_HIT_RADIUS) {
              // Use the weapon that fired this bullet (not the currently selected weapon)
              const weaponKey = bullet.weaponType ?? selectedWeaponRef.current;
              const baseDmg = WEAPON_CONFIGS[weaponKey].damage;
              const dmg = bullet.power !== undefined
                ? Math.round(baseDmg * (0.5 + 0.5 * bullet.power))
                : baseDmg;
              cat.hp = Math.max(0, cat.hp - dmg);
              cat.hitFlashTimer = 0.3;
              flashCatapultMesh(cat.mesh);
              soundManager.playFoxHit();
              setAttackEffect(`-${dmg}`);
              setTimeout(() => setAttackEffect(null), 700);
              if (cat.hp <= 0) {
                cat.isAlive = false;
                catapultsDefeatedRef.current++;
              }
              toRemove.push(bullet);
              bulletHit = true;
              break;
            }
          }
        }

        // Check spider collisions
        if (!bulletHit) {
          for (const spider of spiderListRef.current) {
            if (!spider.isAlive) continue;
            const dist = bullet.mesh.position.distanceTo(spider.mesh.position);
            if (dist < BULLET_HIT_RADIUS * 1.1) {
              const weaponKey = bullet.weaponType ?? selectedWeaponRef.current;
              const baseDmg = WEAPON_CONFIGS[weaponKey].damage;
              const dmg = bullet.power !== undefined
                ? Math.round(baseDmg * (0.5 + 0.5 * bullet.power))
                : baseDmg;
              spider.hp = Math.max(0, spider.hp - dmg);
              spider.hitFlashTimer = 0.25;
              flashSpiderMesh(spider.mesh);
              soundManager.playFoxHit();
              setAttackEffect(`-${dmg}`);
              setTimeout(() => setAttackEffect(null), 700);
              if (spider.hp <= 0) {
                spider.isAlive = false;
                spidersDefeatedRef.current++;
                soundManager.playFoxDeath();
              }
              toRemove.push(bullet);
              bulletHit = true;
              break;
            }
          }
        }

        // Check sheep collisions (ranged weapons can also kill sheep)
        if (!bulletHit) {
          for (const sheep of sheepListRef.current) {
            if (!sheep.isAlive || sheep.isDying) continue;
            const dist = bullet.mesh.position.distanceTo(sheep.mesh.position);
            if (dist < BULLET_HIT_RADIUS * 1.2) {
              // Use the weapon that fired this bullet (not the currently selected weapon)
              const weaponKey = bullet.weaponType ?? selectedWeaponRef.current;
              const baseDmg = WEAPON_CONFIGS[weaponKey].damage;
              // Apply bow power scaling the same way fox hits do
              const dmg = bullet.power !== undefined
                ? Math.round(baseDmg * (0.5 + 0.5 * bullet.power))
                : baseDmg;
              sheep.hp = Math.max(0, sheep.hp - dmg);
              sheep.hitFlashTimer = 0.25;
              flashSheepMesh(sheep.mesh);
              soundManager.playArrowHit();
              soundManager.playSheepBleat(0.8);
              setAttackEffect(`-${dmg}`);
              setTimeout(() => setAttackEffect(null), 700);
              if (sheep.hp <= 0 && !sheep.isDying) {
                sheep.isDying = true;
                sheep.deathTimer = 0;
                sheep.deathRotationY = sheep.mesh.rotation.y;
                spawnBloodParticles(scene, sheep.mesh.position);
              }
              toRemove.push(bullet);
              break;
            }
          }
        }
      });

      // Remove expired / hit bullets from scene and array
      if (toRemove.length > 0) {
        toRemove.forEach((b) => {
          scene.remove(b.mesh);
        });
        bulletsRef.current = bulletsRef.current.filter(
          (b) => !toRemove.includes(b)
        );
      }

      // ── Blood particle physics ──────────────────────────────────────────────
      if (bloodParticlesRef.current.length > 0) {
        const deadParticles: BloodParticle[] = [];
        bloodParticlesRef.current.forEach((p) => {
          p.lifetime -= dt;
          if (p.lifetime <= 0) {
            deadParticles.push(p);
            return;
          }
          // Gravity
          p.velocity.y -= 12 * dt;
          p.mesh.position.addScaledVector(p.velocity, dt);
          // Bounce off terrain surface (simple ground check)
          const groundY = getTerrainHeightSampled(p.mesh.position.x, p.mesh.position.z);
          if (p.mesh.position.y < groundY) {
            p.mesh.position.y = groundY;
            p.velocity.y = -p.velocity.y * 0.25; // damped bounce
            p.velocity.x *= 0.6;
            p.velocity.z *= 0.6;
          }
          // Fade out
          const mat = p.mesh.material as THREE.MeshLambertMaterial;
          mat.opacity = p.lifetime / p.maxLifetime;
        });
        if (deadParticles.length > 0) {
          deadParticles.forEach((p) => {
            scene.remove(p.mesh);
            p.mesh.geometry.dispose();
            (p.mesh.material as THREE.MeshLambertMaterial).dispose();
          });
          bloodParticlesRef.current = bloodParticlesRef.current.filter(
            (p) => !deadParticles.includes(p)
          );
        }
      }

      // ── Fox AI ─────────────────────────────────────────────────────────────
      let closestAliveFox: (typeof foxListRef.current)[0] | null = null;
      let closestAliveFoxDist = Infinity;

      // LOD radius for entities — on mobile we hide entities beyond this distance
      const LOD_ENTITY_VIS_SQ = IS_MOBILE ? 90 * 90 : Infinity;

      foxListRef.current.forEach((fox) => {
        // Skip all Fox AI when in space station — foxes are in the hidden earthGroup
        if (_inStation) return;
        const fm = fox.mesh;

        // Death animation: scale down then hide
        if (!fox.isAlive) {
          if (fm.visible) {
            fm.scale.setScalar(Math.max(0, fm.scale.x - dt * 4));
            if (fm.scale.x <= 0.01) fm.visible = false;
          }
          return;
        }

        // Hit flash timer
        if (fox.hitFlashTimer > 0) {
          fox.hitFlashTimer = Math.max(0, fox.hitFlashTimer - dt);
        }

        const distToPlayer = fm.position.distanceTo(playerPos);

        // Visibility LOD for mobile
        if (IS_MOBILE) {
          const fdx = fm.position.x - playerPos.x;
          const fdz = fm.position.z - playerPos.z;
          fm.visible = fdx * fdx + fdz * fdz < LOD_ENTITY_VIS_SQ;
          if (!fm.visible) return;
        }

        // Track nearest alive fox for HP display
        if (distToPlayer < closestAliveFoxDist) {
          closestAliveFoxDist = distToPlayer;
          closestAliveFox = fox;
        }

        // Fox hunts sheep only — does not chase player
        const foxPrevX = fm.position.x;
        const foxPrevZ = fm.position.z;

        {
          // Find closest sheep to hunt — refresh cache every ~0.25 s (4× per second)
          // instead of doing a full O(n) scan every frame for every fox.
          fox.sheepSearchTimer -= dt;
          if (fox.sheepSearchTimer <= 0) {
            let closestDist = FOX_CHASE_RADIUS;
            let closestSheep: SheepData | null = null;
            sheepListRef.current.forEach((sheep) => {
              if (!sheep.isAlive) return;
              const d = fm.position.distanceTo(sheep.mesh.position);
              if (d < closestDist) {
                closestDist = d;
                closestSheep = sheep;
              }
            });
            fox.cachedNearestSheep = closestSheep;
            fox.sheepSearchTimer = 0.25;
          }
          const closestSheep = fox.cachedNearestSheep;

          if (closestSheep !== null) {
            // Chase sheep
            const target = (closestSheep as SheepData).mesh.position;
            const dx = target.x - fm.position.x;
            const dz = target.z - fm.position.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if (len > 0.1) {
              fm.position.x += (dx / len) * FOX_SPEED * dt;
              fm.position.z += (dz / len) * FOX_SPEED * dt;
              fm.rotation.y = Math.atan2(-dz, dx);
            }
            if (len < 8) {
              (closestSheep as SheepData).isFleeing = true;
              const fleeAngle = Math.atan2(
                (closestSheep as SheepData).mesh.position.z - fm.position.z,
                (closestSheep as SheepData).mesh.position.x - fm.position.x
              );
              (closestSheep as SheepData).targetAngle = fleeAngle;
            }
          } else {
            // Wander
            fox.wanderTimer -= dt;
            if (fox.wanderTimer <= 0) {
              fox.wanderAngle += (Math.random() - 0.5) * Math.PI;
              fox.wanderTimer = 2 + Math.random() * 4;
            }
            fm.position.x += Math.cos(fox.wanderAngle) * FOX_SPEED * 0.5 * dt;
            fm.position.z += Math.sin(fox.wanderAngle) * FOX_SPEED * 0.5 * dt;
            fm.rotation.y = -fox.wanderAngle;

            const half = WORLD_SIZE / 2 - 20;
            if (Math.abs(fm.position.x) > half) fox.wanderAngle = Math.PI - fox.wanderAngle;
            if (Math.abs(fm.position.z) > half) fox.wanderAngle = -fox.wanderAngle;
          }
        }

        // Water boundary: fox cannot enter water
        if (getTerrainHeightSampled(fm.position.x, fm.position.z) < WATER_LEVEL) {
          fm.position.x = foxPrevX;
          fm.position.z = foxPrevZ;
          fox.wanderAngle = Math.atan2(fm.position.z, fm.position.x) + Math.PI;
        }

        // Snap to the visual terrain surface (bilinear interpolation matches mesh)
        fm.position.y = getTerrainHeightSampled(fm.position.x, fm.position.z);

      });

      setFoxWarning(false);

      // Update nearest fox HP display
      if (closestAliveFox && closestAliveFoxDist < 18) {
        const f = closestAliveFox as (typeof foxListRef.current)[0];
        setNearFoxHp({ hp: f.hp, maxHp: f.maxHp, name: "Liška" });
      } else {
        setNearFoxHp(null);
      }

      // ── Spider AI ───────────────────────────────────────────────────────────
      let spiderNear = false;
      let closestAliveSpider: SpiderData | null = null;
      let closestAliveSpiderDist = Infinity;

      spiderListRef.current.forEach((spider) => {
        const sm = spider.mesh;

        // Death animation: scale down then hide
        if (!spider.isAlive) {
          if (sm.visible) {
            sm.scale.setScalar(Math.max(0, sm.scale.x - dt * 3.5));
            if (sm.scale.x <= 0.01) sm.visible = false;
          }
          return;
        }

        // Hit flash timer
        if (spider.hitFlashTimer > 0) {
          spider.hitFlashTimer = Math.max(0, spider.hitFlashTimer - dt);
        }

        const cfg = SPIDER_TYPE_CONFIGS[spider.type];
        const distToPlayer = sm.position.distanceTo(playerPos);

        // Track nearest alive spider for HP display
        if (distToPlayer < closestAliveSpiderDist) {
          closestAliveSpiderDist = distToPlayer;
          closestAliveSpider = spider;
        }

        const spiderPrevX = sm.position.x;
        const spiderPrevZ = sm.position.z;

        const playerIsCloseToSpider = distToPlayer < SPIDER_AGGRO_RADIUS;

        if (playerIsCloseToSpider) {
          // Chase player
          const dx = playerPos.x - sm.position.x;
          const dz = playerPos.z - sm.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > cfg.attackRange) {
            sm.position.x += (dx / len) * cfg.speed * dt;
            sm.position.z += (dz / len) * cfg.speed * dt;
            sm.rotation.y = Math.atan2(-dz, dx);
          } else {
            // Attack player
            spider.attackCooldown -= dt;
            if (spider.attackCooldown <= 0) {
              spider.attackCooldown = cfg.attackCooldown;
              if (!gameOver && !onRocketRef.current && !inSpaceStationRef.current) {
                playerHpRef.current = Math.max(0, playerHpRef.current - cfg.attackDamage);
                setHitFlash(true);
                setTimeout(() => setHitFlash(false), 300);
                soundManager.playPlayerHit();
                if (playerHpRef.current <= 0) {
                  setGameOver(true);
                  if (document.pointerLockElement) document.exitPointerLock();
                }
              }
            }
          }

          // Territory boundary: spiders won't chase too far from cave
          const distToCave = Math.sqrt(
            (sm.position.x - spider.caveX) ** 2 +
            (sm.position.z - spider.caveZ) ** 2
          );
          if (distToCave > CAVE_TERRITORY_RADIUS) {
            sm.position.x = spiderPrevX;
            sm.position.z = spiderPrevZ;
          }
        } else {
          // Wander inside cave
          spider.wanderTimer -= dt;
          if (spider.wanderTimer <= 0) {
            spider.wanderAngle += (Math.random() - 0.5) * Math.PI * 1.2;
            spider.wanderTimer = 1.5 + Math.random() * 3;
          }
          sm.position.x += Math.cos(spider.wanderAngle) * cfg.speed * 0.3 * dt;
          sm.position.z += Math.sin(spider.wanderAngle) * cfg.speed * 0.3 * dt;
          sm.rotation.y = -spider.wanderAngle;

          // Keep inside cave territory
          const distToCave = Math.sqrt(
            (sm.position.x - spider.caveX) ** 2 +
            (sm.position.z - spider.caveZ) ** 2
          );
          if (distToCave > CAVE_TERRITORY_RADIUS * 0.8) {
            // Push back toward cave
            const backX = spider.caveX - sm.position.x;
            const backZ = spider.caveZ - sm.position.z;
            spider.wanderAngle = Math.atan2(backZ, backX);
          }
        }

        // Snap to terrain height
        sm.position.y = getTerrainHeightSampled(sm.position.x, sm.position.z);

        // Leg animation: spiders bob slightly as they walk
        const bобPhase = performance.now() * 0.004 + spiderListRef.current.indexOf(spider) * 1.3;
        sm.position.y += Math.abs(Math.sin(bобPhase)) * 0.06 * (cfg.scale);

        if (distToPlayer < 20) {
          spiderNear = true;
        }
      });

      // Update nearest spider HP display
      if (closestAliveSpider && closestAliveSpiderDist < 20) {
        const s = closestAliveSpider as SpiderData;
        setNearSpiderHp({ hp: s.hp, maxHp: s.maxHp, name: SPIDER_TYPE_CONFIGS[s.type].label });
      } else {
        setNearSpiderHp(null);
      }

      // ── Torch flickering ────────────────────────────────────────────────────
      caveTorchesRef.current.forEach((torch) => {
        torch.flickerTimer += dt * TORCH_FLICKER_SPEED;
        const flicker =
          Math.sin(torch.flickerTimer * 3.7) * 0.18 +
          Math.sin(torch.flickerTimer * 7.3) * 0.08 +
          Math.sin(torch.flickerTimer * 1.9) * 0.12;
        torch.light.intensity = torch.baseIntensity + flicker;
      });

      // ── Chest interaction ────────────────────────────────────────────────────
      const chest = treasureChestRef.current;
      if (chest && !chest.isOpened) {
        const chestDist = Math.sqrt(
          (playerPos.x - chest.x) ** 2 + (playerPos.z - chest.z) ** 2
        );
        if (chestDist < CHEST_OPEN_RADIUS) {
          // Auto-open when player gets close
          chest.isOpened = true;
          // Animate lid open
          chest.lidGroup.rotation.x = -Math.PI * 0.75;
          // Reward the player
          coinsCollectedRef.current += chest.rewardCoins;
          setChestOpenedMsg(true);
          setTimeout(() => setChestOpenedMsg(false), 3000);
          soundManager.playCoinCollect?.();
        }
      }

      // Update spiders defeated in HUD
      if (spidersDefeatedRef.current > 0) {
        // We rely on the HUD state update below
      }

      // ── Catapult AI ─────────────────────────────────────────────────────────
      let catapultNear = false;
      let closestAliveCatapult: CatapultData | null = null;
      let closestCatapultDist = Infinity;

      catapultListRef.current.forEach((cat) => {
        const cm = cat.mesh;

        // Death animation: scale down then hide
        if (!cat.isAlive) {
          if (cm.visible) {
            cm.scale.setScalar(Math.max(0, cm.scale.x - dt * 3));
            if (cm.scale.x <= 0.01) cm.visible = false;
          }
          return;
        }

        // Hit flash timer
        if (cat.hitFlashTimer > 0) {
          cat.hitFlashTimer = Math.max(0, cat.hitFlashTimer - dt);
        }

        const distToPlayer = cm.position.distanceTo(playerPos);

        // Track nearest alive catapult for HP display
        if (distToPlayer < closestCatapultDist) {
          closestCatapultDist = distToPlayer;
          closestAliveCatapult = cat;
        }

        if (distToPlayer < 30) catapultNear = true;

        // Rotate catapult to face player
        const dx = playerPos.x - cm.position.x;
        const dz = playerPos.z - cm.position.z;
        const targetYaw = Math.atan2(-dx, -dz);
        cm.rotation.y += (targetYaw - cm.rotation.y) * Math.min(1, dt * 1.2);

        // Firing animation: arm swings forward on fire
        if (cat.firingAnimation > 0) {
          cat.firingAnimation = Math.max(0, cat.firingAnimation - dt * 2.5);
          // Arm rotation: rest = -1.1 rad (loaded), peak = +0.8 rad (released), then back
          const t = cat.firingAnimation;
          const armRot = t > 0.5
            ? THREE.MathUtils.lerp(0.8, -1.1, (t - 0.5) * 2)   // swing forward
            : THREE.MathUtils.lerp(-1.1, 0.8, 1 - t * 2);       // snap to release
          cat.armGroup.rotation.x = armRot;
        } else {
          // Slowly return to loaded position
          cat.armGroup.rotation.x += (-1.1 - cat.armGroup.rotation.x) * Math.min(1, dt * 1.5);
        }

        // Fire at player if in range and cooldown is ready
        cat.fireCooldown -= dt;
        if (cat.fireCooldown <= 0 && distToPlayer < CATAPULT_FIRE_RANGE) {
          cat.fireCooldown = CATAPULT_FIRE_COOLDOWN + (Math.random() - 0.5) * 1.5;
          cat.firingAnimation = 1.0;

          // Spawn cannonball from the tip of the arm (roughly 3 units above catapult)
          const launchPos = cm.position.clone();
          launchPos.y += 3.5;

          // Aim toward player with a slight upward arc
          const toDx = playerPos.x - launchPos.x;
          const toDz = playerPos.z - launchPos.z;
          const horizontal = Math.sqrt(toDx * toDx + toDz * toDz);
          const launchAngle = Math.atan2(CANNONBALL_SPEED * 0.65, horizontal); // arc
          const cosA = Math.cos(launchAngle);
          const sinA = Math.sin(launchAngle);
          const hSpeed = CANNONBALL_SPEED * cosA;
          const vSpeed = CANNONBALL_SPEED * sinA;

          // Larger, glowing cannonball for visibility
          const ballGeo = new THREE.SphereGeometry(0.38, 9, 6);
          const ballMat = new THREE.MeshLambertMaterial({
            color: 0x1a1a1a,
            emissive: 0x552200,   // faint ember glow
          });
          const ballMesh = new THREE.Mesh(ballGeo, ballMat);
          ballMesh.position.copy(launchPos);
          ballMesh.castShadow = true;
          scene.add(ballMesh);

          // Ground-shadow disc: flat dark circle projected to terrain below ball
          const shadowGeo = new THREE.CircleGeometry(1, 12);
          const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
          shadowMesh.rotation.x = -Math.PI / 2;
          shadowMesh.renderOrder = -1;
          scene.add(shadowMesh);

          const dirH = horizontal > 0.001
            ? new THREE.Vector3(toDx / horizontal, 0, toDz / horizontal)
            : new THREE.Vector3(0, 0, 1);

          cannonballsRef.current.push({
            mesh: ballMesh,
            shadowMesh,
            velocity: new THREE.Vector3(
              dirH.x * hSpeed,
              vSpeed,
              dirH.z * hSpeed
            ),
            lifetime: CANNONBALL_LIFETIME,
          });
        }
      });

      setCatapultWarning(catapultNear);

      if (closestAliveCatapult && closestCatapultDist < 35) {
        const c = closestAliveCatapult as CatapultData;
        setNearCatapultHp({ hp: c.hp, maxHp: c.maxHp });
      } else {
        setNearCatapultHp(null);
      }

      // ── Cannonball update ────────────────────────────────────────────────────
      const cannonballsToRemove: CannonballData[] = [];
      cannonballsRef.current.forEach((ball) => {
        ball.lifetime -= dt;
        if (ball.lifetime <= 0) {
          cannonballsToRemove.push(ball);
          return;
        }

        // Apply gravity (arc trajectory)
        ball.velocity.y += CANNONBALL_GRAVITY * dt;
        ball.mesh.position.addScaledVector(ball.velocity, dt);

        const bx = ball.mesh.position.x;
        const bz = ball.mesh.position.z;
        const groundY = getTerrainHeightSampled(bx, bz);

        // Update ground-shadow: project disc to terrain, scale with altitude
        const altitude = Math.max(0, ball.mesh.position.y - groundY);
        const shadowScale = Math.min(CANNONBALL_SHADOW_MAX_SCALE, 0.5 + altitude * 0.18);
        ball.shadowMesh.position.set(bx, groundY + 0.06, bz);
        ball.shadowMesh.scale.setScalar(shadowScale);
        // Fade shadow as ball gets very high (more transparent = farther away)
        const shadowMat = ball.shadowMesh.material as THREE.MeshBasicMaterial;
        shadowMat.opacity = Math.max(0.06, 0.45 - altitude * 0.006);

        // Despawn below terrain — show impact explosion
        if (ball.mesh.position.y < groundY) {
          spawnImpactEffect(scene, new THREE.Vector3(bx, groundY, bz));
          cannonballsToRemove.push(ball);
          return;
        }

        // Check player collision — no damage when player is in rocket or space station
        if (!gameOver && !onRocketRef.current && !inSpaceStationRef.current) {
          const distToPlayer = ball.mesh.position.distanceTo(playerPos);
          if (distToPlayer < CANNONBALL_HIT_RADIUS) {
            playerHpRef.current = Math.max(0, playerHpRef.current - CANNONBALL_DAMAGE);
            setHitFlash(true);
            setTimeout(() => setHitFlash(false), 350);
            soundManager.playPlayerHit();
            spawnImpactEffect(scene, ball.mesh.position.clone());
            cannonballsToRemove.push(ball);
          }
        }
      });

      if (cannonballsToRemove.length > 0) {
        cannonballsToRemove.forEach((b) => {
          scene.remove(b.mesh);
          scene.remove(b.shadowMesh);
        });
        cannonballsRef.current = cannonballsRef.current.filter(
          (b) => !cannonballsToRemove.includes(b)
        );
      }

      // ── Impact effects update ──────────────────────────────────────────────
      const doneEffects: ImpactEffect[] = [];
      impactEffectsRef.current.forEach((fx) => {
        fx.age += dt;
        const t = fx.age / fx.maxAge; // 0..1
        if (t >= 1) {
          doneEffects.push(fx);
          return;
        }
        // Expand ring and fade it out
        const ringScale = 1 + t * 8;
        fx.ring.scale.setScalar(ringScale);
        (fx.ring.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
        // Lift and fade debris particles
        fx.particles.forEach((p, i) => {
          p.position.y += dt * (1.5 + i * 0.3);
          (p.material as THREE.MeshBasicMaterial).opacity = 1 - t;
        });
      });
      if (doneEffects.length > 0) {
        doneEffects.forEach((fx) => {
          scene.remove(fx.ring);
          fx.particles.forEach((p) => scene.remove(p));
        });
        impactEffectsRef.current = impactEffectsRef.current.filter(
          (fx) => !doneEffects.includes(fx)
        );
      }

      // ── Bomb projectiles: physics, terrain collision, explosion ──────────────
      {
        const toDetonate: BombProjectileData[] = [];
        bombProjectilesRef.current.forEach((bomb) => {
          if (bomb.exploded) return;

          // Apply gravity and move
          bomb.velocity.y += BOMB_GRAVITY * dt;
          bomb.mesh.position.addScaledVector(bomb.velocity, dt);

          // Spin the bomb for visual realism
          bomb.mesh.rotation.x += 2.5 * dt;
          bomb.mesh.rotation.z += 1.8 * dt;

          // Fuse countdown
          bomb.fuseTimer -= dt;

          // Check terrain collision
          const groundY = getTerrainHeightSampled(
            bomb.mesh.position.x,
            bomb.mesh.position.z
          );
          if (bomb.mesh.position.y <= groundY + 0.1 || bomb.fuseTimer <= 0) {
            bomb.exploded = true;
            // Snap to terrain surface for the explosion centre
            if (bomb.mesh.position.y < groundY) bomb.mesh.position.y = groundY;
            toDetonate.push(bomb);
          }
        });

        // Trigger explosions and remove detonated bombs
        toDetonate.forEach((bomb) => {
          const pos = bomb.mesh.position.clone();
          scene.remove(bomb.mesh);
          spawnBombExplosion(scene, pos);
        });
        if (toDetonate.length > 0) {
          bombProjectilesRef.current = bombProjectilesRef.current.filter(
            (b) => !toDetonate.includes(b)
          );
        }
      }

      // ── World items: proximity pickup check + placement ghost ─────────────────
      if (!possessedSheepRef.current && !onBoatRef.current && !inSpaceStationRef.current && !activeHarborShipRef.current) {
        if (heldItemRef.current) {
          // Show placement ghost at terrain surface in front of player
          const ghost = itemPlacementGhostRef.current;
          if (ghost && cameraRef.current && terrainMeshRef.current) {
            const cam = cameraRef.current;
            const raycaster = buildRaycasterRef.current;
            raycaster.setFromCamera(new THREE.Vector2(0, 0), cam);
            const targets: THREE.Object3D[] = [terrainMeshRef.current, ...Array.from(placedBlockMeshesRef.current.values())];
            const hits = raycaster.intersectObjects(targets, false);
            if (hits.length > 0 && hits[0].distance < BUILD_RANGE + 2) {
              const hp = hits[0].point;
              const groundY = getTerrainHeightSampled(hp.x, hp.z);
              ghost.position.set(hp.x, groundY, hp.z);
              ghost.visible = buildModeRef.current === "explore";
            } else {
              ghost.visible = false;
            }
          }
          // Nearest pickable is irrelevant while holding
          nearestPickableItemRef.current = null;
          setNearItemPrompt(null);
        } else {
          // Hide ghost when not holding
          if (itemPlacementGhostRef.current) itemPlacementGhostRef.current.visible = false;
          // Find nearest non-held world item within PICKUP_RADIUS
          let bestDist = PICKUP_RADIUS;
          let bestItem: WorldItem | null = null;
          worldItemsRef.current.forEach((wi) => {
            if (wi.isHeld) return;
            const dx = wi.mesh.position.x - playerPos.x;
            const dz = wi.mesh.position.z - playerPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < bestDist) {
              bestDist = dist;
              bestItem = wi;
            }
          });
          nearestPickableItemRef.current = bestItem;
          const nearItem = bestItem as WorldItem | null;
          setNearItemPrompt(nearItem ? nearItem.type : null);
        }
      } else {
        if (itemPlacementGhostRef.current) itemPlacementGhostRef.current.visible = false;
        nearestPickableItemRef.current = null;
        setNearItemPrompt(null);
      }

      // ── Possession proximity — find nearest sheep, manage highlight ──────────
      if (!possessedSheepRef.current) {
        let nearestDist = POSSESS_RADIUS;
        let nearestSheep: SheepData | null = null;
        sheepListRef.current.forEach((sheep) => {
          // Cannot possess dead or dying sheep
          if (!sheep.isAlive || sheep.isDying) return;
          const d = sheep.mesh.position.distanceTo(playerPos);
          if (d < nearestDist) {
            nearestDist = d;
            nearestSheep = sheep;
          }
        });

        // Update emissive highlight: clear old, apply to new
        if (highlightedSheepRef.current && highlightedSheepRef.current !== nearestSheep) {
          setSheepEmissive(highlightedSheepRef.current, 0x000000);
          highlightedSheepRef.current = null;
        }
        if (nearestSheep && highlightedSheepRef.current !== nearestSheep) {
          setSheepEmissive(nearestSheep as SheepData, 0x2255ff);
          highlightedSheepRef.current = nearestSheep as SheepData;
        }
        nearestSheepForPossessRef.current = nearestSheep;
        setNearSheepPrompt(nearestSheep !== null);
      } else {
        // While possessed, clear any leftover highlight on other sheep
        if (highlightedSheepRef.current) {
          setSheepEmissive(highlightedSheepRef.current, 0x000000);
          highlightedSheepRef.current = null;
        }
        nearestSheepForPossessRef.current = null;
        setNearSheepPrompt(false);
      }

      // ── Sheep AI & Animation ────────────────────────────────────────────────
      let closeSheepCount = 0;
      sheepListRef.current.forEach((sheep) => {
        // Skip all Sheep AI when in space station — sheep are in the hidden earthGroup
        if (_inStation) return;
        // Possessed sheep is controlled in the dedicated possession block — skip its AI
        if (sheep === possessedSheepRef.current) return;

        const s = sheep.mesh;

        // Visibility LOD for mobile — skip AI for hidden distant sheep
        if (IS_MOBILE) {
          const sdx = s.position.x - playerPos.x;
          const sdz = s.position.z - playerPos.z;
          const visibleNow = sdx * sdx + sdz * sdz < LOD_ENTITY_VIS_SQ;
          s.visible = visibleNow;
          if (!visibleNow) return; // skip AI updates for hidden sheep
        } else {
          // Desktop LOD: skip AI for sheep beyond 200 units — they remain visible
          // but frozen until the player approaches (imperceptible at that distance).
          const sdx = s.position.x - playerPos.x;
          const sdz = s.position.z - playerPos.z;
          if (sdx * sdx + sdz * sdz > 200 * 200) return;
        }

        // ── Death animation ─────────────────────────────────────────────────
        if (sheep.isDying) {
          sheep.deathTimer += dt;
          const t = sheep.deathTimer;

          // Hit flash cooldown (may still be running)
          if (sheep.hitFlashTimer > 0) {
            sheep.hitFlashTimer = Math.max(0, sheep.hitFlashTimer - dt);
          }

          if (t < 0.35) {
            // Phase 1: violent body-shock shaking
            const shakeAmp = (0.35 - t) / 0.35; // 1 → 0
            const shake = Math.sin(t * 65) * shakeAmp;
            s.position.x += shake * 0.08;
            s.position.z += shake * 0.08;
            s.rotation.z = shake * 0.45;
            // Head snaps back
            sheep.headGroup.rotation.z = -0.3 - shakeAmp * 0.4;
            // Legs flail outward
            if (sheep.legPivots.length === 4) {
              sheep.legPivots.forEach((p, i) => {
                p.rotation.z = (i % 2 === 0 ? 1 : -1) * shakeAmp * 0.9;
              });
            }
          } else if (t < 1.4) {
            // Phase 2: exponential spin + tip over
            const fallT = (t - 0.35) / 1.05; // 0 → 1
            // Spin: fast at start (exponential decay feel)
            const spinSpeed = Math.pow(1 - fallT, 1.8) * 14; // rad/s
            sheep.deathRotationY += spinSpeed * dt;
            s.rotation.y = sheep.deathRotationY;
            // Tip over sideways (Z axis)
            s.rotation.z = fallT * (Math.PI / 2) * 1.05; // overshoot slightly
            // Small vertical bounce on initial impact
            const bounce = Math.max(0, Math.sin(fallT * Math.PI * 2.5) * (1 - fallT) * 0.3);
            s.position.y = getTerrainHeightSampled(s.position.x, s.position.z) + bounce;
            // Legs stick out stiff
            if (sheep.legPivots.length === 4) {
              sheep.legPivots.forEach((p, i) => {
                p.rotation.z = ((i % 2 === 0 ? 1 : -1) * 0.7) * (1 - fallT * 0.5);
              });
            }
          } else if (t < 2.4) {
            // Phase 3: fade out while lying on ground
            const fadeT = (t - 1.4) / 1.0; // 0 → 1
            const opacity = 1 - fadeT;
            s.traverse((child) => {
              const m = child as THREE.Mesh;
              if (m.isMesh && m.material) {
                const mat = m.material as THREE.MeshLambertMaterial;
                mat.transparent = true;
                mat.opacity = opacity;
              }
            });
            s.rotation.z = Math.PI / 2; // stay lying flat
          } else {
            // Animation complete — remove from scene
            scene.remove(s);
            sheep.isAlive = false;
            sheep.isDying = false;
            // Un-possess if the player was riding this sheep
            if (possessedSheepRef.current === sheep) {
              possessedSheepRef.current = null;
            }
          }
          return; // skip normal AI while dying
        }

        // Skip dead sheep entirely
        if (!sheep.isAlive) return;

        // Hit flash timer decay
        if (sheep.hitFlashTimer > 0) {
          sheep.hitFlashTimer = Math.max(0, sheep.hitFlashTimer - dt);
        }

        const dx = playerPos.x - s.position.x;
        const dz = playerPos.z - s.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        sheep.bleatTimer -= dt;
        if (sheep.bleatTimer <= 0) {
          sheep.bleating = true;
          sheep.bleatTimer = 10 + Math.random() * 20;
          setTimeout(() => { sheep.bleating = false; }, 1500);
          // Distance-based volume: 1.0 at the player, 0.0 at 28 units away.
          // Multiple sheep can bleat simultaneously – each call creates independent audio nodes.
          const BLEAT_RADIUS = 28;
          if (dist < BLEAT_RADIUS) {
            const bleatVolume = 1 - dist / BLEAT_RADIUS;
            soundManager.playSheepBleat(bleatVolume);
          }
        }

        if (Math.abs(s.position.x) < 14 && Math.abs(s.position.z) < 14) {
          closeSheepCount++;
        }

        // Sheep flee from the player body, but NOT when player is possessing a sheep
        // (controlled sheep moves naturally among others, not as a scary human presence)
        const fleeingFromPlayer = !possessedSheepRef.current && dist < SHEEP_FLEE_RADIUS;
        if (!sheep.isFleeing) sheep.isFleeing = fleeingFromPlayer;

        let movingSpeed = SHEEP_SPEED;

        if (sheep.isFleeing) {
          // Fleeing: run away from threat
          const angle = fleeingFromPlayer
            ? Math.atan2(-dz, -dx)
            : sheep.targetAngle;
          sheep.targetAngle = angle;
          movingSpeed = SHEEP_FLEE_SPEED;
          sheep.isFleeing = false;   // reset each frame — set by fox AI or player proximity
          sheep.isGrazing = false;   // stop grazing when fleeing
        } else {
          // ── Grazing logic ──────────────────────────────────────────────────
          sheep.grazingTimer -= dt;
          if (sheep.grazingTimer <= 0) {
            sheep.isGrazing = !sheep.isGrazing;
            if (sheep.isGrazing) {
              // Graze for 3–9 seconds
              sheep.grazingTimer = 3 + Math.random() * 6;
            } else {
              // Walk for 12–35 seconds before next graze
              sheep.grazingTimer = 12 + Math.random() * 23;
            }
          }

          if (!sheep.isGrazing) {
            // Natural wandering with gentle direction changes
            sheep.wanderTimer -= dt;
            if (sheep.wanderTimer <= 0) {
              // Small course corrections — max ±40° per change
              sheep.targetAngle += (Math.random() - 0.5) * Math.PI * 0.44;
              // Wander in one direction for 2–6 seconds
              sheep.wanderTimer = 2 + Math.random() * 4;
            }
            // Natural speed variation: combine two slow sine waves
            const t = elapsed + sheep.phaseOffset;
            const speedMult = 0.82 + 0.12 * Math.sin(t * 0.38) + 0.07 * Math.sin(t * 0.9 + 1.7);
            movingSpeed = SHEEP_SPEED * speedMult;
          } else {
            movingSpeed = 0; // standing still while grazing
          }
        }

        // ── Smooth turning — always face direction of travel ────────────────
        const isFlee = movingSpeed >= SHEEP_FLEE_SPEED;
        const turnRate = isFlee ? SHEEP_TURN_SPEED * 2.2 : SHEEP_TURN_SPEED;
        let angleDiff = sheep.targetAngle - sheep.currentAngle;
        while (angleDiff > Math.PI)  angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        const maxTurn = turnRate * dt;
        if (Math.abs(angleDiff) < maxTurn) {
          sheep.currentAngle = sheep.targetAngle;
        } else {
          sheep.currentAngle += Math.sign(angleDiff) * maxTurn;
        }

        // ── Movement ─────────────────────────────────────────────────────────
        const spd = movingSpeed * dt;
        const sheepPrevX = s.position.x;
        const sheepPrevZ = s.position.z;
        s.position.x += Math.cos(sheep.currentAngle) * spd;
        s.position.z += Math.sin(sheep.currentAngle) * spd;

        // Water boundary: sheep cannot enter water
        if (getTerrainHeightSampled(s.position.x, s.position.z) < WATER_LEVEL) {
          s.position.x = sheepPrevX;
          s.position.z = sheepPrevZ;
          sheep.targetAngle = sheep.currentAngle + Math.PI * (0.75 + Math.random() * 0.5);
        }

        // Boundary: reflect targetAngle so turning is smooth at edges
        const half = WORLD_SIZE / 2 - 20;
        if (Math.abs(s.position.x) > half) {
          s.position.x = Math.sign(s.position.x) * half;
          sheep.targetAngle = Math.PI - sheep.currentAngle;
        }
        if (Math.abs(s.position.z) > half) {
          s.position.z = Math.sign(s.position.z) * half;
          sheep.targetAngle = -sheep.currentAngle;
        }

        // Snap to the visual terrain surface (bilinear interpolation matches mesh)
        s.position.y = getTerrainHeightSampled(s.position.x, s.position.z);
        // Sheep rotation always matches currentAngle (it already turns smoothly)
        s.rotation.y = -sheep.currentAngle;

        // ── Walk phase ───────────────────────────────────────────────────────
        // Phase advances proportionally to actual speed
        sheep.walkPhase += movingSpeed * SHEEP_STEP_FREQ * dt;

        // ── Leg animation — diagonal gait ────────────────────────────────────
        // Pairs: (front-right[0] + back-left[3]) opposite to (front-left[1] + back-right[2])
        const swing = isFlee ? SHEEP_LEG_SWING_FLEE : SHEEP_LEG_SWING;
        const legA =  swing * Math.sin(sheep.walkPhase);
        const legB = -swing * Math.sin(sheep.walkPhase);
        if (sheep.legPivots.length === 4) {
          sheep.legPivots[0].rotation.z = legA;   // front-right
          sheep.legPivots[1].rotation.z = legB;   // front-left
          sheep.legPivots[2].rotation.z = legB;   // back-right
          sheep.legPivots[3].rotation.z = legA;   // back-left
        }

        // ── Body bounce — 2 small lifts per stride ───────────────────────────
        // Body rises slightly each time a diagonal pair lifts
        const bodyLift = (isFlee ? 0.07 : 0.035) * Math.abs(Math.sin(sheep.walkPhase));
        sheep.bodyGroup.position.y = bodyLift;

        // Subtle lateral body sway (sheep body rocks slightly side to side)
        const swayAmp = isFlee ? 0.04 : 0.018;
        sheep.bodyGroup.rotation.x = swayAmp * Math.sin(sheep.walkPhase + sheep.phaseOffset * 0.3);

        // ── Head animation ────────────────────────────────────────────────────
        // Smooth interpolation toward target pitch (graze = down, walk = gentle nod)
        const headTarget = sheep.isGrazing
          ? -0.65   // head lowered to graze
          : 0.08 * Math.sin(sheep.walkPhase * 2 + sheep.phaseOffset); // gentle nod while walking
        sheep.headPitchCurrent += (headTarget - sheep.headPitchCurrent) * Math.min(1, dt * 2.5);
        sheep.headGroup.rotation.z = sheep.headPitchCurrent;

        // Slight head yaw: sheep look slightly into turns
        const headLookAhead = Math.max(-0.22, Math.min(0.22, angleDiff * 0.4));
        sheep.headGroup.rotation.y = headLookAhead;

        // ── Tail wag — independent gentle oscillation ─────────────────────────
        const tailPhase = elapsed * 2.8 + sheep.phaseOffset * 1.5;
        const tailAmp = isFlee ? 0.6 : 0.28;
        sheep.tailGroup.rotation.y = tailAmp * Math.sin(tailPhase);
        sheep.tailGroup.rotation.x = 0.12 * Math.sin(tailPhase * 0.7 + 0.5);
      });

      // ── Remote player interpolation + leg animation ────────────────────────
      if (remotePlayersRef.current.size > 0) {
        const lerpFactor = 1 - Math.exp(-12 * dt);
        remotePlayersRef.current.forEach((data) => {
          const prevX = data.mesh.position.x;
          const prevZ = data.mesh.position.z;

          // Smooth position interpolation
          data.mesh.position.x += (data.targetX - data.mesh.position.x) * lerpFactor;
          data.mesh.position.y += (data.targetY - data.mesh.position.y) * lerpFactor;
          data.mesh.position.z += (data.targetZ - data.mesh.position.z) * lerpFactor;

          // Smooth rotation interpolation (handle angle wrap)
          let dRot = data.targetRotY - data.mesh.rotation.y;
          while (dRot > Math.PI) dRot -= 2 * Math.PI;
          while (dRot < -Math.PI) dRot += 2 * Math.PI;
          data.mesh.rotation.y += dRot * lerpFactor;

          // Leg animation based on horizontal speed
          const spd = Math.sqrt(
            (data.mesh.position.x - prevX) ** 2 +
            (data.mesh.position.z - prevZ) ** 2
          ) / dt;
          if (spd > 0.5 && data.legL && data.legR) {
            data.legPhase += spd * 2.0;
            const swing = Math.min(spd * 0.06, 0.55);
            data.legL.rotation.x = Math.sin(data.legPhase) * swing;
            data.legR.rotation.x = -Math.sin(data.legPhase) * swing;
            if (data.armL && data.armR) {
              data.armL.rotation.x = -Math.sin(data.legPhase) * swing * 0.6;
              data.armR.rotation.x = Math.sin(data.legPhase) * swing * 0.6;
            }
          } else {
            // Return legs to rest
            if (data.legL) data.legL.rotation.x *= 0.85;
            if (data.legR) data.legR.rotation.x *= 0.85;
            if (data.armL) data.armL.rotation.x *= 0.85;
            if (data.armR) data.armR.rotation.x *= 0.85;
          }

          data.prevX = data.mesh.position.x;
          data.prevZ = data.mesh.position.z;
        });
      }

      // ── Minimap ────────────────────────────────────────────────────────────
      // Redrawn every 3rd frame (~20 fps update at 60 fps target) — the small
      // dot positions change slowly enough that this is imperceptible.
      const canvas = minimapRef.current;
      if (canvas && cameraRef.current && frameCount % 3 === 0) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const W = 220;
          const scale = W / WORLD_SIZE;
          const cx = W / 2;
          const cy = W / 2;

          // Blend minimap bg: day #1a2e1a → night #060e06 (smooth with nightFactor)
          const mmR = Math.round(0x1a - nightFactor * (0x1a - 0x06));
          const mmG = Math.round(0x2e - nightFactor * (0x2e - 0x0e));
          const mmB = Math.round(0x1a - nightFactor * (0x1a - 0x06));
          ctx.fillStyle = `rgb(${mmR},${mmG},${mmB})`;
          ctx.fillRect(0, 0, W, W);

          // Pen
          ctx.strokeStyle = "#c8a050";
          ctx.lineWidth = 2.5;
          const penPx = 30 * scale * 2;
          ctx.strokeRect(cx - penPx / 2, cy - penPx / 2, penPx, penPx);

          // Coins
          coinsRef.current.forEach((coin) => {
            if (coin.collected) return;
            const mx = cx + coin.mesh.position.x * scale;
            const mz = cy + coin.mesh.position.z * scale;
            if (mx >= 0 && mx <= W && mz >= 0 && mz <= W) {
              ctx.fillStyle = "#ffd700";
              ctx.beginPath();
              ctx.arc(mx, mz, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Sheep
          sheepListRef.current.forEach((sheep) => {
            const mx = cx + sheep.mesh.position.x * scale;
            const mz = cy + sheep.mesh.position.z * scale;
            if (mx >= 0 && mx <= W && mz >= 0 && mz <= W) {
              ctx.fillStyle = "#ffffff";
              ctx.beginPath();
              ctx.arc(mx, mz, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Foxes
          foxListRef.current.forEach((fox) => {
            const mx = cx + fox.mesh.position.x * scale;
            const mz = cy + fox.mesh.position.z * scale;
            if (mx >= 0 && mx <= W && mz >= 0 && mz <= W) {
              ctx.fillStyle = "#ff6600";
              ctx.beginPath();
              ctx.arc(mx, mz, 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          });

          // Bombs — bright red circles so players can spot pickups at a glance
          worldItemsRef.current.forEach((item) => {
            if (item.type !== "bomb" || item.isHeld) return;
            const bmx = cx + item.mesh.position.x * scale;
            const bmz = cy + item.mesh.position.z * scale;
            if (bmx >= 0 && bmx <= W && bmz >= 0 && bmz <= W) {
              // Outer glow ring
              ctx.fillStyle = "rgba(255,60,0,0.35)";
              ctx.beginPath();
              ctx.arc(bmx, bmz, 5, 0, Math.PI * 2);
              ctx.fill();
              // Core dot
              ctx.fillStyle = "#ff3c00";
              ctx.beginPath();
              ctx.arc(bmx, bmz, 2.5, 0, Math.PI * 2);
              ctx.fill();
              // "B" label
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 7px monospace";
              ctx.fillText("B", bmx - 2.5, bmz + 2.5);
            }
          });

          // Lighthouse marker
          const lhMx = cx + LIGHTHOUSE_X * scale;
          const lhMz = cy + LIGHTHOUSE_Z * scale;
          if (lhMx >= 0 && lhMx <= W && lhMz >= 0 && lhMz <= W) {
            ctx.fillStyle = "#ff8c00";
            ctx.beginPath();
            ctx.arc(lhMx, lhMz, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 8px monospace";
            ctx.fillText("M", lhMx - 3, lhMz + 3);
          }

          // Airstrip marker — small airplane icon on the minimap
          {
            const ad = airplaneDataRef.current;
            const apX = ad ? ad.position.x : AIRPLANE_SPAWN_X;
            const apZ = ad ? ad.position.z : AIRPLANE_SPAWN_Z;
            const aMx = cx + apX * scale;
            const aMz = cy + apZ * scale;
            if (aMx >= 0 && aMx <= W && aMz >= 0 && aMz <= W) {
              ctx.fillStyle = "#86efac";
              ctx.beginPath();
              ctx.arc(aMx, aMz, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 8px monospace";
              ctx.fillText("✈", aMx - 4, aMz + 3);
            }
          }

          // Mountain marker
          {
            const mmx = cx + MOUNTAIN_X * scale;
            const mmz = cy + MOUNTAIN_Z * scale;
            if (mmx >= 0 && mmx <= W && mmz >= 0 && mmz <= W) {
              ctx.fillStyle = "#8abcff";
              ctx.beginPath();
              ctx.arc(mmx, mmz, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 8px monospace";
              ctx.fillText("⛰", mmx - 5, mmz + 3);
            }
          }

          // Player arrow — always based on body position, not camera offset
          const px = cx + playerBodyPosRef.current.x * scale;
          const pz = cy + playerBodyPosRef.current.z * scale;
          ctx.save();
          ctx.translate(px, pz);
          ctx.rotate(yawRef.current + Math.PI);
          ctx.fillStyle = "#00ff88";
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(-4, 4);
          ctx.lineTo(4, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Compass labels
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "bold 10px monospace";
          ctx.fillText("N", W / 2 - 4, 13);
          ctx.fillText("S", W / 2 - 4, W - 3);
          ctx.fillText("W", 3, W / 2 + 4);
          ctx.fillText("E", W - 12, W / 2 + 4);

          // Border
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, W, W);
        }
      }

      // ── HUD update ─────────────────────────────────────────────────────────
      // Throttled to every 6th frame (~10 updates/s at 60 fps) — HUD values
      // change slowly enough that this is imperceptible while saving ~2–3 ms
      // of React reconciliation overhead per frame.
      if (frameCount % 6 === 0) {
        setGameState((s) => ({
          ...s,
          sheepCollected: closeSheepCount,
          coinsCollected: collected,
          timeElapsed: elapsed,
          stamina: staminaRef.current,
          timeLabel: getTimeLabel(dayFraction),
          direction: getDirection(yawRef.current),
          playerHp: playerHpRef.current,
          foxesDefeated: foxesDefeatedRef.current,
          catapultsDefeated: catapultsDefeatedRef.current,
          spidersDefeated: spidersDefeatedRef.current,
          attackReady: playerAttackCooldownRef.current <= 0,
        }));
      }

      const bleatingNear = sheepListRef.current.find(
        (sheep) =>
          sheep.bleating && sheep.mesh.position.distanceTo(playerPos) < 20
      );
      setBleatingLabel(bleatingNear ? "🐑 Bééé!" : null);

      // ── Remote player name labels ──────────────────────────────────────────
      if (remotePlayersRef.current.size > 0 && cameraRef.current) {
        const labels: Array<{ id: string; name: string; x: number; y: number }> = [];
        remotePlayersRef.current.forEach((data, id) => {
          const pos = data.mesh.position.clone();
          pos.y += 2.2; // above head
          const projected = pos.project(cameraRef.current!);
          if (projected.z < 1) {
            const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;
            labels.push({ id, name: data.name, x: sx, y: sy });
          }
        });
        setPlayerLabels(labels);
      } else if (remotePlayersRef.current.size === 0) {
        setPlayerLabels([]);
      }

      renderer.render(scene, cameraRef.current!);
    };
    // Store a reference so onLockChange can restart the loop after a pause
    restartAnimLoopRef.current = () => animate();
    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      // LineMaterial needs the renderer resolution to calculate pixel-width lines
      if (trajectoryArcRef.current) {
        (trajectoryArcRef.current.material as LineMaterial).resolution.set(
          window.innerWidth,
          window.innerHeight
        );
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      // Clean up trajectory arc
      if (trajectoryArcRef.current) {
        scene.remove(trajectoryArcRef.current);
        trajectoryArcRef.current.geometry.dispose();
        (trajectoryArcRef.current.material as LineMaterial).dispose();
        trajectoryArcRef.current = null;
      }
      // Clean up any live bullets from the scene
      bulletsRef.current.forEach((b) => scene.remove(b.mesh));
      bulletsRef.current = [];
      // Clean up cannonballs and their shadow discs
      cannonballsRef.current.forEach((b) => { scene.remove(b.mesh); scene.remove(b.shadowMesh); });
      cannonballsRef.current = [];
      // Clean up impact effects
      impactEffectsRef.current.forEach((fx) => { scene.remove(fx.ring); fx.particles.forEach((p) => scene.remove(p)); });
      impactEffectsRef.current = [];
      // Clean up bomb projectiles
      bombProjectilesRef.current.forEach((b) => scene.remove(b.mesh));
      bombProjectilesRef.current = [];
      // Clean up blood particles
      bloodParticlesRef.current.forEach((p) => {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.MeshLambertMaterial).dispose();
      });
      bloodParticlesRef.current = [];
      // Clean up remote player meshes
      remotePlayersRef.current.forEach((data) => scene.remove(data.mesh));
      remotePlayersRef.current.clear();
      if (mpNotifTimerRef.current) clearTimeout(mpNotifTimerRef.current);
      // Clean up weather objects
      if (rainRef.current) { scene.remove(rainRef.current); rainRef.current = null; }
      if (lightningBoltRef.current) { scene.remove(lightningBoltRef.current); lightningBoltRef.current = null; }
      soundManager.destroy();
      // Dispose procedural terrain textures
      terrainTexGrass.dispose();
      terrainTexRock.dispose();
      terrainTexSand.dispose();
      terrainTexSnow.dispose();
      terrainTexDirt.dispose();
      renderer.dispose();
      if (mountNode) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(gameState.timeElapsed / 60);
  const seconds = Math.floor(gameState.timeElapsed % 60);
  const staminaPct = (gameState.stamina / STAMINA_MAX) * 100;
  const staminaColor =
    staminaPct > 60 ? "#4ade80" : staminaPct > 25 ? "#facc15" : "#f87171";
  const hpPct = (gameState.playerHp / PLAYER_MAX_HP) * 100;
  const hpColor = hpPct > 60 ? "#4ade80" : hpPct > 30 ? "#facc15" : "#f87171";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Lightning flash overlay */}
      {lightningFlash > 0.01 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: `rgba(220,235,255,${(lightningFlash * 0.82).toFixed(3)})`,
            zIndex: 52,
            transition: "opacity 0.04s",
          }}
        />
      )}

      {/* Weather label */}
      {gameStarted && (
        <div
          className="fixed pointer-events-none"
          style={{
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 55,
            background: "rgba(5,8,20,0.55)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "4px 14px",
            color: "rgba(255,255,255,0.85)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {weatherLabel}
        </div>
      )}

      {/* Hit flash overlay */}
      {hitFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "rgba(220,30,30,0.35)", zIndex: 50 }}
        />
      )}

      {/* Underwater tint overlay */}
      {isUnderwater && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(0,40,90,0.55) 0%, rgba(0,70,130,0.38) 100%)",
            zIndex: 48,
          }}
        />
      )}

      {/* Three.js canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-crosshair"
        onClick={() => {
          // On mobile the game is started via startMobileGame(); canvas clicks are
          // handled by MobileControls buttons — don't accidentally trigger attacks.
          if (IS_MOBILE) return;
          if (isLockedRef.current) {
            // Attack only in explore mode; build mode is handled by onMouseDown.
            // Bow uses hold-and-release mechanic — the onClick path is a fallback
            // for quick taps; fire at minimum power so the mechanic stays consistent.
            if (buildModeRef.current === "explore" && selectedWeaponRef.current !== "bow") {
              doAttack();
            }
          } else {
            lockPointer();
          }
        }}
      />

      {/* Crosshair */}
      {gameState.isLocked && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-6 h-6">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white opacity-80" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-white opacity-80" />
          </div>
        </div>
      )}

      {/* ═══════════════ LEFT SIDE PANEL ═══════════════ */}
      {gameState.isLocked && (
        <div
          className="fixed left-5 top-5 pointer-events-none select-none flex flex-col gap-3"
          style={{ width: 248 }}
        >
          {/* Player stats card */}
          <div
            className="rounded-2xl text-white"
            style={{
              padding: "18px 20px 20px",
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Section label */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 14 }}
            >
              <div
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}
              >
                Hráč
              </div>
              <div
                className="text-xs font-bold"
                style={{ color: "rgba(74,158,255,0.9)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {playerName}
              </div>
            </div>

            {/* HP bar */}
            <div style={{ marginBottom: 14 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 7 }}>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>❤️ Zdraví</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: hpColor }}>
                  {Math.round(gameState.playerHp)}/{PLAYER_MAX_HP}
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${hpPct}%`,
                    background: `linear-gradient(90deg, ${hpColor}dd, ${hpColor})`,
                    boxShadow: `0 0 10px ${hpColor}66`,
                  }}
                />
              </div>
            </div>

            {/* Stamina bar */}
            <div style={{ marginBottom: 18 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 7 }}>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>⚡ Výdrž</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: staminaColor }}>
                  {Math.round(staminaPct)}%
                </span>
              </div>
              <div
                className="h-3 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${staminaPct}%`,
                    background: `linear-gradient(90deg, ${staminaColor}dd, ${staminaColor})`,
                    boxShadow: `0 0 8px ${staminaColor}55`,
                  }}
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginBottom: 16 }} />

            {/* Section label */}
            <div
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginBottom: 12 }}
            >
              Úkoly
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>🐑 Ohrady</span>
                <span className="text-xs font-bold text-green-300 tabular-nums">
                  {gameState.sheepCollected}
                  <span style={{ color: "rgba(255,255,255,0.30)" }}> / {SHEEP_COUNT}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>🌟 Mince</span>
                <span className="text-xs font-bold text-yellow-300 tabular-nums">
                  {gameState.coinsCollected}
                  <span style={{ color: "rgba(255,255,255,0.30)" }}> / {COIN_COUNT}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>⏱ Čas hry</span>
                <span className="text-xs font-bold tabular-nums">
                  {minutes}:{String(seconds).padStart(2, "0")}
                </span>
              </div>
            </div>

            {/* Foxes defeated (conditional) */}
            {gameState.foxesDefeated > 0 && (
              <>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "16px 0 14px" }} />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>🦊 Poraženo</span>
                  <span className="text-xs font-bold text-orange-300 tabular-nums">
                    {gameState.foxesDefeated}
                  </span>
                </div>
              </>
            )}

            {/* Catapults defeated (conditional) */}
            {gameState.catapultsDefeated > 0 && (
              <>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "16px 0 14px" }} />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>⚔️ Katapulty</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: "#fbbf24" }}>
                    {gameState.catapultsDefeated}
                    <span style={{ color: "rgba(255,255,255,0.30)" }}> / {CATAPULT_COUNT}</span>
                  </span>
                </div>
              </>
            )}

            {/* Spiders defeated (conditional) */}
            {gameState.spidersDefeated > 0 && (
              <>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "16px 0 14px" }} />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>🕷 Pavouci</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: "#f87171" }}>
                    {gameState.spidersDefeated}
                  </span>
                </div>
              </>
            )}

            {/* Placed blocks counter */}
            {buildingUiState.blockCount > 0 && (
              <>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "16px 0 14px" }} />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>🧱 Bloky</span>
                  <span className="text-xs font-bold text-cyan-300 tabular-nums">
                    {buildingUiState.blockCount}
                    <span style={{ color: "rgba(255,255,255,0.30)" }}> / {MAX_BLOCKS}</span>
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Win notifications */}
          {gameState.sheepCollected === SHEEP_COUNT && (
            <div
              className="rounded-xl text-center text-yellow-300 font-bold text-xs animate-pulse"
              style={{
                padding: "10px 14px",
                background: "rgba(10,8,0,0.70)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,210,0,0.20)",
              }}
            >
              🎉 Všechny ovce v ohradě!
            </div>
          )}
          {gameState.coinsCollected === COIN_COUNT && (
            <div
              className="rounded-xl text-center text-yellow-200 font-bold text-xs animate-pulse"
              style={{
                padding: "10px 14px",
                background: "rgba(10,8,0,0.70)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,200,0,0.20)",
              }}
            >
              💰 Všechny mince sesbírány!
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ RIGHT SIDE PANEL ═══════════════ */}
      {gameState.isLocked && (
        <div className="fixed right-5 top-5 pointer-events-none select-none flex flex-col items-end gap-3">
          {/* Minimap with glass frame */}
          <div
            style={{
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <canvas ref={minimapRef} width={220} height={220} />
          </div>

          {/* Time + compass */}
          <div
            className="rounded-xl text-white text-xs font-medium flex items-center gap-3"
            style={{
              padding: "9px 14px",
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            <span>🕐 {gameState.timeLabel}</span>
            <span style={{ color: "rgba(255,255,255,0.25)" }}>|</span>
            <span>🧭 {gameState.direction}</span>
          </div>

          {/* Camera mode indicator */}
          <div
            className="rounded-xl text-xs font-bold text-center"
            style={{
              width: 220,
              padding: "9px 16px",
              background: cameraMode === 'third'
                ? "rgba(30,70,160,0.80)"
                : "rgba(5,8,20,0.72)",
              color: cameraMode === 'third' ? "#93c5fd" : "rgba(255,255,255,0.45)",
              backdropFilter: "blur(12px)",
              border: cameraMode === 'third'
                ? "1px solid rgba(100,160,255,0.30)"
                : "1px solid rgba(255,255,255,0.08)",
              boxShadow: cameraMode === 'third'
                ? "0 0 14px rgba(60,100,255,0.35)"
                : "none",
            }}
          >
            {cameraMode === 'third' ? "📷 3. osoba [V]" : "👁 1. osoba [V]"}
          </div>

          {/* Attack button */}
          <div
            className="rounded-xl text-xs font-bold text-center transition-all duration-150"
            style={{
              width: 168,
              padding: "11px 16px",
              background: gameState.attackReady
                ? "rgba(210,70,10,0.82)"
                : "rgba(40,40,50,0.70)",
              color: gameState.attackReady ? "#fff" : "rgba(255,255,255,0.35)",
              backdropFilter: "blur(12px)",
              border: gameState.attackReady
                ? "1px solid rgba(255,120,40,0.30)"
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: gameState.attackReady
                ? "0 0 16px rgba(210,70,10,0.45)"
                : "none",
            }}
          >
            {gameState.attackReady ? "⚔️  [F] Útok" : "⚔️  Nabíjení…"}
          </div>

          {/* Weapon slots HUD — all 3 weapons, active one highlighted */}
          {(["sword", "bow", "crossbow"] as WeaponType[]).map((w, idx) => {
            const cfg = WEAPON_CONFIGS[w];
            const isActive = selectedWeapon === w;
            const emoji = w === "sword" ? "⚔️" : w === "bow" ? "🏹" : "🎯";
            return (
              <div
                key={w}
                className="rounded-xl text-xs font-bold flex items-center gap-2"
                style={{
                  width: 168,
                  padding: "7px 14px",
                  background: isActive ? `${cfg.color}1a` : "rgba(0,0,0,0.40)",
                  backdropFilter: "blur(12px)",
                  border: isActive
                    ? `1px solid ${cfg.color}88`
                    : "1px solid rgba(255,255,255,0.08)",
                  color: isActive ? cfg.color : "rgba(255,255,255,0.30)",
                  boxShadow: isActive ? `0 0 12px ${cfg.color}33` : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ opacity: isActive ? 0.8 : 0.4, fontSize: 10 }}>[{idx + 1}]</span>
                <span>{emoji}</span>
                <span>{cfg.label}</span>
                {isActive && (
                  <span style={{ marginLeft: "auto", fontSize: 8, opacity: 0.6 }}>◀</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════ CENTER TOP — Underwater active banner ═══════════════ */}
      {isUnderwater && !onBoat && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 24px",
              background: "rgba(0,30,70,0.90)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(30,120,220,0.40)",
              boxShadow: "0 0 18px rgba(10,80,200,0.35)",
            }}
          >
            🌊 Pod vodou &nbsp;·&nbsp;
            <span style={{ color: "#7dd3fc" }}>[Mezerník] Vyplout</span>
            &nbsp;·&nbsp;
            <span style={{ color: "#93c5fd" }}>[Ctrl] Hlouběji</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Dive hint (at water surface) ═══════════════ */}
      {isSwimming && !isUnderwater && !onBoat && !nearBoatPrompt && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: "rgba(0,40,90,0.88)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(40,140,255,0.40)",
              boxShadow: "0 0 20px rgba(20,100,255,0.30)",
            }}
          >
            🌊 [Ctrl] Potápět se
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Boat boarding prompt ═══════════════ */}
      {nearBoatPrompt && !onBoat && !isPossessed && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: "rgba(10,50,100,0.88)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(60,160,255,0.40)",
              boxShadow: "0 0 20px rgba(30,120,255,0.35)",
            }}
          >
            ⛵ [E] Nastoupit na loď
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — On-boat active banner ═══════════════ */}
      {onBoat && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 24px",
              background: "rgba(10,40,80,0.90)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(60,160,255,0.30)",
              boxShadow: "0 0 18px rgba(30,100,255,0.30)",
            }}
          >
            ⛵ Na lodi &nbsp;·&nbsp; <span style={{ color: "#7dd3fc" }}>[E] Opustit loď</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Harbor sailboat boarding prompt ═══════════ */}
      {nearHarborShipPrompt && !onHarborShip && !onBoat && !isPossessed && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: "rgba(5,30,70,0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(80,180,255,0.50)",
              boxShadow: "0 0 24px rgba(40,140,255,0.45)",
            }}
          >
            ⛵ [E] Nastoupit na plachetnici
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — On harbor sailboat banner ═════════════ */}
      {onHarborShip && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 28px",
              background: "rgba(5,25,60,0.93)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(80,180,255,0.35)",
              boxShadow: "0 0 22px rgba(40,120,255,0.35)",
            }}
          >
            ⛵ Plachetnice&nbsp;·&nbsp;
            <span style={{ color: "#7dd3fc" }}>W/S Plyn · A/D Kormidlo · [E] Opustit</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Rocket boarding prompt ═══════════════ */}
      {nearRocketPrompt && !onRocket && !onBoat && !isPossessed && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: "rgba(60,20,0,0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,120,30,0.50)",
              boxShadow: "0 0 24px rgba(255,80,0,0.45)",
            }}
          >
            🚀 [E] Nastoupit do rakety
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — On-rocket active banner ═══════════════ */}
      {onRocket && !rocketLaunching && rocketCountdown === null && !rocketArrived && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 28px",
              background: "rgba(50,15,0,0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,120,30,0.40)",
              boxShadow: "0 0 20px rgba(255,80,0,0.35)",
            }}
          >
            🚀 V raketě &nbsp;·&nbsp; <span style={{ color: "#fdba74" }}>[Space] Odpálit</span> &nbsp;·&nbsp; <span style={{ color: "#fca5a5" }}>[E] Vystoupit</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Arrived at mothership prompt ═══════════════ */}
      {rocketArrived && onRocket && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 28px",
              background: "rgba(0,10,60,0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(100,160,255,0.60)",
              boxShadow: "0 0 28px rgba(80,120,255,0.55)",
            }}
          >
            🛸 Dosaženo vesmírné lodi! &nbsp;·&nbsp; <span style={{ color: "#93c5fd" }}>[E] Navštívit vesmírnou loď</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Rocket countdown ═══════════════ */}
      {rocketCountdown !== null && gameState.isLocked && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <div
            className="rounded-2xl text-white font-black animate-pulse"
            style={{
              padding: "24px 56px",
              fontSize: "6rem",
              lineHeight: 1,
              background: "rgba(80,10,0,0.90)",
              backdropFilter: "blur(16px)",
              border: "2px solid rgba(255,100,0,0.60)",
              boxShadow: "0 0 60px rgba(255,60,0,0.60)",
              color: "#ff6600",
              textShadow: "0 0 30px rgba(255,100,0,0.9)",
            }}
          >
            {rocketCountdown}
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Rocket launching banner ═══════════════ */}
      {rocketLaunching && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 28px",
              background: "rgba(80,10,0,0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,100,30,0.50)",
              boxShadow: "0 0 28px rgba(255,60,0,0.50)",
            }}
          >
            🔥 Startujeme! Letíme k vesmírné lodi...
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Welcome aboard message (auto-docking) ═══════════════ */}
      {stationWelcome && gameState.isLocked && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-2xl text-white font-bold text-base"
            style={{
              padding: "18px 40px",
              background: "rgba(10,30,80,0.92)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(100,180,255,0.50)",
              boxShadow: "0 0 40px rgba(60,140,255,0.50)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 6 }}>🛸</div>
            Dokování úspěšné!
            <div style={{ color: "#93c5fd", fontSize: "0.9rem", marginTop: 8 }}>
              Vítejte na palubě Matky lodí
            </div>
            <div style={{ color: "#60a5fa", fontSize: "0.75rem", marginTop: 4 }}>
              Prozkoumejte loď pomocí WASD
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ TOP — Space station active banner ═══════════════ */}
      {inSpaceStation && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 28px",
              background: "rgba(5,20,50,0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(60,140,255,0.45)",
              boxShadow: "0 0 22px rgba(30,80,255,0.40)",
            }}
          >
            🛸 Vesmírná loď &nbsp;·&nbsp; <span style={{ color: "#93c5fd" }}>WASD – pohyb &nbsp;·&nbsp; Mezerník – skok</span>
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM — Airlock exit prompt ═══════════════ */}
      {inSpaceStation && nearAirlockExit && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 28px",
              background: "rgba(5,20,50,0.95)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(80,160,255,0.60)",
              boxShadow: "0 0 28px rgba(40,100,255,0.55)",
            }}
          >
            🚀 [E] Airlock – vrátit se na Zemi
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Pickup item prompt ═══════════════ */}
      {nearItemPrompt && !heldItemType && !isPossessed && !onBoat && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: nearItemPrompt === "bomb"
                ? "rgba(40,10,10,0.92)"
                : "rgba(80,50,10,0.88)",
              backdropFilter: "blur(10px)",
              border: nearItemPrompt === "bomb"
                ? "1px solid rgba(255,80,20,0.55)"
                : "1px solid rgba(230,140,40,0.45)",
              boxShadow: nearItemPrompt === "bomb"
                ? "0 0 20px rgba(255,60,0,0.45)"
                : "0 0 20px rgba(200,100,0,0.40)",
            }}
          >
            {nearItemPrompt === "bomb" ? "💣" : "🎃"} [E] Vzít{" "}
            {nearItemPrompt === "pumpkin" ? "dýni" : nearItemPrompt === "bomb" ? "bombu" : nearItemPrompt}
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM CENTER — Held item indicator ═══════════════ */}
      {heldItemType && gameState.isLocked && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 28px",
              background: heldItemType === "bomb"
                ? "rgba(60,10,5,0.94)"
                : "rgba(80,40,5,0.90)",
              backdropFilter: "blur(10px)",
              border: heldItemType === "bomb"
                ? "1px solid rgba(255,80,20,0.60)"
                : "1px solid rgba(240,150,30,0.50)",
              boxShadow: heldItemType === "bomb"
                ? "0 0 26px rgba(255,60,0,0.50)"
                : "0 0 22px rgba(200,100,0,0.45)",
            }}
          >
            {heldItemType === "bomb" ? "💣" : "🎃"}{" "}
            {heldItemType === "pumpkin" ? "Dýně" : heldItemType === "bomb" ? "Bomba" : heldItemType} v ruce
            &nbsp;·&nbsp;
            {heldItemType === "bomb" ? (
              <span style={{ color: "#f87171" }}>[G] Hodit</span>
            ) : (
              <span style={{ color: "#fcd34d" }}>[Klik / F] Položit</span>
            )}
            &nbsp;·&nbsp;
            <span style={{ color: "#fca5a5" }}>[E] Upustit</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Possession prompt ═══════════════ */}
      {nearSheepPrompt && !isPossessed && !onBoat && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: "rgba(20,40,120,0.85)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(80,130,255,0.35)",
              boxShadow: "0 0 20px rgba(60,100,255,0.35)",
            }}
          >
            🐑 [E] Vstoupit do těla ovce
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — Possession active banner ═══════════════ */}
      {isPossessed && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 24px",
              background: "rgba(20,60,20,0.88)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(80,200,80,0.30)",
              boxShadow: "0 0 18px rgba(60,180,60,0.30)",
            }}
          >
            🐑 Hraješ za ovci &nbsp;·&nbsp; <span style={{ color: "#86efac" }}>[E] Opustit tělo</span>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — Fox warning ═══════════════ */}
      {foxWarning && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 22px",
              background: "rgba(160,30,0,0.80)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,80,30,0.25)",
              boxShadow: "0 0 20px rgba(200,40,0,0.40)",
            }}
          >
            🦊 Liška v blízkosti!
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — Spider warning ═══════════════ */}
      {nearSpiderHp && !foxWarning && !catapultWarning && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 22px",
              background: "rgba(80,0,0,0.85)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(200,30,30,0.35)",
              boxShadow: "0 0 20px rgba(160,0,0,0.45)",
            }}
          >
            🕷 Pavouk v blízkosti!
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — Catapult warning ═══════════════ */}
      {catapultWarning && !foxWarning && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none" style={{ zIndex: 61 }}>
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 22px",
              background: "rgba(100,50,0,0.88)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,180,30,0.35)",
              boxShadow: "0 0 22px rgba(200,120,0,0.50)",
            }}
          >
            ⚔️ Katapult v blízkosti!
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Nearest catapult HP ═══════════════ */}
      {nearCatapultHp && gameState.isLocked && (
        <div className="fixed bottom-52 left-1/2 -translate-x-1/2 pointer-events-none select-none" style={{ zIndex: 60 }}>
          <div
            className="rounded-2xl text-white text-xs text-center"
            style={{
              padding: "12px 22px 14px",
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,180,40,0.20)",
              minWidth: 200,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div className="font-bold text-sm" style={{ color: "#fbbf24", marginBottom: 8 }}>
              Katapult
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)", marginBottom: 6 }}>
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${(nearCatapultHp.hp / nearCatapultHp.maxHp) * 100}%`,
                  background: nearCatapultHp.hp > nearCatapultHp.maxHp * 0.5 ? "#f59e0b" : "#ef4444",
                  boxShadow: "0 0 8px #f59e0b66",
                }}
              />
            </div>
            <div style={{ color: "rgba(255,255,255,0.40)" }} className="text-xs tabular-nums">
              {nearCatapultHp.hp} / {nearCatapultHp.maxHp}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Nearest fox HP ═══════════════ */}
      {nearFoxHp && gameState.isLocked && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-2xl text-white text-xs text-center"
            style={{
              padding: "14px 22px 16px",
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.10)",
              minWidth: 210,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="font-bold text-sm"
              style={{ color: "#fb923c", marginBottom: 10 }}
            >
              {nearFoxHp.name}
            </div>
            <div
              className="h-3 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)", marginBottom: 8 }}
            >
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${(nearFoxHp.hp / nearFoxHp.maxHp) * 100}%`,
                  background:
                    nearFoxHp.hp > nearFoxHp.maxHp * 0.5 ? "#f97316" : "#ef4444",
                  boxShadow:
                    nearFoxHp.hp > nearFoxHp.maxHp * 0.5
                      ? "0 0 8px #f9731666"
                      : "0 0 8px #ef444466",
                }}
              />
            </div>
            <div style={{ color: "rgba(255,255,255,0.40)" }} className="text-xs tabular-nums">
              {nearFoxHp.hp} / {nearFoxHp.maxHp}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Nearest spider HP ═══════════════ */}
      {nearSpiderHp && !nearFoxHp && gameState.isLocked && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-2xl text-white text-xs text-center"
            style={{
              padding: "14px 22px 16px",
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.10)",
              minWidth: 210,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="font-bold text-sm"
              style={{ color: "#dc2626", marginBottom: 10 }}
            >
              {nearSpiderHp.name}
            </div>
            <div
              className="h-3 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)", marginBottom: 8 }}
            >
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{
                  width: `${(nearSpiderHp.hp / nearSpiderHp.maxHp) * 100}%`,
                  background:
                    nearSpiderHp.hp > nearSpiderHp.maxHp * 0.5 ? "#b91c1c" : "#7f1d1d",
                  boxShadow: "0 0 8px #b91c1c66",
                }}
              />
            </div>
            <div style={{ color: "rgba(255,255,255,0.40)" }} className="text-xs tabular-nums">
              {nearSpiderHp.hp} / {nearSpiderHp.maxHp}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER — Chest opened message ═══════════════ */}
      {chestOpenedMsg && gameState.isLocked && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none" style={{ zIndex: 70 }}>
          <div
            className="rounded-2xl text-white font-bold text-center"
            style={{
              padding: "22px 36px",
              background: "rgba(20,12,4,0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(212,160,20,0.60)",
              boxShadow: "0 0 40px rgba(212,160,20,0.45)",
              fontSize: 18,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ color: "#fcd34d" }}>Truhla otevřena!</div>
            <div style={{ color: "#86efac", fontSize: 14, marginTop: 8 }}>
              +{CHEST_REWARD_COINS} zlatých mincí
            </div>
          </div>
        </div>
      )}

      {/* Attack effect popup */}
      {attackEffect && gameState.isLocked && (
        <div
          className="fixed top-1/2 left-1/2 pointer-events-none select-none"
          style={{ transform: "translate(-50%, -120px)", zIndex: 60 }}
        >
          <div
            className="font-bold text-2xl animate-bounce"
            style={{
              color: attackEffect === "Miss" ? "#9ca3af" : attackEffect?.startsWith("+") ? "#4ade80" : "#fbbf24",
              textShadow: "0 0 10px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.6)",
            }}
          >
            {attackEffect === "Miss" ? "Miss!" : attackEffect}
          </div>
        </div>
      )}

      {/* ═══════════════ BOW CHARGE BAR ═══════════════ */}
      {gameState.isLocked && selectedWeapon === "bow" && (
        <div
          className="fixed pointer-events-none select-none"
          style={{
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            opacity: 0,         // starts hidden; toggled by DOM ref in the game loop
            transition: "opacity 0.12s ease",
          }}
        >
          <div
            className="text-xs font-semibold text-center mb-1"
            style={{ color: "rgba(255,255,255,0.80)", letterSpacing: "0.05em" }}
          >
            Natažení luku
          </div>
          {/* Outer track */}
          <div
            style={{
              width: 160,
              height: 8,
              borderRadius: 6,
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.18)",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {/* Inner fill — manipulated directly via bowChargeBarRef */}
            <div
              ref={bowChargeBarRef}
              style={{
                height: "100%",
                width: "0%",
                borderRadius: 6,
                backgroundColor: "rgb(60,200,60)",
                boxShadow: "0 0 6px rgba(100,255,100,0.5)",
                transition: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM CENTER — Build Mode HUD ═══════════════ */}
      {gameState.isLocked && buildingUiState.mode !== "explore" && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 pointer-events-none select-none"
          style={{ zIndex: 55 }}
        >
          {/* Material palette */}
          <div className="flex gap-2 items-end justify-center" style={{ marginBottom: 10 }}>
            {BLOCK_MATERIAL_ORDER.map((mat, i) => {
              const def = BLOCK_DEFS[mat];
              const isSelected = buildingUiState.selectedMaterial === mat;
              const hex = "#" + def.color.toString(16).padStart(6, "0");
              return (
                <div key={mat} className="flex flex-col items-center gap-1">
                  <div
                    style={{
                      width: isSelected ? 46 : 34,
                      height: isSelected ? 46 : 34,
                      background: hex,
                      borderRadius: 8,
                      border: isSelected
                        ? "2px solid rgba(255,255,255,0.90)"
                        : "2px solid rgba(255,255,255,0.18)",
                      boxShadow: isSelected ? `0 0 14px ${hex}99` : "none",
                      transition: "all 0.14s ease",
                    }}
                  />
                  <span style={{ fontSize: 9, color: isSelected ? "#fff" : "rgba(255,255,255,0.45)" }}>
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected material label + mode indicator */}
          <div
            className="rounded-xl text-white text-xs text-center font-semibold"
            style={{
              padding: "9px 22px",
              background:
                buildingUiState.mode === "sculpt"
                  ? "rgba(0,180,220,0.82)"
                  : "rgba(60,160,50,0.82)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 2px 14px rgba(0,0,0,0.45)",
            }}
          >
            {buildingUiState.mode === "sculpt"
              ? "Tvarování terénu  ·  Scroll=výška  ·  [T] zpět  ·  [B] konec"
              : `Stavění: ${BLOCK_DEFS[buildingUiState.selectedMaterial].label}  ·  Klik=umístit  ·  Pklik=smazat  ·  Scroll=materiál  ·  [T] terén  ·  [B] konec`}
          </div>
        </div>
      )}

      {/* ═══════════════ BOTTOM CENTER — Controls hint ═══════════════ */}
      {gameState.isLocked && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white text-xs"
            style={{
              padding: "10px 20px",
              background: "rgba(5,8,20,0.60)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            WASD – pohyb &nbsp;·&nbsp; Myš – pohled &nbsp;·&nbsp; Mezerník – skok &nbsp;·&nbsp;
            Shift – sprint &nbsp;·&nbsp; Esc – pauza &nbsp;·&nbsp;{" "}
            <span style={{ color: "#f87171", opacity: 1 }}>[F]/Drž klik</span> – útok &nbsp;·&nbsp;{" "}
            <span style={{ color: "#86efac", opacity: 1 }}>[B]</span> – stavění &nbsp;·&nbsp;{" "}
            <span style={{ color: "#60a5fa", opacity: 1 }}>[E]</span> – vstoupit do ovce &nbsp;·&nbsp;{" "}
            <span style={{ color: "#34d399", opacity: 1 }}>[T]</span> – chat &nbsp;·&nbsp;{" "}
            <span style={{ color: "#fbbf24", opacity: 1 }}>[V]</span> – {cameraMode === "first" ? "1. osoba" : "3. osoba"} &nbsp;·&nbsp;{" "}
            <span style={{ color: "#c084fc", opacity: 1 }}>IMPLEMENT</span> – návrh
          </div>
        </div>
      )}

      {/* Bleat popup */}
      {bleatingLabel && gameState.isLocked && (
        <div className="fixed bottom-24 right-52 pointer-events-none select-none animate-bounce">
          <div
            className="rounded-xl px-4 py-2 text-white font-bold text-lg"
            style={{
              background: "rgba(5,8,20,0.65)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {bleatingLabel}
          </div>
        </div>
      )}

      {/* Pause overlay — shown when game started but pointer is unlocked (and not chatting).
          On mobile we never use pointer lock, so the pause overlay is suppressed. */}
      {!IS_MOBILE && gameStarted && !gameState.isLocked && !showIntro && !chatOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
          }}
          onClick={lockPointer}
        >
          <div
            className="rounded-2xl text-center text-white max-w-sm w-full"
            style={{
              padding: "44px 40px 40px",
              background: "rgba(8,16,36,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div className="text-5xl" style={{ marginBottom: 16 }}>⏸</div>
            <h2 className="text-3xl font-bold" style={{ marginBottom: 12 }}>Hra pozastavena</h2>
            <p className="text-gray-400 text-sm" style={{ marginBottom: 8 }}>
              Klikni kamkoliv nebo stiskni tlačítko pro pokračování
            </p>
            <p className="text-gray-600 text-xs" style={{ marginBottom: 28 }}>
              Tip: napiš <span className="font-bold text-purple-400">IMPLEMENT</span> pro návrh nápadu
            </p>
            <button
              className="bg-green-600 hover:bg-green-500 transition-colors text-white font-bold rounded-xl text-lg w-full"
              style={{ padding: "14px 32px" }}
              onClick={(e) => { e.stopPropagation(); lockPointer(); }}
            >
              Pokračovat
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {gameOver && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", zIndex: 100 }}
        >
          <div
            className="rounded-2xl text-center text-white max-w-sm w-full"
            style={{
              padding: "44px 40px 40px",
              background: "rgba(60,10,10,0.95)",
              border: "1px solid rgba(255,80,80,0.3)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            }}
          >
            <div className="text-5xl" style={{ marginBottom: 16 }}>💀</div>
            <h2 className="text-3xl font-bold" style={{ marginBottom: 12 }}>Byl jsi poražen!</h2>
            <p className="text-gray-400 text-sm" style={{ marginBottom: 8 }}>Lišky, pavouci nebo katapulty tě dostaly…</p>
            <p className="text-gray-500 text-xs" style={{ marginBottom: 4 }}>
              Porazil jsi <span className="text-orange-400 font-bold">{gameState.foxesDefeated}</span> lišek
            </p>
            {gameState.spidersDefeated > 0 && (
              <p className="text-gray-500 text-xs" style={{ marginBottom: 4 }}>
                Zabil jsi <span className="font-bold" style={{ color: "#f87171" }}>{gameState.spidersDefeated}</span> pavouků
              </p>
            )}
            {gameState.catapultsDefeated > 0 && (
              <p className="text-gray-500 text-xs" style={{ marginBottom: 4 }}>
                Zničil jsi <span className="font-bold" style={{ color: "#fbbf24" }}>{gameState.catapultsDefeated}</span> katapultů
              </p>
            )}
            <p className="text-gray-500 text-xs" style={{ marginBottom: 28 }}>
              Sebral jsi <span className="text-yellow-300 font-bold">{gameState.coinsCollected}</span> mincí z <span className="text-gray-400">{gameState.totalCoins}</span>
            </p>
            <button
              className="bg-red-700 hover:bg-red-600 transition-colors text-white font-bold rounded-xl text-lg w-full"
              style={{ padding: "14px 32px" }}
              onClick={() => window.location.reload()}
            >
              Zkusit znovu
            </button>
          </div>
        </div>
      )}

      {/* ─── Remote player name labels ───────────────────────────────────────── */}
      {playerLabels.map((label) => (
        <div
          key={label.id}
          className="fixed pointer-events-none select-none"
          style={{
            left: label.x,
            top: label.y,
            transform: "translate(-50%, -50%)",
            zIndex: 55,
          }}
        >
          <div
            className="rounded-lg text-white text-xs font-bold px-2 py-1 whitespace-nowrap"
            style={{
              background: "rgba(5,8,20,0.75)",
              border: "1px solid rgba(74,158,255,0.4)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            {label.name}
          </div>
        </div>
      ))}

      {/* ─── Multiplayer join/leave notification ─────────────────────────────── */}
      {mpNotification && gameStarted && (
        <div
          data-testid="mp-notification"
          className="fixed pointer-events-none select-none"
          style={{
            bottom: 76,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 70,
            padding: "8px 18px",
            borderRadius: 12,
            background: "rgba(5,8,20,0.82)",
            border: "1px solid rgba(74,158,255,0.35)",
            backdropFilter: "blur(12px)",
            color: "rgba(255,255,255,0.85)",
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          🌍 {mpNotification}
        </div>
      )}

      {/* ─── Online players panel (bottom-left) ──────────────────────────────── */}
      {gameStarted && onlinePlayers.length > 0 && (
        <div
          data-testid="online-players-panel"
          className="fixed pointer-events-none select-none"
          style={{
            bottom: 20,
            left: 20,
            zIndex: 60,
            padding: "8px 12px",
            borderRadius: 12,
            background: "rgba(5,8,20,0.72)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            minWidth: 120,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Online ({onlinePlayers.length + 1})
          </div>
          {/* Current player */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 3,
              fontSize: 11,
              color: "rgba(107,255,138,0.9)",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "rgba(107,255,138,0.9)",
                flexShrink: 0,
              }}
            />
            {playerName} (já)
          </div>
          {/* Remote players */}
          {onlinePlayers.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 2,
                fontSize: 11,
                color: "rgba(255,255,255,0.65)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: `#${p.color.toString(16).padStart(6, "0")}`,
                  flexShrink: 0,
                }}
              />
              {p.name}
            </div>
          ))}
        </div>
      )}

      {/* ─── Chat panel ───────────────────────────────────────────────────────── */}
      {gameStarted && (
        <ChatPanel
          messages={chatMessages}
          onSend={(text) => sendChatRef.current?.(text)}
          isOpen={chatOpen}
          onOpen={() => {
            document.exitPointerLock();
            setChatOpen(true);
          }}
          onClose={() => {
            setChatOpen(false);
            lockPointer();
          }}
        />
      )}

      {/* ─── Sound mute button ─────────────────────────────────────────────── */}
      {gameStarted && (
        <button
          onClick={() => {
            const next = !isMuted;
            soundManager.setMuted(next);
            setIsMuted(next);
          }}
          title={isMuted ? "Zapnout zvuk" : "Vypnout zvuk"}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 60,
            width: 44,
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(5,8,20,0.72)",
            backdropFilter: "blur(12px)",
            color: "white",
            fontSize: 20,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            transition: "background 0.15s",
          }}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      )}

      {/* Intro overlay */}
      {showIntro && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
          }}
          onClick={lockPointer}
        >
          <div
            className="rounded-2xl text-center text-white max-w-lg w-full"
            style={{
              padding: "40px 40px 36px",
              background: "rgba(8,16,36,0.93)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 48px rgba(0,0,0,0.65)",
            }}
          >
            <div className="text-5xl" style={{ marginBottom: 14 }}>🌍</div>
            <h1 className="text-3xl font-bold" style={{ marginBottom: 8 }}>Open World</h1>
            <p className="text-gray-400 text-sm" style={{ marginBottom: 24 }}>
              Prozkoumej otevřený 3D svět s cyklem dne a noci
            </p>

            {/* Objectives grid */}
            <div
              className="rounded-xl text-left"
              style={{
                padding: "16px 20px",
                marginBottom: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="grid grid-cols-2 text-sm text-gray-300" style={{ gap: "12px 28px" }}>
                <div>🐑 Zažeň <strong className="text-white">{SHEEP_COUNT} ovcí</strong> do ohrady</div>
                <div>🌅 Dynaminký <strong className="text-white">den/noc</strong></div>
                <div>🌟 Sesbírej <strong className="text-yellow-300">{COIN_COUNT} mincí</strong></div>
                <div>🏚 Prozkoumej <strong className="text-white">ruiny</strong> a vesnici</div>
                <div>🦊 <strong className="text-orange-400">Bojuj s liškami</strong> [F] nebo drž klik</div>
                <div>💣 Znič <strong className="text-yellow-400">{CATAPULT_COUNT} katapultů</strong> — střílí kule!</div>
                <div>⚓ Najdi <strong className="text-white">maják</strong> na pobřeží</div>
                <div>🧱 <strong className="text-green-300">Stav budovy</strong> stiskni [B]</div>
                <div>⛏ <strong className="text-cyan-300">Tvaruj terén</strong> v stavění [T]</div>
                <div>🐑 <strong className="text-blue-300">[E]</strong> vstoupit do těla ovce</div>
                <div>📷 <strong className="text-yellow-300">[V]</strong> přepnout 1./3. osobu</div>
                <div>🏊 <strong className="text-blue-400">Plav ve vodě</strong> — zpomaluje pohyb</div>
                <div>⛵ Najdi <strong className="text-sky-300">loď</strong> na pobřeží [E] nastoupit</div>
                <div>✈️ Najdi <strong className="text-green-300">letiště</strong> — nastoupit a létat [E]</div>
              </div>
            </div>

            {/* Controls */}
            <div
              className="rounded-xl text-xs text-gray-500"
              style={{
                padding: "14px 20px",
                marginBottom: 24,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {IS_MOBILE ? (
                <>
                  <div className="flex gap-6 justify-center flex-wrap">
                    <span>🕹 <strong className="text-gray-300">Joystick vlevo</strong> – pohyb</span>
                    <span>👆 <strong className="text-gray-300">Táhni vpravo</strong> – pohled</span>
                  </div>
                  <div className="flex gap-6 justify-center flex-wrap">
                    <span>↑ <strong className="text-green-300">Zelené</strong> – skok</span>
                    <span>⚔ <strong className="text-red-400">Červené</strong> – útok</span>
                    <span>E <strong className="text-blue-400">Modré</strong> – interakce</span>
                    <span>💨 <strong className="text-yellow-400">Žluté</strong> – sprint</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-6 justify-center flex-wrap">
                    <span>🕹 <strong className="text-gray-300">WASD</strong> – pohyb</span>
                    <span>🖱 <strong className="text-gray-300">Myš</strong> – pohled</span>
                    <span>⬆ <strong className="text-gray-300">Mezerník</strong> – skok</span>
                    <span>💨 <strong className="text-gray-300">Shift</strong> – sprint</span>
                  </div>
                  <div className="flex gap-6 justify-center flex-wrap">
                    <span>⚔️ <strong className="text-gray-300">[F]/Drž klik</strong> – útok</span>
                    <span>🐑 <strong className="text-blue-300">[E]</strong> – vstoupit do ovce</span>
                    <span>⏸ <strong className="text-gray-300">Esc</strong> – pauza</span>
                    <span>🧱 <strong className="text-green-400">[B]</strong> – stavění</span>
                  </div>
                  <div className="flex gap-6 justify-center flex-wrap">
                    <span>⛏ <strong className="text-cyan-400">[T]</strong> – terén (v stavění)</span>
                    <span>📷 <strong className="text-yellow-400">[V]</strong> – přepnout 1./3. osobu</span>
                    <span>💡 napiš <strong className="text-purple-400">IMPLEMENT</strong> – návrh</span>
                  </div>
                </>
              )}
            </div>

            <button
              className="bg-green-600 hover:bg-green-500 transition-colors text-white font-bold rounded-xl text-lg w-full"
              style={{ padding: "14px 32px" }}
              onClick={(e) => {
                e.stopPropagation();
                setShowIntro(false);
                setShowWeaponSelect(true);
              }}
            >
              Hrát!
            </button>
          </div>
        </div>
      )}

      {/* Weapon selection overlay */}
      {showWeaponSelect && (
        <WeaponSelect
          onConfirm={(weapon) => {
            setSelectedWeapon(weapon);
            selectedWeaponRef.current = weapon;
            swapWeaponMesh(weapon);
            setShowWeaponSelect(false);
            if (IS_MOBILE) {
              startMobileGame();
            } else {
              lockPointer();
            }
          }}
        />
      )}

      {/* ═══════════════ CENTER — Airplane boarding prompt ═══════════════ */}
      {nearAirplanePrompt && !onAirplane && !onBoat && !onRocket && !isPossessed && gameState.isLocked && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm animate-pulse"
            style={{
              padding: "10px 24px",
              background: "rgba(10,40,0,0.92)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(100,220,50,0.50)",
              boxShadow: "0 0 24px rgba(80,200,30,0.45)",
            }}
          >
            ✈️ [E] Nastoupit do letadla
          </div>
        </div>
      )}

      {/* ═══════════════ CENTER TOP — On-airplane active banner ═══════════════ */}
      {onAirplane && gameState.isLocked && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl text-white font-bold text-sm"
            style={{
              padding: "10px 28px",
              background: "rgba(5,30,5,0.93)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(100,220,50,0.40)",
              boxShadow: "0 0 22px rgba(80,200,30,0.35)",
            }}
          >
            ✈️ Letadlo&nbsp;·&nbsp;
            <span style={{ color: "#86efac" }}>W Plyn · S/X Výška · A/D Zatočit · Shift Turbo · [E] Vyskočit</span>
          </div>
        </div>
      )}

      {/* Mobile virtual controls — only rendered on touch devices */}
      {IS_MOBILE && gameStarted && (
        <MobileControls
          keysRef={keysRef}
          yawRef={yawRef}
          pitchRef={pitchRef}
          onAttack={() => doAttack()}
          onInteract={() => {
            // Simulate the E-key action by dispatching a synthetic keyboard event
            window.dispatchEvent(
              new KeyboardEvent("keydown", { code: "KeyE", bubbles: true })
            );
            window.dispatchEvent(
              new KeyboardEvent("keyup", { code: "KeyE", bubbles: true })
            );
          }}
          onChatOpen={() => setChatOpen(true)}
          visible={true}
        />
      )}
    </div>
  );
}
