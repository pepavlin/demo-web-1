"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
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
  buildWeaponMesh,
  type SheepMeshParts,
} from "@/lib/meshBuilders";
import type { SheepData, FoxData, CoinData, BulletData, GameState } from "@/lib/gameTypes";
import { soundManager } from "@/lib/soundManager";

// ─── Constants ──────────────────────────────────────────────────────────────
const PLAYER_HEIGHT = 1.8;
const MOVE_SPEED = 10;
const SPRINT_SPEED = 20;
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
const ATTACK_RANGE = 5;
const ATTACK_DAMAGE = 25;
const ATTACK_COOLDOWN = 0.65;
const FOX_ATTACK_DAMAGE = 9; // per second of direct contact
const FOX_ATTACK_RANGE = 2.5;
const FOX_PLAYER_CHASE_RADIUS = 22; // foxes chase player if this close

// ─── Bullet / Weapon Constants ────────────────────────────────────────────────
const BULLET_SPEED = 55;        // units per second
const BULLET_LIFETIME = 4;      // seconds before auto-despawn
const BULLET_HIT_RADIUS = 1.4;  // sphere radius for fox collision
// Weapon position in camera-local space (first-person)
const WEAPON_POS = new THREE.Vector3(0.24, -0.21, -0.48);

// ─── Possession Constants ─────────────────────────────────────────────────────
const POSSESS_RADIUS = 3.5; // units — show [E] prompt within this distance
const POSSESS_CAM_HEIGHT = 0.9; // camera height above sheep mesh origin when possessed

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

