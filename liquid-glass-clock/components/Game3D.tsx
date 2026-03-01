"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
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
  type SheepMeshParts,
  type RuinsResult,
} from "@/lib/meshBuilders";
import type { SheepData, FoxData, CoinData, BulletData, CatapultData, CannonballData, ImpactEffect, GameState, WeaponType, BloodParticle } from "@/lib/gameTypes";
import { WEAPON_CONFIGS } from "@/lib/gameTypes";
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

// ─── Constants ──────────────────────────────────────────────────────────────
const PLAYER_HEIGHT = 1.8;
const MOVE_SPEED = 6;
const SPRINT_SPEED = 12;
const GRAVITY = -25;
const JUMP_FORCE = 10;
const SHEEP_COUNT = 200;
const FOX_COUNT = 12;
const COIN_COUNT = 35;
const TREE_COUNT = 180;
const BUSH_COUNT = 220;
const ROCK_COUNT = 90;
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
const FOX_ATTACK_DAMAGE = 9; // per second of direct contact
const FOX_ATTACK_RANGE = 2.5;
const FOX_PLAYER_CHASE_RADIUS = 22; // foxes chase player if this close

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

// ─── Possession Constants ─────────────────────────────────────────────────────
const POSSESS_RADIUS = 3.5; // units — show [E] prompt within this distance
const POSSESS_CAM_HEIGHT = 0.9; // camera height above sheep mesh origin when possessed

// ─── Lighthouse Constants ─────────────────────────────────────────────────────
const LIGHTHOUSE_X = -95;       // world X coordinate — accessible northwest coastal rise
const LIGHTHOUSE_Z = 85;        // world Z coordinate — within playable boundary (±123.5)

// ─── Boat Constants ───────────────────────────────────────────────────────────
const BOAT_BOARD_RADIUS = 5;    // units — show [E] board prompt within this distance
const BOAT_SPEED = 8;           // units/second when sailing
const BOAT_CAM_HEIGHT = 2.6;    // camera height above waterline when on boat

// ─── Swim Constants ───────────────────────────────────────────────────────────
const SWIM_SPEED = 5.5;         // units/second when swimming in water
const DIVE_SPEED = 5.0;         // units/second when actively diving down (Ctrl)
const SWIM_RISE_SPEED = 6.0;    // units/second when actively swimming up (Space)
const SWIM_BUOYANCY = 5.0;      // upward drift speed per second (natural buoyancy when submerged)

// ─── Third-person Camera Constants ───────────────────────────────────────────
const TP_DISTANCE = 6;   // camera distance behind player in 3rd-person view
const TP_HEIGHT   = 2.5; // camera height above player in 3rd-person view

