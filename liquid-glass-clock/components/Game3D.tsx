"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  getTerrainHeight,
  generateSpawnPoints,
  initNoise,
  WORLD_SIZE,
  TERRAIN_SEGMENTS,
  WATER_LEVEL,
} from "@/lib/terrainUtils";
import {
  buildSheepMesh,
  buildFoxMesh,
  buildTreeMesh,
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
const ROCK_COUNT = 90;
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
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const moonRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const galaxyRef = useRef<THREE.Points | null>(null);
  const skyMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudsRef = useRef<Array<{ mesh: THREE.Group; vx: number; vz: number }>>([]);
  const grassMatRef = useRef<THREE.ShaderMaterial | null>(null);

  // ─── Combat Refs ────────────────────────────────────────────────────────────
  const playerHpRef = useRef(PLAYER_MAX_HP);
  const playerAttackCooldownRef = useRef(0);
  const foxesDefeatedRef = useRef(0);

  // ─── Weapon / Bullet Refs ───────────────────────────────────────────────────
  const bulletsRef = useRef<BulletData[]>([]);
  const weaponMeshRef = useRef<THREE.Group | null>(null);
  const weaponRecoilRef = useRef(0); // 1 = just fired, decays to 0
  const muzzleFlashRef = useRef<THREE.PointLight | null>(null);

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

  // ─── Player attack ───────────────────────────────────────────────────────────
  const doAttack = useCallback(() => {
    if (!isLockedRef.current) return;
    if (playerAttackCooldownRef.current > 0) return;
    if (!cameraRef.current || !sceneRef.current) return;

    playerAttackCooldownRef.current = ATTACK_COOLDOWN;

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

      setAttackEffect(`-${ATTACK_DAMAGE}`);
      setTimeout(() => setAttackEffect(null), 700);

      if (fox.hp <= 0) {
        fox.isAlive = false;
        foxesDefeatedRef.current++;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Scene Setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current) return;
    initNoise(42);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87ceeb, FOG_NEAR, FOG_FAR);
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

    // ── Stars ───────────────────────────────────────────────────────────────
    const starPositions: number[] = [];
    const starColors: number[] = [];
    // Vary star sizes using size attribute
    const starSizes: number[] = [];
    for (let i = 0; i < 3800; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      // Only upper hemisphere + sides, avoid ground clipping
      const r = 460;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      // Slight color variation: pure white, blue-white, warm white
      const rnd = Math.random();
      if (rnd < 0.15) { starColors.push(0.7, 0.8, 1.0); }       // blue-white
      else if (rnd < 0.25) { starColors.push(1.0, 0.95, 0.8); } // warm
      else { starColors.push(1.0, 1.0, 1.0); }                   // white
      starSizes.push(0.8 + Math.random() * 2.8);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    starGeo.setAttribute("color", new THREE.Float32BufferAttribute(starColors, 3));
    starGeo.setAttribute("size", new THREE.Float32BufferAttribute(starSizes, 1));
    const starMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 1.8,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.visible = false;
    scene.add(stars);
    starsRef.current = stars;

    // ── Milky Way galaxy band ────────────────────────────────────────────────
    const galaxyPositions: number[] = [];
    const galaxyColors: number[] = [];
    // Band tilted ~50° from equatorial plane, simulating Milky Way
    const bandTilt = 0.88;
    for (let i = 0; i < 4200; i++) {
      const t = Math.random() * Math.PI * 2;
      // Gaussian-spread across band width
      const spread = (Math.random() + Math.random() - 1.0) * 0.35;
      const bx = Math.cos(t);
      const by = Math.sin(t) * Math.cos(bandTilt) + spread * Math.sin(bandTilt);
      const bz = Math.sin(t) * Math.sin(bandTilt) - spread * Math.cos(bandTilt);
      const r = 458 + (Math.random() - 0.5) * 15;
      galaxyPositions.push(bx * r, by * r, bz * r);
      // Colors: blue-white, pale lavender, faint warm for core
      const cr = Math.random();
      if (cr < 0.4) { galaxyColors.push(0.72, 0.80, 1.0); }       // blue-white
      else if (cr < 0.65) { galaxyColors.push(0.82, 0.78, 1.0); } // lavender
      else if (cr < 0.85) { galaxyColors.push(1.0, 0.98, 0.88); } // warm white
      else { galaxyColors.push(0.9, 0.85, 1.0); }                  // pale purple
    }
    const galaxyGeo = new THREE.BufferGeometry();
    galaxyGeo.setAttribute("position", new THREE.Float32BufferAttribute(galaxyPositions, 3));
    galaxyGeo.setAttribute("color", new THREE.Float32BufferAttribute(galaxyColors, 3));
    const galaxyMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
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
      const GRASS_COUNT = 20000;
      const BLADE_H = 0.65;
      const BLADE_W = 0.10;
      let gSeed = 7391;
      const gRng = () => {
        gSeed = (gSeed * 1664525 + 1013904223) & 0xffffffff;
        return (gSeed >>> 0) / 0xffffffff;
      };

      const gPos: number[] = [];
      const gHeightFactor: number[] = [];
      const gWindPhase: number[] = [];
      const gColor: number[] = [];

      let placed = 0;
      let tries = 0;
      while (placed < GRASS_COUNT && tries < GRASS_COUNT * 6) {
        tries++;
        const wx = (gRng() - 0.5) * (WORLD_SIZE * 0.85);
        const wz = (gRng() - 0.5) * (WORLD_SIZE * 0.85);
        const wy = getTerrainHeight(wx, wz);
        if (wy < 0.3 || wy > 14) continue; // green terrain zones

        const h = BLADE_H * (0.5 + gRng() * 1.1);
        const w = BLADE_W * (0.55 + gRng() * 0.9);
        // Slight random lean direction
        const tiltX = (gRng() - 0.5) * 0.18;
        const tiltZ = (gRng() - 0.5) * 0.18;
        // Wind phase varies by world position for wave-like field motion
        const phase = wx * 0.48 + wz * 0.73;
        // Color variation: fresh green, dry yellowish, or dark lush
        const colorRoll = gRng();
        let greenVariant: number, baseR: number, tipR: number;
        if (colorRoll < 0.2) {
          // Dry/yellowish tufts
          greenVariant = 0.55 + gRng() * 0.15;
          baseR = 0.22 + gRng() * 0.08;
          tipR  = 0.45 + gRng() * 0.12;
        } else if (colorRoll < 0.55) {
          // Bright fresh green
          greenVariant = 0.60 + gRng() * 0.15;
          baseR = 0.10 + gRng() * 0.05;
          tipR  = 0.20 + gRng() * 0.08;
        } else {
          // Lush dark green
          greenVariant = 0.45 + gRng() * 0.12;
          baseR = 0.08 + gRng() * 0.04;
          tipR  = 0.18 + gRng() * 0.06;
        }

        // Two crossed quads (12 vertices), heightFactor: 0=base, 1=tip
        const verts: [number, number, number, number][] = [
          // Quad 1 (facing Z)
          [-w / 2, 0,  0,  0],
          [ w / 2, 0,  0,  0],
          [-w / 2 + tiltX, h, tiltZ, 1],
          [ w / 2, 0,  0,  0],
          [ w / 2 + tiltX, h, tiltZ, 1],
          [-w / 2 + tiltX, h, tiltZ, 1],
          // Quad 2 (facing X)
          [0, 0, -w / 2, 0],
          [0, 0,  w / 2, 0],
          [tiltX, h, -w / 2 + tiltZ, 1],
          [0, 0,  w / 2, 0],
          [tiltX, h,  w / 2 + tiltZ, 1],
          [tiltX, h, -w / 2 + tiltZ, 1],
        ];

        for (const [bx, by, bz, hf] of verts) {
          gPos.push(wx + bx, wy + by, wz + bz);
          gHeightFactor.push(hf);
          gWindPhase.push(phase);
          // Base is darker/slightly bluer, tip is lighter and slightly yellow-green
          gColor.push(
            baseR + (tipR - baseR) * hf,
            greenVariant * (0.68 + hf * 0.32),
            0.08 + hf * 0.06
          );
        }
        placed++;
      }

      const grassGeo = new THREE.BufferGeometry();
      grassGeo.setAttribute("position", new THREE.Float32BufferAttribute(gPos, 3));
      grassGeo.setAttribute("heightFactor", new THREE.Float32BufferAttribute(gHeightFactor, 1));
      grassGeo.setAttribute("windPhase", new THREE.Float32BufferAttribute(gWindPhase, 1));
      grassGeo.setAttribute("color", new THREE.Float32BufferAttribute(gColor, 3));

      const grassMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0.0 } },
        vertexShader: `
          attribute float heightFactor;
          attribute float windPhase;
          attribute vec3 color;
          uniform float time;
          varying vec3 vColor;
          void main() {
            vec3 pos = position;
            // Quadratic curve: tips sway more than base, creating natural blade bend
            float curve = heightFactor * heightFactor;
            float wind = (sin(windPhase + time * 1.7) * 0.55 + cos(windPhase * 1.4 + time * 1.2) * 0.45);
            float gust  = sin(time * 0.4 + windPhase * 0.05) * 0.3; // slow gusts
            pos.x += (wind + gust) * curve * 0.18;
            pos.z += wind * curve * 0.09;
            // Darken grass base (ambient occlusion hint)
            vColor = color * (0.60 + heightFactor * 0.40);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            gl_FragColor = vec4(vColor, 1.0);
          }
        `,
        side: THREE.DoubleSide,
        // vertexColors handled manually via 'color' attribute in the shader
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
        const wy = getTerrainHeight(wx, wz);
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
      const tree = buildTreeMesh(treeRng);
      tree.position.set(p.x, p.y, p.z);
      scene.add(tree);
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
      group.rotation.y = -initialAngle + Math.PI / 2;
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
        const py = getTerrainHeight(
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
      const ry2 = getTerrainHeight(x, z);
      rail.position.set(x, ry2 + 0.9, z);
      scene.add(rail);
    });

    // ── Windmill (near the pen) ───────────────────────────────────────────────
    const { group: windmillGroup, blades } = buildWindmill();
    const windmillX = 28;
    const windmillZ = 28;
    windmillGroup.position.set(windmillX, getTerrainHeight(windmillX, windmillZ), windmillZ);
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
    house.position.set(houseX, getTerrainHeight(houseX, houseZ), houseZ);
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
    ruins.position.set(ruinsX, getTerrainHeight(ruinsX, ruinsZ), ruinsZ);
    ruins.rotation.y = 0.4;
    scene.add(ruins);

    // ── Lighthouse (on a coastal rise) ───────────────────────────────────────
    const lighthouse = buildLighthouse();
    const lhX = -220;
    const lhZ = 180;
    lighthouse.position.set(lhX, getTerrainHeight(lhX, lhZ), lhZ);
    scene.add(lighthouse);

    // ── Input ─────────────────────────────────────────────────────────────────
    // ── Mouse click attack ────────────────────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && isLockedRef.current) {
        doAttack();
      }
    };
    document.addEventListener("mousedown", onMouseDown);

    const IMPLEMENT_WORD = "IMPLEMENT";
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === "keydown";

      // F key attack
      if (e.type === "keydown" && e.code === "KeyF") {
        doAttack();
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
      }
    };
    document.addEventListener("pointerlockchange", onLockChange);

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

      const skyColor = getSkyColor(dayFraction);
      scene.background = skyColor;
      (scene.fog as THREE.Fog).color = skyColor;
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

      if (starsRef.current) {
        starsRef.current.visible = isNight;
      }

      if (galaxyRef.current) {
        galaxyRef.current.visible = isNight;
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

      // ── Grass wind ────────────────────────────────────────────────────────
      if (grassMatRef.current) {
        grassMatRef.current.uniforms.time.value = elapsed;
      }

      // ── Windmill blades ────────────────────────────────────────────────────
      if (windmillBladesRef.current) {
        windmillBladesRef.current.rotation.x += dt * 0.8;
      }

      // ── Player movement ────────────────────────────────────────────────────
      if (isLockedRef.current) {
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
        if (getTerrainHeight(cam.position.x, cam.position.z) < WATER_LEVEL) {
          cam.position.x = playerPrevX;
          cam.position.z = playerPrevZ;
        }

        const player = playerRef.current;
        if (keys["Space"] && player.onGround) {
          player.velY = JUMP_FORCE;
          player.onGround = false;
        }
        player.velY += GRAVITY * dt;
        cam.position.y += player.velY * dt;

        const groundY = getTerrainHeight(cam.position.x, cam.position.z) + PLAYER_HEIGHT;
        if (cam.position.y <= groundY) {
          cam.position.y = groundY;
          player.velY = 0;
          player.onGround = true;
        }

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
          getTerrainHeight(coin.mesh.position.x, coin.mesh.position.z) +
          0.8 +
          Math.sin(elapsed * 2 + coin.mesh.position.x) * 0.15;

        const dx = playerPos.x - coin.mesh.position.x;
        const dz = playerPos.z - coin.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < COIN_COLLECT_RADIUS) {
          coin.collected = true;
          coin.mesh.visible = false;
          coinsCollectedRef.current++;
          collected = coinsCollectedRef.current;
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
            setAttackEffect(`-${ATTACK_DAMAGE}`);
            setTimeout(() => setAttackEffect(null), 700);
            if (fox.hp <= 0) {
              fox.isAlive = false;
              foxesDefeatedRef.current++;
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
            fm.rotation.y = Math.atan2(dx, dz);
          } else {
            // Attack player
            fox.attackCooldown -= dt;
            if (fox.attackCooldown <= 0) {
              fox.attackCooldown = 1.0;
              if (!gameOver) {
                playerHpRef.current = Math.max(0, playerHpRef.current - FOX_ATTACK_DAMAGE);
                setHitFlash(true);
                setTimeout(() => setHitFlash(false), 300);
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
              fm.rotation.y = Math.atan2(dx, dz);
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
            fm.rotation.y = fox.wanderAngle + Math.PI / 2;

            const half = WORLD_SIZE / 2 - 20;
            if (Math.abs(fm.position.x) > half) fox.wanderAngle = Math.PI - fox.wanderAngle;
            if (Math.abs(fm.position.z) > half) fox.wanderAngle = -fox.wanderAngle;
          }
        }

        // Water boundary: fox cannot enter water
        if (getTerrainHeight(fm.position.x, fm.position.z) < WATER_LEVEL) {
          fm.position.x = foxPrevX;
          fm.position.z = foxPrevZ;
          fox.wanderAngle = Math.atan2(fm.position.z, fm.position.x) + Math.PI;
        }

        fm.position.y = getTerrainHeight(fm.position.x, fm.position.z);

        if (distToPlayer < 18) {
          foxNear = true;
        }
      });

      setFoxWarning(foxNear);

      // Update nearest fox HP display
      if (closestAliveFox && closestAliveFoxDist < 18) {
        const f = closestAliveFox as (typeof foxListRef.current)[0];
        setNearFoxHp({ hp: f.hp, maxHp: f.maxHp, name: "Liška" });
      } else {
        setNearFoxHp(null);
      }

      // ── Sheep AI & Animation ────────────────────────────────────────────────
      let closeSheepCount = 0;
      sheepListRef.current.forEach((sheep) => {
        const s = sheep.mesh;
        const dx = playerPos.x - s.position.x;
        const dz = playerPos.z - s.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        sheep.bleatTimer -= dt;
        if (sheep.bleatTimer <= 0) {
          sheep.bleating = true;
          sheep.bleatTimer = 10 + Math.random() * 20;
          setTimeout(() => { sheep.bleating = false; }, 1500);
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
        if (getTerrainHeight(s.position.x, s.position.z) < WATER_LEVEL) {
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

        s.position.y = getTerrainHeight(s.position.x, s.position.z);
        // Sheep rotation always matches currentAngle (it already turns smoothly)
        s.rotation.y = -sheep.currentAngle + Math.PI / 2;

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

      renderer.render(scene, cameraRef.current!);
    };
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
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("resize", onResize);
      // Clean up any live bullets from the scene
      bulletsRef.current.forEach((b) => scene.remove(b.mesh));
      bulletsRef.current = [];
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
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
            doAttack();
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
          className="fixed left-4 top-4 pointer-events-none select-none flex flex-col gap-2"
          style={{ width: 220 }}
        >
          {/* Player stats card */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Section label */}
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}
            >
              Hráč
            </div>

            {/* HP bar */}
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1.5">
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
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
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
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginBottom: 12 }} />

            {/* Section label */}
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}
            >
              Úkoly
            </div>

            {/* Stats */}
            <div className="space-y-2.5">
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
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "12px 0" }} />
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>🦊 Poraženo</span>
                  <span className="text-xs font-bold text-orange-300 tabular-nums">
                    {gameState.foxesDefeated}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Win notifications */}
          {gameState.sheepCollected === SHEEP_COUNT && (
            <div
              className="rounded-xl px-3 py-2 text-center text-yellow-300 font-bold text-xs animate-pulse"
              style={{
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
              className="rounded-xl px-3 py-2 text-center text-yellow-200 font-bold text-xs animate-pulse"
              style={{
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
        <div className="fixed right-4 top-4 pointer-events-none select-none flex flex-col items-end gap-2">
          {/* Minimap with glass frame */}
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <canvas ref={minimapRef} width={160} height={160} />
          </div>

          {/* Time + compass */}
          <div
            className="rounded-xl px-3 py-2 text-white text-xs font-medium flex items-center gap-2"
            style={{
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
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-center transition-all duration-150"
            style={{
              width: 160,
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

      {/* ═══════════════ CENTER TOP — Fox warning ═══════════════ */}
      {foxWarning && gameState.isLocked && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl px-5 py-2 text-white font-bold text-sm animate-pulse"
            style={{
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
            className="rounded-2xl px-5 py-3 text-white text-xs text-center"
            style={{
              background: "rgba(5,8,20,0.72)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255,255,255,0.10)",
              minWidth: 190,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div
              className="mb-2 font-bold text-sm"
              style={{ color: "#fb923c" }}
            >
              {nearFoxHp.name}
            </div>
            <div
              className="h-3 rounded-full overflow-hidden mb-1.5"
              style={{ background: "rgba(255,255,255,0.08)" }}
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

      {/* ═══════════════ BOTTOM CENTER — Controls hint ═══════════════ */}
      {gameState.isLocked && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl px-4 py-2 text-white text-xs"
            style={{
              background: "rgba(5,8,20,0.60)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            WASD – pohyb &nbsp;·&nbsp; Myš – pohled &nbsp;·&nbsp; Mezerník – skok &nbsp;·&nbsp;
            Shift – sprint &nbsp;·&nbsp; Esc – pauza &nbsp;·&nbsp;{" "}
            <span style={{ color: "#f87171", opacity: 1 }}>[F]/Klik</span> – útok &nbsp;·&nbsp;{" "}
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
            className="rounded-2xl p-10 text-center text-white max-w-sm"
            style={{
              background: "rgba(8,16,36,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div className="text-5xl mb-3">⏸</div>
            <h2 className="text-3xl font-bold mb-2">Hra pozastavena</h2>
            <p className="text-gray-400 text-sm mb-2">
              Klikni kamkoliv nebo stiskni tlačítko pro pokračování
            </p>
            <p className="text-gray-600 text-xs mb-6">
              Tip: napiš <span className="font-bold text-purple-400">IMPLEMENT</span> pro návrh nápadu
            </p>
            <button
              className="bg-green-600 hover:bg-green-500 transition-colors text-white font-bold px-8 py-3 rounded-xl text-lg w-full"
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
            className="rounded-2xl p-10 text-center text-white max-w-sm"
            style={{
              background: "rgba(60,10,10,0.95)",
              border: "1px solid rgba(255,80,80,0.3)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            }}
          >
            <div className="text-5xl mb-3">💀</div>
            <h2 className="text-3xl font-bold mb-2">Byl jsi poražen!</h2>
            <p className="text-gray-400 text-sm mb-2">Lišky tě dostaly…</p>
            <p className="text-gray-500 text-xs mb-6">
              Porazil jsi <span className="text-orange-400 font-bold">{gameState.foxesDefeated}</span> lišek
            </p>
            <button
              className="bg-red-700 hover:bg-red-600 transition-colors text-white font-bold px-8 py-3 rounded-xl text-lg w-full"
              onClick={() => window.location.reload()}
            >
              Zkusit znovu
            </button>
          </div>
        </div>
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
            className="rounded-2xl p-10 text-center text-white max-w-lg"
            style={{
              background: "rgba(8,16,36,0.93)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 8px 48px rgba(0,0,0,0.65)",
            }}
          >
            <div className="text-5xl mb-3">🌍</div>
            <h1 className="text-3xl font-bold mb-1">Open World</h1>
            <p className="text-gray-400 text-sm mb-5">
              Prozkoumej otevřený 3D svět s cyklem dne a noci
            </p>

            {/* Objectives grid */}
            <div
              className="rounded-xl p-4 mb-5 text-left"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-300">
                <div>🐑 Zažeň <strong className="text-white">{SHEEP_COUNT} ovcí</strong> do ohrady</div>
                <div>🌅 Dynaminký <strong className="text-white">den/noc</strong></div>
                <div>🌟 Sesbírej <strong className="text-yellow-300">{COIN_COUNT} mincí</strong></div>
                <div>🏚 Prozkoumej <strong className="text-white">ruiny</strong> a vesnici</div>
                <div>🦊 <strong className="text-orange-400">Bojuj s liškami</strong> [F] nebo kliknutím</div>
                <div>⚓ Najdi <strong className="text-white">maják</strong> na pobřeží</div>
              </div>
            </div>

            {/* Controls */}
            <div
              className="rounded-xl p-4 mb-6 text-xs text-gray-500 space-y-1.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
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
                <span>⏸ <strong className="text-gray-300">Esc</strong> – pauza</span>
                <span>💡 napiš <strong className="text-purple-400">IMPLEMENT</strong> – návrh</span>
              </div>
            </div>

            <button
              className="bg-green-600 hover:bg-green-500 transition-colors text-white font-bold px-8 py-3 rounded-xl text-lg w-full"
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