// ─── Volumetric Scattering Shader (Screen-Space Crepuscular Rays) ─────────────
// Based on NVIDIA GPU Gems 3 Ch.13 with the following physical improvements:
//
// 1. IGN JITTER (Jorge Jimenez, CoD:AW 2014): Per-pixel offset at ray start
//    eliminates the repeating "stripe" banding caused by uniform step sizes.
//
// 2. FBM FOG DENSITY: Fractal Brownian Motion noise sampled along the march
//    path simulates atmospheric density variation. Result: rays appear to
//    penetrate through shifting fog patches — brighter where fog is dense
//    (more scattering) and thinner where fog is sparse.
//
// 3. MIE PHASE FUNCTION (Henyey-Greenstein): Physical model for particle
//    forward-scattering. Rays near the sun (forward scatter, g≈0.76) are
//    significantly brighter, matching real crepuscular ray behaviour.
//    Screen-space approximation: distance from pixel to sun UV position.
//
// 4. ANIMATED DRIFT: FBM coordinate offset shifts slowly over time so fog
//    density variation evolves, giving rays a living, breathing quality.
const VolumetricScatteringShader = {
  uniforms: {
    tDiffuse:      { value: null as THREE.Texture | null },
    lightPosition: { value: new THREE.Vector2(0.5, 0.5) }, // sun UV [0..1]
    exposure:      { value: 0.12 },   // subtle base brightness (much lower than before)
    decay:         { value: 0.962 },  // slightly slower falloff for longer reach
    density:       { value: 0.85 },   // march span toward the light
    weight:        { value: 0.38 },   // per-sample weight
    enabled:       { value: 1.0 },    // 0 = pass-through (night / sun below horizon)
    time:          { value: 0.0 },    // elapsed time for animated fog drift
    mieG:          { value: 0.76 },   // Henyey-Greenstein anisotropy (0.76 = realistic Mie)
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2  lightPosition;
    uniform float exposure;
    uniform float decay;
    uniform float density;
    uniform float weight;
    uniform float enabled;
    uniform float time;
    uniform float mieG;
    varying vec2 vUv;

    const int NUM_SAMPLES = 90;

    // ── Interleaved Gradient Noise (Jorge Jimenez, 2014) ──────────────────────
    // Produces a spatially-uniform noise pattern with no texture lookup.
    // Applied once at ray start to offset the first sample, breaking up banding.
    float gradientNoise(vec2 pos) {
      return fract(52.9829189 * fract(dot(pos, vec2(0.06711056, 0.00583715))));
    }

    // ── 2-D value noise base function ─────────────────────────────────────────
    float hash21(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f); // Hermite smoothing
      return mix(
        mix(hash21(i),              hash21(i + vec2(1.0, 0.0)), f.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    // ── 3-octave FBM fog density (animated) ───────────────────────────────────
    // Slow atmospheric drift creates living, breathing fog patches.
    // Denser regions scatter more sun-light → rays become locally brighter.
    float fogFBM(vec2 p) {
      vec2 q = p + time * vec2(0.007, -0.004); // gentle wind drift
      float f  = 0.500 * valueNoise(q * 2.8);
      f       += 0.250 * valueNoise(q * 5.9 + vec2(5.2, 1.3));
      f       += 0.125 * valueNoise(q * 11.7 + vec2(1.7, 9.2));
      return clamp(f, 0.0, 1.0);
    }

    // ── Henyey-Greenstein Mie phase function ──────────────────────────────────
    // mu  = cos(scatter angle) = dot(viewDir, lightDir)
    // g   = anisotropy factor  (0.76 → strong forward scattering, like water droplets)
    // Returns scattering probability relative to isotropic (1/(4π)).
    float miePhase(float mu) {
      float g  = mieG;
      float gg = g * g;
      float denom = max(1.0 + gg - 2.0 * g * mu, 0.0001);
      return (1.0 - gg) / (4.0 * 3.14159265 * pow(denom, 1.5));
    }

    void main() {
      vec4 baseColor = texture2D(tDiffuse, vUv);

      if (enabled < 0.5) {
        gl_FragColor = baseColor;
        return;
      }

      // Step vector: from current pixel toward the light source
      vec2 texCoord     = vUv;
      vec2 deltaTexCoord = (vUv - lightPosition) * (density / float(NUM_SAMPLES));

      // ── IGN jitter: offset the first sample by a random fraction ──────────
      // Every pixel gets a different starting offset, eliminating the repeating
      // uniform stripes produced by fixed-step marching.
      float jitter = gradientNoise(gl_FragCoord.xy);
      texCoord -= deltaTexCoord * jitter;

      // ── Mie phase weight ──────────────────────────────────────────────────
      // Screen-space approximation: pixels near the sun disc (small dist)
      // correspond to forward-scatter geometry → higher Mie contribution.
      // Pixels far from the sun are side/back-scatter → lower contribution.
      float distToLight = length(lightPosition - vUv);
      // mu ranges from ~1.0 (at sun) to ~-0.5 (opposite side of screen)
      float mu = clamp(1.0 - distToLight * 1.8, -1.0, 1.0);
      float mieNorm    = miePhase(1.0); // peak value at mu=1 for normalisation
      float mieFactor  = clamp(miePhase(mu) / mieNorm, 0.08, 2.5);

      float illuminationDecay = 1.0;
      vec4  accumulated       = vec4(0.0);

      for (int i = 0; i < NUM_SAMPLES; i++) {
        texCoord -= deltaTexCoord;
        vec2 clampedCoord = clamp(texCoord, vec2(0.01), vec2(0.99));
        vec4 samp = texture2D(tDiffuse, clampedCoord);

        // ── Strict sun-disc threshold ───────────────────────────────────────
        // Only HDR-bright pixels (the sun disc and its bloom glow) contribute.
        // Normal sky, terrain, objects are excluded → produces thin shafts
        // rather than uniform broad illumination.
        float lum = dot(samp.rgb, vec3(0.299, 0.587, 0.114));
        float sunContrib = smoothstep(0.74, 0.94, lum);

        // ── FBM fog density modulation ──────────────────────────────────────
        // Atmospheric fog patches scatter the light differently:
        // dense fog → more scattering → ray appears locally brighter.
        // thin/gap  → less scattering → ray fades naturally.
        float fog     = fogFBM(texCoord * 1.8);
        float scatter = mix(0.18, 1.0, fog); // minimum scatter even in thin fog

        samp.rgb *= sunContrib * scatter;
        samp.a   *= sunContrib;

        accumulated += samp * (illuminationDecay * weight);
        illuminationDecay *= decay;
      }

      // Additive blend: rays on top of scene with Mie directional weighting
      gl_FragColor = baseColor + accumulated * exposure * mieFactor;
    }
  `,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Game3D() {
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
  // Volumetric lighting
  const composerRef = useRef<EffectComposer | null>(null);
  const sunDiscRef = useRef<THREE.Mesh | null>(null);
  const sunCoronaRef = useRef<THREE.Mesh | null>(null);
  const volScatterPassRef = useRef<ShaderPass | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const cloudsRef = useRef<Array<{ mesh: THREE.Group; vx: number; vz: number }>>([]);
  const grassMatRef = useRef<THREE.ShaderMaterial | null>(null);
  // Flora animation & collision data
  const floraRef = useRef<Array<{
    foliageGroup: THREE.Group;
    windPhase: number;     // per-plant phase offset so they sway out-of-sync
    windSpeed: number;     // 0.6–1.4 rad/s
    maxSway: number;       // max rotation amplitude (radians)
  }>>([]);
  const treeCollisionRef = useRef<Array<{
    x: number; z: number;
    radius: number;        // trunk radius + small buffer
  }>>([]);

  // ─── Combat Refs ────────────────────────────────────────────────────────────
  const playerHpRef = useRef(PLAYER_MAX_HP);
  const playerAttackCooldownRef = useRef(0);
  const foxesDefeatedRef = useRef(0);

  // ─── Weapon / Bullet Refs ───────────────────────────────────────────────────
  const bulletsRef = useRef<BulletData[]>([]);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const weaponRecoilRef = useRef(0); // 1 = just fired, decays to 0
  const muzzleFlashRef = useRef<THREE.PointLight | null>(null);

  // ─── Sound Refs ─────────────────────────────────────────────────────────────
  const footstepTimerRef = useRef(0);
  const foxGrowlCooldownRef = useRef(0);

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

  const [isMuted, setIsMuted] = useState(false);
  const [buildingUiState, setBuildingUiState] = useState<BuildingUiState>({
    mode: "explore",
    selectedMaterial: "wood",
    blockCount: 0,
  });
  const [nearSheepPrompt, setNearSheepPrompt] = useState(false);
  const [isPossessed, setIsPossessed] = useState(false);

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
    attackReady: true,
  });
  const [showIntro, setShowIntro] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [bleatingLabel, setBleatingLabel] = useState<string | null>(null);
  const [foxWarning, setFoxWarning] = useState(false);
  const [hitFlash, setHitFlash] = useState(false);
  const [attackEffect, setAttackEffect] = useState<string | null>(null);
  const [nearFoxHp, setNearFoxHp] = useState<{ hp: number; maxHp: number; name: string } | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const implementBufferRef = useRef<string>("");

  const lockPointer = useCallback(() => {
    if (mountRef.current) {
      mountRef.current.requestPointerLock();
    }
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

  // ─── Player attack ───────────────────────────────────────────────────────────
  const doAttack = useCallback(() => {
    if (!isLockedRef.current) return;
    if (playerAttackCooldownRef.current > 0) return;
    if (!cameraRef.current || !sceneRef.current) return;

    playerAttackCooldownRef.current = ATTACK_COOLDOWN;
    soundManager.playAttack();

    // ── Weapon recoil kick ──────────────────────────────────────────────────
    weaponRecoilRef.current = 1;

    // ── Muzzle flash (brief PointLight at barrel tip) ───────────────────────
    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.intensity = 4;
      setTimeout(() => {
        if (muzzleFlashRef.current) muzzleFlashRef.current.intensity = 0;
      }, 75);
    }

    // ── Spawn bullet projectile ─────────────────────────────────────────────
    const cam = cameraRef.current;
    const scene = sceneRef.current;

    // Camera world position and look direction
    const startPos = new THREE.Vector3();
    cam.getWorldPosition(startPos);
    const forward = new THREE.Vector3(0, 0, -1);
    forward.transformDirection(cam.matrixWorld);

    // Start bullet slightly in front of camera (past the near plane)
    startPos.addScaledVector(forward, 1.2);

    const bulletMesh = buildBulletMesh();
    bulletMesh.position.copy(startPos);
    scene.add(bulletMesh);

    bulletsRef.current.push({
      mesh: bulletMesh,
      velocity: forward.clone().multiplyScalar(BULLET_SPEED),
      lifetime: BULLET_LIFETIME,
    });

    // ── Immediate melee fallback for very close foxes ───────────────────────
    const playerPos = cam.position;
    let closest: (typeof foxListRef.current)[0] | null = null;
    let closestDist = ATTACK_RANGE;

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
      fox.hp = Math.max(0, fox.hp - ATTACK_DAMAGE);
      fox.hitFlashTimer = 0.25;
      flashFoxMesh(fox.mesh);
      soundManager.playFoxHit();

      setAttackEffect(`-${ATTACK_DAMAGE}`);
      setTimeout(() => setAttackEffect(null), 700);

      if (fox.hp <= 0) {
        fox.isAlive = false;
        foxesDefeatedRef.current++;
        soundManager.playFoxDeath();
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountNode.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ── EffectComposer for volumetric bloom / god-ray effect ────────────────
    const composer = new EffectComposer(renderer);

    // Scene
    const scene = new THREE.Scene();
    // Exponential fog: more realistic atmospheric haze than linear fog.
    // Density 0.0095 ≈ 50 % opacity at ~73 m — slightly denser than the old 0.007.
    // The extra atmospheric haze makes volumetric light shafts look like they are
    // genuinely penetrating through fog/mist rather than drawing on clear air.
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0095);
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

    // ── First-person weapon (attached to camera) ─────────────────────────────
    const weaponGroup = buildWeaponMesh();
    weaponGroup.position.copy(WEAPON_POS);
    weaponGroup.rotation.y = -0.12; // slight inward cant
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
    sun.shadow.mapSize.set(2048, 2048);
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

    // ── Visible sun disc (emissive sphere on sky for volumetric bloom) ───────
    const sunDiscGeo = new THREE.SphereGeometry(9, 24, 24);
    const sunDiscMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.0, 1.6, 1.0), // HDR value > 1 triggers bloom threshold
      toneMapped: false,
    });
    const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    scene.add(sunDisc);
    sunDiscRef.current = sunDisc;

    // Corona halo — slightly larger, softer glow ring around sun disc
    const coronaGeo = new THREE.SphereGeometry(20, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.0, 0.75, 0.35),
      toneMapped: false,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
    });
    const sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
    scene.add(sunCorona);
    sunCoronaRef.current = sunCorona;

    // Finish composing render pipeline — needs scene + camera ready
    // Pipeline: RenderPass → BloomPass → VolumetricScatteringPass → OutputPass
    composer.addPass(new RenderPass(scene, camera));

    // Bloom: amplifies the sun disc to near-white so it feeds the ray shader cleanly
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      /* strength */ 0.60,
      /* radius   */ 0.55,
      /* threshold*/ 0.90   // only objects with luminance > 0.90 get bloomed
    );
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    // ── Screen-space volumetric scattering (crepuscular / god rays) ──────────
    // Replaces the old 3-D cone shafts with a post-process shader that marches
    // from each pixel toward the sun's UV position, accumulating only the bright
    // sun disc+bloom contribution. Result: thin, fog-piercing shafts that look
    // like sunlight scattering through haze — much more realistic than geometry.
    const volScatterPass = new ShaderPass(VolumetricScatteringShader);
    composer.addPass(volScatterPass);
    volScatterPassRef.current = volScatterPass;

    composer.addPass(new OutputPass());
    composerRef.current = composer;

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
    const waterGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x1a6aa0,
      transparent: true,
      opacity: 0.8,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -0.5;
    scene.add(water);

    // ── Grass ───────────────────────────────────────────────────────────────
    {
      // Realistic grass: each blade uses a quadratic bezier curve baked into
      // vertex positions, 3 planes with random Y-rotation (120° apart) for
      // full volumetric appearance from all camera angles, true pointed tip,
      // and 9 height bands for ultra-smooth curvature. Different cluster archetypes
      // (short tuft / mixed meadow / tall reed) add habitat variety. A 4th plane
      // is added to tall blades for a richer silhouette from all camera angles.
      const GRASS_COUNT = 70000;
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

      const CLUSTER_RADIUS = 0.65;  // slightly bigger clusters for denser patches
      const BLADES_MIN = 5;         // at least 5 blades per cluster
      const BLADES_MAX = 11;        // up to 11 for dense tufts
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
            // sssBacklit: warm amber glow when blades are backlit (sun behind/below)
            float sssBacklit = max(0.0, -sunDir.y + 0.35) * vHeightFactor * 0.62;
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
      const rock = buildRockMesh(rockRng);
      rock.position.set(p.x, p.y + 0.2, p.z);
      rock.rotation.y = rockRng() * Math.PI * 2;
      scene.add(rock);
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

    // ── Ruins (distant location) ──────────────────────────────────────────────
    let ruinsSeed = 999;
    const ruinsRng = () => {
      ruinsSeed = (ruinsSeed * 1664525 + 1013904223) & 0xffffffff;
      return (ruinsSeed >>> 0) / 0xffffffff;
    };
    const ruins = buildRuins(ruinsRng);
    const ruinsX = 180;
    const ruinsZ = -120;
    ruins.position.set(ruinsX, getTerrainHeightSampled(ruinsX, ruinsZ), ruinsZ);
    ruins.rotation.y = 0.4;
    scene.add(ruins);

    // ── Lighthouse (on a coastal rise) ───────────────────────────────────────
    const { group: lighthouse, beamPivot, lighthouseLight } = buildLighthouse();
    const lhX = -220;
    const lhZ = 180;
    lighthouse.position.set(lhX, getTerrainHeightSampled(lhX, lhZ), lhZ);
    scene.add(lighthouse);
    lighthouseBeamRef.current = beamPivot;
    lighthouseLightRef.current = lighthouseLight;

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
          doAttack();
        }
        // sculpt mode: scroll wheel sculpts, left click does nothing extra
      } else if (e.button === 2 && buildModeRef.current !== "explore") {
        removeBlock();
      }
    };
    document.addEventListener("mousedown", onMouseDown);

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

      // E key: possess / unpossess nearby sheep
      if (e.type === "keydown" && e.code === "KeyE") {
        if (possessedSheepRef.current) {
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
          if (weaponMeshRef.current) weaponMeshRef.current.visible = true;
        } else if (nearestSheepForPossessRef.current) {
          // Enter sheep body
          possessedSheepRef.current = nearestSheepForPossessRef.current;
          setIsPossessed(true);
          if (weaponMeshRef.current) weaponMeshRef.current.visible = false;
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
      setGameState((s) => ({ ...s, isLocked: locked }));
      if (locked) {
        setShowIntro(false);
        setGameStarted(true);
        soundManager.init(); // Bootstrap audio on first user gesture
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

      // ── Day / Night cycle ──────────────────────────────────────────────────
      dayTimeRef.current = (dayTimeRef.current + dt) % DAY_DURATION;
      const dayFraction = dayTimeRef.current / DAY_DURATION;
      const isNight = dayFraction < 0.18 || dayFraction > 0.82;
      soundManager.updateDaytime(dayFraction);

      const skyColor = getSkyColor(dayFraction);
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

      // ── Screen-space volumetric scattering uniforms ────────────────────────
      // Project the sun disc's world position into screen UV space [0..1] and
      // feed it to the ShaderPass every frame so the rays always track the sun.
      if (volScatterPassRef.current && sunDiscRef.current && cameraRef.current) {
        const cam    = cameraRef.current;
        const sunInt = getSunIntensity(dayFraction);
        // Grab the sun disc world position and project it to NDC then to UV
        const sunNDC = sunDiscRef.current.position.clone().project(cam);

        // UV coords: NDC [-1,1] → [0,1], Y is flipped (WebGL Y-up vs UV Y-down)
        const sunUVx = (sunNDC.x + 1.0) * 0.5;
        const sunUVy = (sunNDC.y + 1.0) * 0.5;

        // The sun disc is visible when in front of camera (z < 1 in NDC) and daytime
        const sunInView = sunNDC.z < 1.0 && sunInt > 0;

        const uniforms = volScatterPassRef.current.material.uniforms;
        uniforms.lightPosition.value.set(sunUVx, sunUVy);
        uniforms.enabled.value = sunInView ? 1.0 : 0.0;
        // Always update time so animated fog drift runs continuously
        uniforms.time.value = elapsed;

        if (sunInView) {
          const isGoldenHour = dayFraction < 0.32 || dayFraction > 0.68;
          // Golden hour: vivid warm rays; midday: subtle pale haze shafts
          // Exposure kept low so rays feel like light through mist, not searchlights
          uniforms.exposure.value = isGoldenHour
            ? 0.18 * sunInt                // warm golden dawn/dusk shafts
            : 0.09 * sunInt;               // pale diffuse midday haze
          // Weight variation: slow sine gives gentle, breathing turbulence
          uniforms.weight.value = 0.35 + Math.sin(elapsed * 0.14) * 0.04;
          // Mie anisotropy: slightly stronger forward-scattering at golden hour
          uniforms.mieG.value = isGoldenHour ? 0.80 : 0.76;
        }
      }

      // ── Dynamic bloom strength (stronger at golden hour) ──────────────────
      if (bloomPassRef.current) {
        const bp = bloomPassRef.current as UnrealBloomPass;
        const sunIntBloom = getSunIntensity(dayFraction);
        const isGoldenHourBloom = dayFraction < 0.32 || dayFraction > 0.68;
        if (isGoldenHourBloom && sunIntBloom > 0) {
          bp.strength = 0.65;
          bp.radius = 0.55;
        } else if (sunIntBloom > 0) {
          bp.strength = 0.45;
          bp.radius = 0.4;
        } else {
          // Night: dim star glow only
          bp.strength = 0.28;
          bp.radius = 0.35;
        }
      }

      if (moonRef.current) {
        const moonAngle = (dayFraction + 0.25) * Math.PI * 2;
        moonRef.current.position.set(
          Math.cos(moonAngle) * 200,
          Math.sin(moonAngle) * 180,
          -80
        );
        moonRef.current.intensity = isNight
          ? smoothstep(0.82, 0.9, dayFraction) * 0.35 +
            smoothstep(0.18, 0.1, dayFraction) * 0.35
          : 0;
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

      // ── Flora (tree & bush foliage) wind sway ─────────────────────────────
      floraRef.current.forEach((flora) => {
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
      // Brighten lighthouse light at night, dim at day
      if (lighthouseLightRef.current) {
        lighthouseLightRef.current.intensity = isNight ? 6 : 1.5;
      }

      // ── Player movement (only when NOT possessing an entity) ───────────────
      if (isLockedRef.current && !possessedSheepRef.current) {
        const cam = cameraRef.current!;
        const keys = keysRef.current;

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

        const speed = sprinting ? SPRINT_SPEED : MOVE_SPEED;
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

        // Water boundary: player cannot enter water
        if (getTerrainHeightSampled(cam.position.x, cam.position.z) < WATER_LEVEL) {
          cam.position.x = playerPrevX;
          cam.position.z = playerPrevZ;
        }

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

        const player = playerRef.current;
        if (keys["Space"] && player.onGround) {
          player.velY = JUMP_FORCE;
          player.onGround = false;
          soundManager.playJump();
        }
        player.velY += GRAVITY * dt;
        cam.position.y += player.velY * dt;

        const groundY = getTerrainHeightSampled(cam.position.x, cam.position.z) + PLAYER_HEIGHT;
        if (cam.position.y <= groundY) {
          cam.position.y = groundY;
          player.velY = 0;
          player.onGround = true;
        }

        cam.rotation.order = "YXZ";
        cam.rotation.y = yawRef.current;
        cam.rotation.x = pitchRef.current;

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

        // Sheep body faces the camera yaw direction
        s.rotation.y = -yawRef.current;
        sheep.currentAngle = -yawRef.current;

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

        // Position camera at sheep head level
        cam.position.set(s.position.x, s.position.y + POSSESS_CAM_HEIGHT, s.position.z);
        cam.rotation.order = "YXZ";
        cam.rotation.y = yawRef.current;
        cam.rotation.x = pitchRef.current;
      }

      // ── Coin collection & rotation ─────────────────────────────────────────
      const playerPos = cameraRef.current!.position;
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

        wep.position.set(
          WEAPON_POS.x + Math.sin(elapsed * swaySpeed * 0.5) * swayAmt * 0.6,
          WEAPON_POS.y + Math.abs(Math.sin(elapsed * swaySpeed)) * swayAmt - recoil * 0.04,
          WEAPON_POS.z + recoil * 0.12
        );
        wep.rotation.x = recoil * 0.18 + Math.sin(elapsed * swaySpeed) * swayAmt * 0.4;
      }

      // ── Bullet update ──────────────────────────────────────────────────────
      const toRemove: BulletData[] = [];
      bulletsRef.current.forEach((bullet) => {
        bullet.lifetime -= dt;
        if (bullet.lifetime <= 0) {
          toRemove.push(bullet);
          return;
        }
        // Move bullet forward
        bullet.mesh.position.addScaledVector(bullet.velocity, dt);

        // Check fox collisions
        for (const fox of foxListRef.current) {
          if (!fox.isAlive) continue;
          const dist = bullet.mesh.position.distanceTo(fox.mesh.position);
          if (dist < BULLET_HIT_RADIUS) {
            fox.hp = Math.max(0, fox.hp - ATTACK_DAMAGE);
            fox.hitFlashTimer = 0.25;
            flashFoxMesh(fox.mesh);
            soundManager.playFoxHit();
            setAttackEffect(`-${ATTACK_DAMAGE}`);
            setTimeout(() => setAttackEffect(null), 700);
            if (fox.hp <= 0) {
              fox.isAlive = false;
              foxesDefeatedRef.current++;
              soundManager.playFoxDeath();
            }
            toRemove.push(bullet);
            break;
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

      // ── Possession proximity — find nearest sheep, manage highlight ──────────
      if (!possessedSheepRef.current) {
        let nearestDist = POSSESS_RADIUS;
        let nearestSheep: SheepData | null = null;
        sheepListRef.current.forEach((sheep) => {
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

      // ── Minimap ────────────────────────────────────────────────────────────
      const canvas = minimapRef.current;
      if (canvas && cameraRef.current) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const W = 160;
          const scale = W / WORLD_SIZE;
          const cx = W / 2;
          const cy = W / 2;

          ctx.fillStyle = isNight ? "#060e06" : "#1a2e1a";
          ctx.fillRect(0, 0, W, W);

          // Pen
          ctx.strokeStyle = "#c8a050";
          ctx.lineWidth = 1.5;
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

          // Player arrow
          const px = cx + cameraRef.current.position.x * scale;
          const pz = cy + cameraRef.current.position.z * scale;
          ctx.save();
          ctx.translate(px, pz);
          ctx.rotate(yawRef.current + Math.PI);
          ctx.fillStyle = "#00ff88";
          ctx.beginPath();
          ctx.moveTo(0, -5);
          ctx.lineTo(-3, 4);
          ctx.lineTo(3, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Compass labels
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.font = "bold 8px monospace";
          ctx.fillText("N", 74, 9);
          ctx.fillText("S", 74, W - 2);
          ctx.fillText("W", 2, 83);
          ctx.fillText("E", W - 8, 83);

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
        attackReady: playerAttackCooldownRef.current <= 0,
      }));

      const bleatingNear = sheepListRef.current.find(
        (sheep) =>
          sheep.bleating && sheep.mesh.position.distanceTo(playerPos) < 20
      );
      setBleatingLabel(bleatingNear ? "🐑 Bééé!" : null);

      if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, cameraRef.current!);
      }
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!rendererRef.current || !cameraRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      composerRef.current?.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      // Clean up any live bullets from the scene
      bulletsRef.current.forEach((b) => scene.remove(b.mesh));
      bulletsRef.current = [];
      composerRef.current?.dispose();
      composerRef.current = null;
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
      {/* Hit flash overlay */}
      {hitFlash && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "rgba(220,30,30,0.35)", zIndex: 50 }}
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
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", marginBottom: 14 }}
            >
              Hráč
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
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <canvas ref={minimapRef} width={160} height={160} />
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
        </div>
      )}

      {/* ═══════════════ CENTER — Possession prompt ═══════════════ */}
      {nearSheepPrompt && !isPossessed && gameState.isLocked && (
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
            <span style={{ color: "#f87171", opacity: 1 }}>[F]/Klik</span> – útok &nbsp;·&nbsp;{" "}
            <span style={{ color: "#86efac", opacity: 1 }}>[B]</span> – stavění &nbsp;·&nbsp;{" "}
            <span style={{ color: "#60a5fa", opacity: 1 }}>[E]</span> – vstoupit do ovce &nbsp;·&nbsp;{" "}
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

      {/* Pause overlay — shown when game started but pointer is unlocked */}
      {gameStarted && !gameState.isLocked && !showIntro && (
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
            <p className="text-gray-400 text-sm" style={{ marginBottom: 8 }}>Lišky tě dostaly…</p>
            <p className="text-gray-500 text-xs" style={{ marginBottom: 28 }}>
              Porazil jsi <span className="text-orange-400 font-bold">{gameState.foxesDefeated}</span> lišek
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
                <div>🦊 <strong className="text-orange-400">Bojuj s liškami</strong> [F] nebo kliknutím</div>
                <div>⚓ Najdi <strong className="text-white">maják</strong> na pobřeží</div>
                <div>🧱 <strong className="text-green-300">Stav budovy</strong> stiskni [B]</div>
                <div>⛏ <strong className="text-cyan-300">Tvaruj terén</strong> v stavění [T]</div>
                <div>🐑 <strong className="text-blue-300">[E]</strong> vstoupit do těla ovce</div>
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
                <span>⚔️ <strong className="text-gray-300">[F]/Klik</strong> – útok</span>
                <span>🐑 <strong className="text-blue-300">[E]</strong> – vstoupit do ovce</span>
                <span>⏸ <strong className="text-gray-300">Esc</strong> – pauza</span>
                <span>🧱 <strong className="text-green-400">[B]</strong> – stavění</span>
              </div>
              <div className="flex gap-6 justify-center flex-wrap">
                <span>⛏ <strong className="text-cyan-400">[T]</strong> – terén (v stavění)</span>
                <span>💡 napiš <strong className="text-purple-400">IMPLEMENT</strong> – návrh</span>
              </div>
            </div>

            <button
              className="bg-green-600 hover:bg-green-500 transition-colors text-white font-bold rounded-xl text-lg w-full"
              style={{ padding: "14px 32px" }}
              onClick={(e) => { e.stopPropagation(); lockPointer(); }}
            >
              Hrát!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