// ─── Weather Constants ────────────────────────────────────────────────────────
const RAIN_DROP_COUNT = 4500;       // number of rain particles in the scene
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

  // ─── Blood Particle Refs ──────────────────────────────────────────────────────
  const bloodParticlesRef = useRef<BloodParticle[]>([]);

  // ─── Sound Refs ─────────────────────────────────────────────────────────────
  const footstepTimerRef = useRef(0);
  const foxGrowlCooldownRef = useRef(0);
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
  const sculptIndicatorRef = useRef<THREE.Mesh | null>(null);
  const buildRaycasterRef = useRef(new THREE.Raycaster());

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
  const [nearSheepPrompt, setNearSheepPrompt] = useState(false);
  const [isPossessed, setIsPossessed] = useState(false);
  const [nearBoatPrompt, setNearBoatPrompt] = useState(false);
  const [onBoat, setOnBoat] = useState(false);

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
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
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
  const doAttack = useCallback(() => {
    if (!isLockedRef.current) return;
    if (playerAttackCooldownRef.current > 0) return;
    if (!cameraRef.current || !sceneRef.current) return;

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

      bulletsRef.current.push({
        mesh: projectileMesh,
        velocity: forward.clone().multiplyScalar(weaponCfg.bulletSpeed),
        lifetime: BULLET_LIFETIME,
        useGravity: isBow,
      });
    }

    // ── Melee hit (sword always; ranged weapons also hit if close enough) ───
    const playerPos = cam.position;
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

    // ── Melee hit on sheep ───────────────────────────────────────────────────
    // Sheep can be hit with any weapon at melee range (same range as fox check)
    if (!sceneRef.current) return;
    {
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

    // Smooth terrain color gradient: deep water → beach → grass → highland → rock
    const lerpC = (a: number[], b: number[], t: number) => {
      const tc = Math.max(0, Math.min(1, t));
      return [a[0] + (b[0] - a[0]) * tc, a[1] + (b[1] - a[1]) * tc, a[2] + (b[2] - a[2]) * tc];
    };
    const deepWater   = [0.12, 0.22, 0.50];
    const shallowWater= [0.22, 0.44, 0.68];
    const sand        = [0.74, 0.68, 0.44];
    const brightGrass = [0.40, 0.68, 0.22];
    const midGrass    = [0.30, 0.54, 0.17];
    const darkGrass   = [0.23, 0.43, 0.13];
    const rockBrown   = [0.50, 0.42, 0.30];
    const rockGray    = [0.62, 0.59, 0.56];

    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      let col: number[];
      if (y < -3)        col = deepWater;
      else if (y < -0.5) col = lerpC(deepWater, shallowWater, (y + 3) / 2.5);
      else if (y < 0.4)  col = lerpC(shallowWater, sand, (y + 0.5) / 0.9);
      else if (y < 2.5)  col = lerpC(sand, brightGrass, (y - 0.4) / 2.1);
      else if (y < 7)    col = lerpC(brightGrass, midGrass, (y - 2.5) / 4.5);
      else if (y < 17)   col = lerpC(midGrass, darkGrass, (y - 7) / 10);
      else if (y < 28)   col = lerpC(darkGrass, rockBrown, (y - 17) / 11);
      else               col = lerpC(rockBrown, rockGray, Math.min(1, (y - 28) / 12));
      colors[i * 3] = col[0];
      colors[i * 3 + 1] = col[1];
      colors[i * 3 + 2] = col[2];
    }
    terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);
    terrainMeshRef.current = terrain;

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
      // Realistic grass: each blade uses a quadratic bezier curve baked into
      // vertex positions, 3 planes with random Y-rotation (120° apart) for
      // full volumetric appearance from all camera angles, true pointed tip,
      // and 9 height bands for ultra-smooth curvature. Different cluster archetypes
      // (short tuft / mixed meadow / tall reed) add habitat variety. A 4th plane
      // is added to tall blades for a richer silhouette from all camera angles.
      // Use a reduced count in test environments to keep memory within limits.
      const GRASS_COUNT = process.env.NODE_ENV === "test" ? 2000 : 60000;
      const BLADE_H_BASE = 0.76;   // slightly taller for lush appearance
      const BLADE_W_BASE = 0.086;  // narrower base for more realistic slender blades
      let gSeed = 7391;
      const gRng = () => {
        gSeed = (gSeed * 1664525 + 1013904223) & 0xffffffff;
        return (gSeed >>> 0) / 0xffffffff;
      };
      // Spatially-coherent hash: nearby positions return similar values,
      // creating smooth patches of colour variation across the terrain.
      const posHash = (x: number, z: number): number => {
        const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
        return s - Math.floor(s);
      };

      const gPos: number[] = [];
      const gHeightFactor: number[] = [];
      const gWindPhase: number[] = [];
      const gColor: number[] = [];
      // Per-blade lean direction (normalised XZ) used in shader for directional wind
      const gLeanDir: number[] = [];
      const gWindStr: number[] = [];

      const CLUSTER_RADIUS = 0.65;  // tighter clusters for denser appearance
      const BLADES_MIN = 11;        // at least 11 blades per cluster
      const BLADES_MAX = 22;        // up to 22 for very dense tufts
      // Height band t-values: 9 bands give 8 regular quads + 1 tip triangle per plane.
      // Dense at base (short segments) for accurate root curvature, spaced wider
      // toward tip where the bezier curve is more linear — maximises smoothness
      // at the most visually prominent part (the bend). Extra bands add detail to
      // the mid-blade curve which is where the natural drape is most visible.
      const H_LEVELS = [0, 0.04, 0.11, 0.20, 0.31, 0.44, 0.58, 0.72, 0.85, 0.94, 1.0];
      let placed = 0;
      let tries = 0;

      while (placed < GRASS_COUNT && tries < GRASS_COUNT * 8) {
        tries++;
        const cx = (gRng() - 0.5) * (WORLD_SIZE * 0.85);
        const cz = (gRng() - 0.5) * (WORLD_SIZE * 0.85);
        // Use sampled height (bilinear from mesh grid) so blades sit on the
        // visual surface rather than the raw noise value
        const cy = getTerrainHeightSampled(cx, cz);
        if (cy < 0.3 || cy > 14) continue; // green terrain zones

        const clusterTypeRoll = gRng();
        const isValley = cy < 3.5;
        const isHigh   = cy > 8;
        const bladesInCluster = Math.floor(
          BLADES_MIN + gRng() * (BLADES_MAX - BLADES_MIN + 1)
        );
        const clusterPhase = cx * 0.48 + cz * 0.73;
        // Larger grid cells (14 world units) → broader colour patches, more natural biome look
        const pH = posHash(Math.floor(cx / 14), Math.floor(cz / 14));
        // Secondary fine-grained hash for within-patch micro-variation
        const pHFine = posHash(Math.floor(cx / 3.5), Math.floor(cz / 3.5));

        for (let b = 0; b < bladesInCluster && placed < GRASS_COUNT; b++) {
          const angle = gRng() * Math.PI * 2;
          const rr = Math.sqrt(gRng()) * CLUSTER_RADIUS;
          const wx = cx + Math.cos(angle) * rr;
          const wz = cz + Math.sin(angle) * rr;
          const wy = getTerrainHeight(wx, wz);
          if (wy < 0.2) continue;

          // ── Blade size + wind stiffness ──────────────────────────────────
          let hScale: number, wScale: number, windStr: number;
          if (clusterTypeRoll < 0.20) {
            hScale = 0.28 + gRng() * 0.30;
            wScale = 0.85 + gRng() * 0.55;
            windStr = 0.45 + gRng() * 0.30;
          } else if (clusterTypeRoll < 0.78) {
            const tR = gRng();
            if (tR < 0.30) {
              hScale = 0.42 + gRng() * 0.32;
              wScale = 0.72 + gRng() * 0.45;
              windStr = 0.55 + gRng() * 0.30;
            } else if (tR < 0.82) {
              hScale = 0.68 + gRng() * 0.78;
              wScale = 0.50 + gRng() * 0.55;
              windStr = 0.80 + gRng() * 0.38;
            } else {
              hScale = 1.35 + gRng() * 0.80;
              wScale = 0.30 + gRng() * 0.30;
              windStr = 1.25 + gRng() * 0.45;
            }
          } else {
            hScale = 1.25 + gRng() * 0.95;
            wScale = 0.28 + gRng() * 0.32;
            windStr = 1.30 + gRng() * 0.45;
          }
          if (isHigh)   { hScale *= 0.82; windStr *= 0.65; }
          if (isValley) { hScale *= 1.12; windStr *= 1.10; }

          const h = BLADE_H_BASE * hScale;
          const w = BLADE_W_BASE * wScale;

          // Static lean (persistent wind bias) + natural random lean
          const windLean = 0.055;
          const tiltX = (gRng() - 0.5) * 0.28 + windLean;
          const tiltZ = (gRng() - 0.5) * 0.28;
          // Arc bow: mid-point control offset for the quadratic bezier
          const bowX = (gRng() - 0.5) * 0.20;
          const bowZ = (gRng() - 0.5) * 0.20;
          const phase = clusterPhase + (gRng() - 0.5) * 0.45;

          // Lean direction (normalised XZ) stored per-vertex for shader wind
          const leanLen = Math.sqrt(tiltX * tiltX + tiltZ * tiltZ) + 0.001;
          const leanNX = tiltX / leanLen;
          const leanNZ = tiltZ / leanLen;

          // ── Colour: 6 archetypes with terrain-zone + patch-hash ──────────
          // pH drives the dominant archetype across large 14u patches so you
          // see coherent biome zones (meadow, dry hillside, lush valley).
          // pHFine adds micro-variety within each patch so adjacent blades
          // aren't identical — mimics real multi-species sward mixing.
          const colorRoll = gRng();
          const lushBoost = isValley ? 0.18 : 0.0;
          const dryBoost  = isHigh   ? 0.18 : 0.0;
          // Patch-level archetype bias: whole patches lean dry or lush
          const patchBias = (pH - 0.5) * 0.16;
          let greenV: number, baseR: number, tipR: number, blueV: number;
          if (colorRoll < 0.05 + dryBoost + patchBias) {
            // Straw / bleached dry — completely sun-dried
            greenV = 0.35 + gRng() * 0.12 + pHFine * 0.06;
            baseR  = 0.30 + gRng() * 0.10;
            tipR   = 0.58 + gRng() * 0.14;
            blueV  = 0.02 + pHFine * 0.01;
          } else if (colorRoll < 0.13 + dryBoost + patchBias) {
            // Autumn rust — reddish-orange tips, warm dead-leaf base
            greenV = 0.30 + gRng() * 0.14 + pHFine * 0.05;
            baseR  = 0.24 + gRng() * 0.09;
            tipR   = 0.62 + gRng() * 0.16;
            blueV  = 0.01 + pHFine * 0.01;
          } else if (colorRoll < 0.24 + dryBoost + patchBias) {
            // Yellowish / olive — dry but still living
            greenV = 0.50 + gRng() * 0.14 + pHFine * 0.06;
            baseR  = 0.18 + gRng() * 0.08;
            tipR   = 0.36 + gRng() * 0.12;
            blueV  = 0.03 + pHFine * 0.02;
          } else if (colorRoll < 0.55 + lushBoost - patchBias) {
            // Bright fresh green — young vigorous growth
            greenV = 0.65 + gRng() * 0.16 + pHFine * 0.07;
            baseR  = 0.05 + gRng() * 0.06;
            tipR   = 0.14 + gRng() * 0.09;
            blueV  = 0.04 + gRng() * 0.04 + pHFine * 0.02;
          } else if (colorRoll < 0.82 + lushBoost - patchBias) {
            // Lush dark green — mature shaded grass
            greenV = 0.46 + gRng() * 0.12 + pHFine * 0.06;
            baseR  = 0.04 + gRng() * 0.04;
            tipR   = 0.12 + gRng() * 0.06;
            blueV  = 0.06 + gRng() * 0.03 + pHFine * 0.02;
          } else {
            // Blue-green — cool shaded/wet meadow near water
            greenV = 0.52 + gRng() * 0.13 + pHFine * 0.06;
            baseR  = 0.03 + gRng() * 0.04;
            tipR   = 0.09 + gRng() * 0.06;
            blueV  = 0.16 + gRng() * 0.09 + pHFine * 0.03;
          }

          // ── Geometry: 3 planes at random Y-rotation (120° apart) ─────────
          // Bezier curve baked into vertex positions: blade centre follows
          // B(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
          //   P0=(0,0) (root), P1=(bowX,bowZ) (ctrl), P2=(tiltX,tiltZ) (tip)
          const rotY = gRng() * Math.PI * 2;

          const pushPlane = (planeAngle: number) => {
            const ca = Math.cos(planeAngle);
            const sa = Math.sin(planeAngle);

            for (let seg = 0; seg < H_LEVELS.length - 1; seg++) {
              const t0 = H_LEVELS[seg];
              const t1 = H_LEVELS[seg + 1];
              const isTip = seg === H_LEVELS.length - 2;

              // Bezier centre at each height level
              const cx0 = 2 * (1 - t0) * t0 * bowX + t0 * t0 * tiltX;
              const cz0 = 2 * (1 - t0) * t0 * bowZ + t0 * t0 * tiltZ;
              const cx1 = 2 * (1 - t1) * t1 * bowX + t1 * t1 * tiltX;
              const cz1 = 2 * (1 - t1) * t1 * bowZ + t1 * t1 * tiltZ;

              // Half-width: wide at base, tapers sharply toward tip.
              // Power 0.58 gives a more concave taper (fast-then-slow) matching
              // real grass blades that stay wide through mid-section then pinch at tip.
              // Extra root boost (1.5× multiplier) creates thick realistic base.
              const rootBoost = t0 < 0.22 ? (1.0 + (0.22 - t0) * 1.5) : 1.0;
              const hw0 = (w / 2) * Math.pow(1 - t0, 0.58) * rootBoost;
              const rootBoost1 = t1 < 0.22 ? (1.0 + (0.22 - t1) * 1.5) : 1.0;
              const hw1 = (w / 2) * Math.pow(1 - t1, 0.58) * rootBoost1;

              // World-space vertex positions (perpendicular to plane direction)
              const lx0 = wx + cx0 - hw0 * ca, lz0 = wz + cz0 - hw0 * sa;
              const rx0 = wx + cx0 + hw0 * ca, rz0 = wz + cz0 + hw0 * sa;
              const y0  = wy + h * t0;
              const lx1 = wx + cx1 - hw1 * ca, lz1 = wz + cz1 - hw1 * sa;
              const rx1 = wx + cx1 + hw1 * ca, rz1 = wz + cz1 + hw1 * sa;
              const y1  = wy + h * t1;

              const pushVert = (x: number, y: number, z: number, hf: number) => {
                gPos.push(x, y, z);
                gHeightFactor.push(hf);
                gWindPhase.push(phase);
                gWindStr.push(windStr);
                gLeanDir.push(leanNX, leanNZ);
                // Root zone (hf < 0.20): very dark — soil moisture, deep AO, dead thatch.
                //   The very base (hf < 0.05) goes almost black-brown matching real grass.
                // Mid blade: full species color, slight brightening at mid height.
                // Tip (hf > 0.68): lighter, yellowed, bleached by sun — chlorophyll breaks down.
                const rootMask  = Math.max(0, 1.0 - hf / 0.20);          // 1 at root, 0 above 0.2
                const deepRoot  = Math.max(0, 1.0 - hf / 0.06);           // strong only at soil line
                const tipMask   = Math.max(0, (hf - 0.68) / 0.32);        // 0 below 0.68, 1 at tip
                const midBright = Math.max(0, (hf - 0.30) * (1.0 - hf) * 2.8); // mid-blade highlight
                const midGreen  = 0.22 + hf * 0.78;                       // ramp base→full green
                // Red: suppressed at root (dark soil), rises at tip (dried tip)
                const cr = baseR * (1.0 - rootMask * 0.72) + (tipR - baseR) * tipMask
                          + rootMask * 0.03 + deepRoot * 0.02; // near-black soil tint
                // Green: very dark at root (thatch/soil), full color mid-blade, tip fade
                const cg = greenV * midGreen * (1.0 - rootMask * 0.88)
                          + tipMask * greenV * 0.24    // tip bleach-yellow (losing green)
                          + midBright * greenV * 0.08; // subtle mid-blade chlorophyll glow
                // Blue: cool blue-grey at base (soil moisture + shade), warm at tip
                const cb = blueV * (1.0 - hf * 0.60) + hf * 0.03 + rootMask * 0.015 + deepRoot * 0.01;
                gColor.push(cr, cg, cb);
              };

              if (!isTip) {
                // Regular quad (two triangles)
                pushVert(lx0, y0, lz0, t0);
                pushVert(rx0, y0, rz0, t0);
                pushVert(lx1, y1, lz1, t1);
                pushVert(rx0, y0, rz0, t0);
                pushVert(rx1, y1, rz1, t1);
                pushVert(lx1, y1, lz1, t1);
              } else {
                // Tip: single triangle converging to a sharp point
                const tipX = wx + cx1, tipZ = wz + cz1;
                pushVert(lx0, y0, lz0, t0);
                pushVert(rx0, y0, rz0, t0);
                pushVert(tipX, y1, tipZ, t1);
              }
            }
          };

          // Three planes spaced ~120° apart with slight asymmetric jitter —
          // breaks the too-perfect star look and feels more organic.
          // Tall blades (hScale > 1.25) get a 4th plane at ~90° offset so the
          // silhouette looks full from all camera angles, not just head-on.
          const planeJitter = (gRng() - 0.5) * 0.28;
          pushPlane(rotY);
          pushPlane(rotY + Math.PI / 3 * 2 + planeJitter);
          pushPlane(rotY + Math.PI / 3 * 4 - planeJitter * 0.5);
          // 4th plane only for tall reeds/long grass — adds volumetric depth
          if (hScale > 1.25) {
            pushPlane(rotY + Math.PI / 2 + planeJitter * 0.3);
          }

          placed++;
        }
      }

      const grassGeo = new THREE.BufferGeometry();
      grassGeo.setAttribute("position",     new THREE.Float32BufferAttribute(gPos, 3));
      grassGeo.setAttribute("heightFactor", new THREE.Float32BufferAttribute(gHeightFactor, 1));
      grassGeo.setAttribute("windPhase",    new THREE.Float32BufferAttribute(gWindPhase, 1));
      grassGeo.setAttribute("grassColor",   new THREE.Float32BufferAttribute(gColor, 3));
      grassGeo.setAttribute("leanDir",      new THREE.Float32BufferAttribute(gLeanDir, 2));
      grassGeo.setAttribute("windStr",      new THREE.Float32BufferAttribute(gWindStr, 1));

      const grassMat = new THREE.ShaderMaterial({
        uniforms: {
          time:          { value: 0.0 },
          sunDir:        { value: new THREE.Vector3(0.5, 0.8, 0.3) },
          sunIntensity:  { value: 1.0 },
          moonIntensity: { value: 0.0 },
          dayFraction:   { value: 0.5 },
          // Global wind direction (normalised XZ); slowly rotates over time
          windDir:       { value: new THREE.Vector2(0.82, 0.38) },
          // LOD: camera world position for distance-based animation reduction
          cameraPos:     { value: new THREE.Vector3() },
        },
        vertexShader: `
          attribute float heightFactor;
          attribute float windPhase;
          attribute vec3  grassColor;
          attribute vec2  leanDir;
          attribute float windStr;
          uniform float time;
          uniform vec3  sunDir;
          uniform float sunIntensity;
          uniform float moonIntensity;
          uniform float dayFraction;
          uniform vec2  windDir;
          uniform vec3  cameraPos;
          varying vec3  vColor;
          varying float vHeightFactor;
          varying float vWindBend;

          void main() {
            vec3 pos = position;

            // ── Wind: multi-layer physically-inspired model ──────────────────
            // Power-5 curve: roots absolutely anchored, displacement increases
            // steeply only above mid-blade — more realistic leaf drape physics.
            float hf2 = heightFactor * heightFactor;
            float hf3 = hf2 * heightFactor;
            float curve    = hf2 * hf3;                         // power-5: very sharp root lock
            float curveMid = hf2 * (3.0 - 2.0 * heightFactor); // smooth-step mid flex

            // Primary wave — gentle rhythmic sway along wind direction
            float windPrimary = sin(windPhase + time * 1.80) * 0.55
                              + cos(windPhase * 1.27 + time * 1.25) * 0.38;
            // Secondary counter-sway (natural figure-8 oscillation)
            float windSecond  = sin(windPhase * 0.73 + time * 2.45) * 0.22
                              + cos(windPhase * 0.91 + time * 1.97) * 0.15;
            // Slow rolling gust front (large coherent field)
            float gustFront   = sin(time * 0.31 + windPhase * 0.035) * 0.68
                              + cos(time * 0.14 + windPhase * 0.018) * 0.36;
            // High-frequency tip flutter (leaf membrane vibration)
            float windFlutter = sin(windPhase * 2.7 + time * 5.2) * 0.16
                              + cos(windPhase * 1.9 + time * 6.8) * 0.10;
            // Micro-turbulence (air pocket churn)
            float turbulence  = sin(windPhase * 6.1 + time * 8.4) * 0.07
                              + cos(windPhase * 4.3 + time * 10.7) * 0.04;
            // Gust impulse — sharp periodic surge (non-sinusoidal via squaring)
            float gustImpulse = max(0.0, sin(time * 0.22 + windPhase * 0.008)) * 0.50;
            gustImpulse = gustImpulse * gustImpulse; // sharpen the gust peak

            // ── Traveling gust wave (physically-correct spatial sweep) ───────
            // Simulates a gust front that visibly moves across the field along
            // the wind direction. Uses world-space XZ position so the phase is
            // spatially coherent — blades near each other sway together.
            float travelPhase = dot(position.xz, windDir) * 0.15 - time * 0.78;
            float gustTravel  = pow(max(0.0, sin(travelPhase)), 1.3) * 0.85
                              + pow(max(0.0, sin(travelPhase * 0.52 + 2.1)), 2.0) * 0.42;
            // Second slower traveling wave for gentle background roll
            float travelSlow  = sin(travelPhase * 0.38 - time * 0.18) * 0.32;

            // ── Spatial wind intensity: calmer/gustier zones across the field ─
            // Blades near each other share similar exposure — openings vs shelter.
            float spatialGust = sin(position.x * 0.018 + time * 0.11) * 0.5 + 0.5
                              + cos(position.z * 0.022 - time * 0.08) * 0.25;
            spatialGust = 0.72 + spatialGust * 0.28; // range 0.72 – 1.0

            float totalWind = (windPrimary + windSecond * 0.6 + gustFront
                              + windFlutter + turbulence + gustImpulse
                              + gustTravel + travelSlow * 0.5) * windStr * spatialGust;

            // ── Cross-wind: perpendicular oscillation for figure-8 motion ────
            vec2 crossDir = vec2(-windDir.y, windDir.x);
            float crossWind = sin(windPhase * 0.88 + time * 1.55) * 0.32
                            + cos(windPhase * 0.59 + time * 2.20) * 0.18
                            + sin(travelPhase * 0.71 + 1.4) * 0.20;

            // ── LOD: distance-based wind reduction ───────────────────────────
            // Grass far from the camera animates less (standard 3D game LOD trick).
            // Smooth fade: full animation <60 units, none >120 units.
            float camDist = length(position.xz - cameraPos.xz);
            float lodFactor = 1.0 - smoothstep(60.0, 120.0, camDist);
            totalWind *= lodFactor;
            crossWind *= lodFactor;

            // Wind displacement: main along wind dir, cross-component adds twist
            // curveMid: slight mid-blade pre-flex before the tip swings fully
            float windMag   = totalWind * curve * 0.22;
            float preFlex   = totalWind * curveMid * 0.06; // slight mid-blade bow
            float crossMag  = crossWind * curve * 0.24 * windStr;
            pos.x += (windMag + preFlex) * windDir.x + windMag * leanDir.x * 0.22
                   + crossMag * crossDir.x;
            pos.z += (windMag + preFlex) * windDir.y + windMag * leanDir.y * 0.22
                   + crossMag * crossDir.y;
            // Physical droop: blade compresses downward under wind load
            // More pronounced at the tip (power-5 curve) for realistic bending arc
            pos.y -= abs(totalWind) * curve * 0.038 + abs(preFlex) * 0.014
                   + abs(crossWind) * curve * 0.014 * windStr;

            // ── Lighting ────────────────────────────────────────────────────
            // Three-layer AO: deepest at soil line, brightens steeply through
            // root zone (thatch blocks light), smooth ramp into full exposure.
            float ao = 0.10 + heightFactor * 0.90;
            // Contact shadow: blades cluster densely near ground — strong occlusion
            float contactShadow = smoothstep(0.0, 0.25, heightFactor);
            ao *= 0.30 + 0.70 * contactShadow;
            // Narrow dark band at soil surface (root moisture + thatch shadow)
            ao *= 0.58 + 0.42 * smoothstep(0.0, 0.09, heightFactor);
            // Deep root near-black (below 3 cm): dead thatch and soil
            ao *= 0.65 + 0.35 * smoothstep(0.0, 0.04, heightFactor);

            // Green bounce-light from ground (GI approximation)
            // Stronger at low heights; slight warm-green hue of live soil
            vec3 bounce = vec3(0.018, 0.090, 0.010) * (1.0 - heightFactor * 0.72) * 0.85;

            // Sun diffuse — anisotropic wrap (blades are translucent, receive
            // light from all directions with slight wrap-around term)
            float sunFace = max(0.0, sunDir.y) * 0.35 + 0.65;

            // Time-of-day factors
            float goldenHour = smoothstep(0.18, 0.28, dayFraction)
                             * (1.0 - smoothstep(0.72, 0.82, dayFraction));
            float goldenTint = (1.0 - goldenHour) * 0.38;
            float nightFactor = max(0.0, 1.0 - goldenHour
                               - smoothstep(0.25, 0.50, dayFraction)
                               * smoothstep(0.75, 0.50, dayFraction));

            vec3 baseCol = grassColor * ao * sunFace * (sunIntensity * 0.86 + 0.14);
            baseCol += bounce;

            // Tip brightening: thin edges catch glancing sunlight (anisotropic)
            // Stronger on taller blades; slight warm tint at tip
            float tipSpec = hf3 * heightFactor * 0.20 * sunIntensity;
            baseCol += vec3(tipSpec * 0.40, tipSpec * 0.94, tipSpec * 0.14);

            // Subsurface translucency: warm yellow-green glow at mid-blade
            // Physically: sunlight transmits through thin chlorophyll-rich leaf membrane
            float sssVert = heightFactor * (1.0 - heightFactor) * 5.0 * 0.12 * sunIntensity;
            baseCol += vec3(sssVert * 0.55, sssVert * 1.10, sssVert * 0.05);

            // Fresnel-like rim brightening on blade edges at mid-to-upper height
            float rimEdge = smoothstep(0.28, 0.80, heightFactor) * 0.075 * sunIntensity;
            baseCol += vec3(rimEdge * 0.32, rimEdge, rimEdge * 0.20);

            // Specular glint: highlight on blade tips from direct sun (anisotropic approx)
            float specGlint = pow(max(0.0, sunDir.y), 3.0)
                            * pow(max(0.0, heightFactor), 7.0) * 0.11 * sunIntensity;
            baseCol += vec3(specGlint * 0.82, specGlint, specGlint * 0.38);

            // Golden-hour warm shift
            baseCol.r += goldenTint * heightFactor * 0.36 * sunIntensity;
            baseCol.g += goldenTint * heightFactor * 0.16 * sunIntensity;

            // Night: cool, desaturated, slightly blue-purple
            baseCol = mix(baseCol, vec3(0.05, 0.08, 0.15) * ao, nightFactor * 0.72);
            // Moonlight silvery sheen — slightly blue-white
            baseCol += vec3(0.038, 0.052, 0.095) * moonIntensity * (0.20 + heightFactor * 0.80);

            vColor = baseCol;
            vHeightFactor = heightFactor;
            // Encode both longitudinal and cross-wind for richer hash variety in fragment
            vWindBend = (abs(totalWind) + abs(crossWind) * 0.4) * windStr * 0.15;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3  vColor;
          varying float vHeightFactor;
          varying float vWindBend;
          uniform vec3  sunDir;
          uniform float sunIntensity;

          void main() {
            // Sharp alpha at the very tip for a convincing pointed silhouette.
            // Narrowed upper range (0.98 vs 1.0) so tip doesn't fully disappear
            // too early — keeps a visible point rather than a blunt end.
            float tipFade = smoothstep(0.76, 0.98, vHeightFactor);
            float alpha = 1.0 - tipFade * 0.94;

            // Root fade: smooth soil-merge. Slightly wider (0.06) so blades
            // aren't clipped too harshly at terrain intersections.
            float rootFade = smoothstep(0.0, 0.06, vHeightFactor);
            alpha *= rootFade;

            // Subsurface scattering: warm translucent chlorophyll glow.
            // sssBacklit: warm amber glow when blades are backlit (sun near horizon).
            // Gated by sunIntensity: no backlit glow when sun is below horizon at night.
            float sssBacklit = max(0.0, -sunDir.y + 0.35) * vHeightFactor * 0.62 * sunIntensity;
            // sssMid: mid-blade internal glow — chlorophyll transmits strongly 530–580 nm
            float sssMid = vHeightFactor * (1.0 - vHeightFactor) * 5.0 * 0.09;
            float sss = sssBacklit + sssMid * sunIntensity;
            // Warm yellow-green SSS: slightly more amber (realistic chlorophyll colour)
            vec3 sssCol = vec3(sss * 1.35, sss * 0.95, sss * 0.03);

            // Sky hemisphere light: blue sky contributes diffuse light to upper blade
            float skyHemi = pow(max(0.0, vHeightFactor), 2.5) * 0.10 * max(0.0, sunDir.y + 0.3);
            vec3 skyCol = vec3(skyHemi * 0.40, skyHemi * 0.88, skyHemi * 0.35);

            // Wind-catch rim: blades bent by wind expose their edge to sunlight
            float rimWind = vWindBend * pow(max(0.0, vHeightFactor), 2.2) * 0.055 * sunIntensity;

            // Anisotropic surface highlight: thin leaf cuticle has directional gloss.
            // The silky sheen is strongest on the upper half of sun-facing blades.
            float gloss = smoothstep(0.42, 0.86, vHeightFactor)
                        * pow(max(0.0, sunDir.y), 2.0)
                        * sunIntensity * 0.07;
            vec3 glossCol = vec3(gloss * 0.88, gloss, gloss * 0.52);

            // Wet-dew micro specular: small bright sparkle at blade tips in sunlight.
            // Two hash layers give different sparkle frequencies (near-tip vs mid).
            float dewHash  = fract(vWindBend * 47.3 + vHeightFactor * 13.7);
            float dewHash2 = fract(vWindBend * 29.1 + vHeightFactor * 37.4);
            float dewSpec  = (step(0.962, dewHash) + step(0.978, dewHash2) * 0.5)
                           * pow(max(0.0, vHeightFactor), 3.5)
                           * max(0.0, sunDir.y) * sunIntensity * 0.22;
            // Pure white sparkle with slight warm tint
            vec3 dewCol = vec3(dewSpec * 0.96, dewSpec, dewSpec * 0.82);

            vec3 col = vColor + sssCol + glossCol + dewCol + skyCol
                     + vec3(rimWind * 0.52, rimWind * 1.0, rimWind * 0.20);

            gl_FragColor = vec4(col, alpha);
          }
        `,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.05,  // slightly higher to clip tiny alpha fragments
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

    // ── Input ─────────────────────────────────────────────────────────────────
    // ── Mouse click — attack OR build depending on current mode ───────────────
    const onMouseDown = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      if (e.button === 0) {
        if (buildModeRef.current === "build") {
          if (ghostMeshRef.current?.visible) {
            placeBlock(ghostMeshRef.current.position.clone());
          }
        } else if (buildModeRef.current === "explore") {
          isMouseHeldRef.current = true; // start auto-fire loop
          doAttack(); // fire immediately on first click
        }
        // sculpt mode: scroll wheel sculpts, left click does nothing extra
      } else if (e.button === 2 && buildModeRef.current !== "explore") {
        removeBlock();
      }
    };
    document.addEventListener("mousedown", onMouseDown);

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isMouseHeldRef.current = false;
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

      // F key attack (only in explore mode)
      if (e.type === "keydown" && e.code === "KeyF" && buildModeRef.current === "explore") {
        doAttack();
      }

      // E key: board/exit boat, OR possess/unpossess nearby sheep
      if (e.type === "keydown" && e.code === "KeyE") {
        if (onBoatRef.current) {
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

      // V key — toggle first/third-person camera (works in explore mode AND while possessing a sheep)
      if (e.type === "keydown" && e.code === "KeyV") {
        const newMode = cameraModeRef.current === "first" ? "third" : "first";
        cameraModeRef.current = newMode;
        setCameraMode(newMode);
        if (weaponMeshRef.current) {
          // Weapon hidden while possessed regardless of camera mode
          weaponMeshRef.current.visible = newMode === "first" && !possessedSheepRef.current;
        }
        if (playerBodyRef.current) {
          // Player body only shown in 3rd-person when NOT possessing a sheep
          playerBodyRef.current.visible = newMode === "third" && !possessedSheepRef.current;
        }
        // Snap camera back to eye-level when returning to first-person (explore mode only)
        if (newMode === "first" && cameraRef.current && !possessedSheepRef.current) {
          cameraRef.current.position.set(
            playerBodyPosRef.current.x,
            playerBodyPosRef.current.y + PLAYER_HEIGHT,
            playerBodyPosRef.current.z
          );
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
        setTimeout(() => chatInputRef.current?.focus(), 50);
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
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - prevTimeRef.current) / 1000, 0.05);
      prevTimeRef.current = now;
      elapsed += dt;

      // ── Sync player body position in first-person (always matches cam.position) ──
      if (cameraModeRef.current === "first" && cameraRef.current) {
        playerBodyPosRef.current.copy(cameraRef.current.position);
      }

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
      scene.background = skyColor;
      (scene.fog as THREE.FogExp2).color = skyColor;
      if (skyMeshRef.current) {
        (skyMeshRef.current.material as THREE.MeshBasicMaterial).color = skyColor;
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

        // Fog density (unless underwater which overrides separately)
        if (!isUnderwaterRef.current) {
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
        // LOD: pass camera world position so the shader can reduce wind at distance
        if (cameraRef.current) {
          gm.uniforms.cameraPos.value.copy(cameraRef.current.position);
        }
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

      // ── Flora (tree & bush foliage) wind sway ─────────────────────────────
      // LOD: only animate plants within 80 units of the camera (standard 3D game
      // practice — distant foliage motion is imperceptible at small screen size).
      const LOD_FLORA_DIST_SQ = 80 * 80;
      const camPosX = cameraRef.current ? cameraRef.current.position.x : 0;
      const camPosZ = cameraRef.current ? cameraRef.current.position.z : 0;
      floraRef.current.forEach((flora) => {
        const dx = flora.posX - camPosX;
        const dz = flora.posZ - camPosZ;
        if (dx * dx + dz * dz > LOD_FLORA_DIST_SQ) return;
        const t = elapsed * flora.windSpeed + flora.windPhase;
        // Gentle sinusoidal sway: X axis tilts forward/back, Z tilts side-to-side
        flora.foliageGroup.rotation.x = Math.sin(t) * flora.maxSway;
        flora.foliageGroup.rotation.z = Math.cos(t * 0.71) * flora.maxSway * 0.6;
      });

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

      // ── Player movement (only when NOT possessing an entity or on boat) ─────
      if (isLockedRef.current && !possessedSheepRef.current && !onBoatRef.current) {
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
        }
      });

      // ── Attack cooldown ────────────────────────────────────────────────────
      if (playerAttackCooldownRef.current > 0) {
        playerAttackCooldownRef.current = Math.max(0, playerAttackCooldownRef.current - dt);
      }

      // ── Auto-fire while left mouse button is held (explore mode only) ──────
      if (isMouseHeldRef.current && buildModeRef.current === "explore") {
        doAttack();
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
        // bowstring is pulled back as the bow reloads. drawProgress goes from
        // 0 (just fired / relaxed) to 1 (fully drawn / ready to shoot).
        if (wType === "bow") {
          const bowCooldown = WEAPON_CONFIGS["bow"].cooldown;
          const drawProgress = bowCooldown > 0
            ? 1 - Math.min(1, playerAttackCooldownRef.current / bowCooldown)
            : 1;

          const bowstringGroup = wep.getObjectByName("bowstring");
          if (bowstringGroup) {
            // Pull string back toward the archer (+Z in bow-local space)
            const pullZ = drawProgress * 0.028;
            bowstringGroup.position.z = pullZ;
            // Slightly pull string away from limb tips when drawn
            bowstringGroup.position.x = drawProgress * -0.006;
          }

          // Tilt bow slightly when fully drawn (aiming posture)
          wep.rotation.z = drawProgress * -0.06;
        }
      }

      // ── Bullet update ──────────────────────────────────────────────────────
      const toRemove: BulletData[] = [];
      bulletsRef.current.forEach((bullet) => {
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

        // Check fox collisions
        let bulletHit = false;
        for (const fox of foxListRef.current) {
          if (!fox.isAlive) continue;
          const dist = bullet.mesh.position.distanceTo(fox.mesh.position);
          if (dist < BULLET_HIT_RADIUS) {
            const dmg = WEAPON_CONFIGS[selectedWeaponRef.current].damage;
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
              const dmg = WEAPON_CONFIGS[selectedWeaponRef.current].damage;
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

        // Check sheep collisions (ranged weapons can also kill sheep)
        if (!bulletHit) {
          for (const sheep of sheepListRef.current) {
            if (!sheep.isAlive || sheep.isDying) continue;
            const dist = bullet.mesh.position.distanceTo(sheep.mesh.position);
            if (dist < BULLET_HIT_RADIUS * 1.2) {
              const dmg = WEAPON_CONFIGS[selectedWeaponRef.current].damage;
              sheep.hp = Math.max(0, sheep.hp - dmg);
              sheep.hitFlashTimer = 0.25;
              flashSheepMesh(sheep.mesh);
              soundManager.playFoxHit();
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
      let foxNear = false;
      let closestAliveFox: (typeof foxListRef.current)[0] | null = null;
      let closestAliveFoxDist = Infinity;

      foxListRef.current.forEach((fox) => {
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

        // Track nearest alive fox for HP display
        if (distToPlayer < closestAliveFoxDist) {
          closestAliveFoxDist = distToPlayer;
          closestAliveFox = fox;
        }

        // Fox chases player if nearby, otherwise hunts sheep
        const playerIsClose = distToPlayer < FOX_PLAYER_CHASE_RADIUS;

        const foxPrevX = fm.position.x;
        const foxPrevZ = fm.position.z;

        if (playerIsClose) {
          // Chase player
          const dx = playerPos.x - fm.position.x;
          const dz = playerPos.z - fm.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > FOX_ATTACK_RANGE) {
            fm.position.x += (dx / len) * FOX_SPEED * 1.1 * dt;
            fm.position.z += (dz / len) * FOX_SPEED * 1.1 * dt;
            fm.rotation.y = Math.atan2(-dz, dx);
          } else {
            // Attack player
            fox.attackCooldown -= dt;
            if (fox.attackCooldown <= 0) {
              fox.attackCooldown = 1.0;
              if (!gameOver) {
                playerHpRef.current = Math.max(0, playerHpRef.current - FOX_ATTACK_DAMAGE);
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
        } else {
          // Find closest sheep to hunt
          let closestDist = FOX_CHASE_RADIUS;
          let closestSheep: SheepData | null = null;
          sheepListRef.current.forEach((sheep) => {
            const d = fm.position.distanceTo(sheep.mesh.position);
            if (d < closestDist) {
              closestDist = d;
              closestSheep = sheep;
            }
          });

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
            if (closestDist < 8) {
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

        if (distToPlayer < 18) {
          foxNear = true;
        }
      });

      setFoxWarning(foxNear);

      // ── Fox growl (periodic when fox is chasing player) ─────────────────
      if (foxNear) {
        foxGrowlCooldownRef.current -= dt;
        if (foxGrowlCooldownRef.current <= 0) {
          soundManager.playFoxGrowl();
          foxGrowlCooldownRef.current = 3 + Math.random() * 3;
        }
      }

      // Update nearest fox HP display
      if (closestAliveFox && closestAliveFoxDist < 18) {
        const f = closestAliveFox as (typeof foxListRef.current)[0];
        setNearFoxHp({ hp: f.hp, maxHp: f.maxHp, name: "Liška" });
      } else {
        setNearFoxHp(null);
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

        // Check player collision
        if (!gameOver) {
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
        // Possessed sheep is controlled in the dedicated possession block — skip its AI
        if (sheep === possessedSheepRef.current) return;

        const s = sheep.mesh;

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

        const fleeingFromPlayer = dist < SHEEP_FLEE_RADIUS;
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
      const canvas = minimapRef.current;
      if (canvas && cameraRef.current) {
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
        attackReady: playerAttackCooldownRef.current <= 0,
      }));

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
      // Clean up any live bullets from the scene
      bulletsRef.current.forEach((b) => scene.remove(b.mesh));
      bulletsRef.current = [];
      // Clean up cannonballs and their shadow discs
      cannonballsRef.current.forEach((b) => { scene.remove(b.mesh); scene.remove(b.shadowMesh); });
      cannonballsRef.current = [];
      // Clean up impact effects
      impactEffectsRef.current.forEach((fx) => { scene.remove(fx.ring); fx.particles.forEach((p) => scene.remove(p)); });
      impactEffectsRef.current = [];
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
          if (isLockedRef.current) {
            // Attack only in explore mode; build mode is handled by onMouseDown
            if (buildModeRef.current === "explore") {
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

      {/* Attack effect popup */}
      {attackEffect && gameState.isLocked && (
        <div
          className="fixed top-1/2 left-1/2 pointer-events-none select-none"
          style={{ transform: "translate(-50%, -120px)", zIndex: 60 }}
        >
          <div
            className="font-bold text-2xl animate-bounce"
            style={{
              color: attackEffect === "Miss" ? "#9ca3af" : "#fbbf24",
              textShadow: "0 0 10px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.6)",
            }}
          >
            {attackEffect === "Miss" ? "Miss!" : attackEffect}
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

      {/* Pause overlay — shown when game started but pointer is unlocked (and not chatting) */}
      {gameStarted && !gameState.isLocked && !showIntro && !chatOpen && (
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
            <p className="text-gray-400 text-sm" style={{ marginBottom: 8 }}>Lišky nebo katapulty tě dostaly…</p>
            <p className="text-gray-500 text-xs" style={{ marginBottom: 4 }}>
              Porazil jsi <span className="text-orange-400 font-bold">{gameState.foxesDefeated}</span> lišek
            </p>
            {gameState.catapultsDefeated > 0 && (
              <p className="text-gray-500 text-xs" style={{ marginBottom: 28 }}>
                Zničil jsi <span className="font-bold" style={{ color: "#fbbf24" }}>{gameState.catapultsDefeated}</span> katapultů
              </p>
            )}
            {gameState.catapultsDefeated === 0 && <div style={{ marginBottom: 28 }} />}
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
        <div
          data-testid="chat-panel"
          style={{
            position: "fixed",
            bottom: chatMessages.length > 0 || chatOpen ? 20 : -200,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 65,
            width: 380,
            maxWidth: "90vw",
            transition: "bottom 0.3s ease",
            pointerEvents: chatOpen ? "auto" : "none",
          }}
        >
          {/* Chat message log */}
          {chatMessages.length > 0 && (
            <div
              style={{
                marginBottom: 6,
                maxHeight: 150,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {chatMessages.slice(-8).map((msg, i) => (
                <div
                  key={`${msg.ts}-${i}`}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "rgba(5,8,20,0.78)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    backdropFilter: "blur(8px)",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.88)",
                    display: "flex",
                    gap: 6,
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: `#${msg.color.toString(16).padStart(6, "0")}`,
                      flexShrink: 0,
                    }}
                  >
                    {msg.name}:
                  </span>
                  <span style={{ wordBreak: "break-word" }}>{msg.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Chat input (visible when chatOpen or game paused) */}
          {chatOpen && (
            <div style={{ display: "flex", gap: 6 }}>
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value.slice(0, 120))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const text = chatInput.trim();
                    if (text) sendChatRef.current?.(text);
                    setChatInput("");
                    setChatOpen(false);
                    lockPointer();
                  }
                  if (e.key === "Escape") {
                    setChatInput("");
                    setChatOpen(false);
                    lockPointer();
                  }
                }}
                placeholder="Zpráva… (Enter odešle, Esc zruší)"
                maxLength={120}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: "rgba(5,8,20,0.92)",
                  border: "1px solid rgba(74,158,255,0.5)",
                  color: "white",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>
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
            lockPointer();
          }}
        />
      )}
    </div>
  );
}
