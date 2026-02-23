"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  getTerrainHeight,
  generateSpawnPoints,
  initNoise,
  WORLD_SIZE,
  TERRAIN_SEGMENTS,
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
} from "@/lib/meshBuilders";
import type { SheepData, FoxData, CoinData, GameState } from "@/lib/gameTypes";

// ─── Constants ──────────────────────────────────────────────────────────────
const PLAYER_HEIGHT = 1.8;
const MOVE_SPEED = 10;
const SPRINT_SPEED = 20;
const GRAVITY = -25;
const JUMP_FORCE = 10;
const SHEEP_COUNT = 20;
const FOX_COUNT = 4;
const COIN_COUNT = 35;
const TREE_COUNT = 180;
const ROCK_COUNT = 90;
const SHEEP_SPEED = 2.5;
const SHEEP_FLEE_RADIUS = 12;
const SHEEP_FLEE_SPEED = 8;
const FOX_SPEED = 3.8;
const FOX_CHASE_RADIUS = 90;
const COIN_COLLECT_RADIUS = 2.2;
const FOG_NEAR = 60;
const FOG_FAR = 320;
const DAY_DURATION = 300; // seconds per full day/night cycle
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 22; // per second while sprinting
const STAMINA_REGEN = 9; // per second while walking/idle

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
  const skyMeshRef = useRef<THREE.Mesh | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    sheepCollected: 0,
    coinsCollected: 0,
    totalCoins: COIN_COUNT,
    timeElapsed: 0,
    isLocked: false,
    stamina: STAMINA_MAX,
    timeLabel: "07:12",
    direction: "N",
  });
  const [showIntro, setShowIntro] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [bleatingLabel, setBleatingLabel] = useState<string | null>(null);
  const [foxWarning, setFoxWarning] = useState(false);
  const implementBufferRef = useRef<string>("");

  const lockPointer = useCallback(() => {
    if (mountRef.current) {
      mountRef.current.requestPointerLock();
    }
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
    for (let i = 0; i < 2500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 460;
      starPositions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3)
    );
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: true });
    const stars = new THREE.Points(starGeo, starMat);
    stars.visible = false;
    scene.add(stars);
    starsRef.current = stars;

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

    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      let r: number, g: number, b: number;
      if (y < -0.5) { r = 0.2; g = 0.35; b = 0.55; }
      else if (y < 2) { r = 0.35; g = 0.6; b = 0.25; }
      else if (y < 15) { r = 0.28; g = 0.5; b = 0.2; }
      else { r = 0.55; g = 0.48; b = 0.38; }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
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
    for (let i = 0; i < 30; i++) {
      const cloud = makeCloud();
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 220;
      cloud.position.set(
        Math.cos(angle) * dist,
        48 + Math.random() * 45,
        Math.sin(angle) * dist
      );
      scene.add(cloud);
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
      const mesh = buildSheepMesh();
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      scene.add(mesh);
      return {
        mesh,
        velocity: new THREE.Vector2(0, 0),
        targetAngle: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 3,
        isFleeing: false,
        bleating: false,
        bleatTimer: 8 + Math.random() * 15,
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
    const IMPLEMENT_WORD = "IMPLEMENT";
    const onKey = (e: KeyboardEvent) => {
      keysRef.current[e.code] = e.type === "keydown";

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

        cam.position.add(move);

        cam.position.x = Math.max(
          -WORLD_SIZE / 2 + 10,
          Math.min(WORLD_SIZE / 2 - 10, cam.position.x)
        );
        cam.position.z = Math.max(
          -WORLD_SIZE / 2 + 10,
          Math.min(WORLD_SIZE / 2 - 10, cam.position.z)
        );

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

      // ── Fox AI ─────────────────────────────────────────────────────────────
      let foxNear = false;
      foxListRef.current.forEach((fox) => {
        const fm = fox.mesh;

        // Find closest non-fleeing sheep
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
          // Chase!
          const target = (closestSheep as SheepData).mesh.position;
          const dx = target.x - fm.position.x;
          const dz = target.z - fm.position.z;
          const len = Math.sqrt(dx * dx + dz * dz);
          if (len > 0.1) {
            fm.position.x += (dx / len) * FOX_SPEED * dt;
            fm.position.z += (dz / len) * FOX_SPEED * dt;
            fm.rotation.y = Math.atan2(dx, dz);
          }
          // Scare nearby sheep
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

          // Bounce off edges
          const half = WORLD_SIZE / 2 - 20;
          if (Math.abs(fm.position.x) > half) fox.wanderAngle = Math.PI - fox.wanderAngle;
          if (Math.abs(fm.position.z) > half) fox.wanderAngle = -fox.wanderAngle;
        }

        fm.position.y = getTerrainHeight(fm.position.x, fm.position.z);

        // Check if fox is near player
        if (fm.position.distanceTo(playerPos) < 18) {
          foxNear = true;
        }
      });
      setFoxWarning(foxNear);

      // ── Sheep AI ───────────────────────────────────────────────────────────
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

        if (sheep.isFleeing) {
          const angle = fleeingFromPlayer
            ? Math.atan2(-dz, -dx)
            : sheep.targetAngle;
          sheep.targetAngle = angle;
          const spd = SHEEP_FLEE_SPEED * dt;
          s.position.x += Math.cos(angle) * spd;
          s.position.z += Math.sin(angle) * spd;
          // Reset flee flag each frame (set by fox AI or player proximity)
          sheep.isFleeing = false;
        } else {
          sheep.wanderTimer -= dt;
          if (sheep.wanderTimer <= 0) {
            sheep.targetAngle += (Math.random() - 0.5) * Math.PI * 1.2;
            sheep.wanderTimer = 1.5 + Math.random() * 3;
          }
          const spd = SHEEP_SPEED * dt;
          s.position.x += Math.cos(sheep.targetAngle) * spd;
          s.position.z += Math.sin(sheep.targetAngle) * spd;

          const half = WORLD_SIZE / 2 - 20;
          if (Math.abs(s.position.x) > half) {
            sheep.targetAngle = Math.PI - sheep.targetAngle;
            s.position.x = Math.sign(s.position.x) * half;
          }
          if (Math.abs(s.position.z) > half) {
            sheep.targetAngle = -sheep.targetAngle;
            s.position.z = Math.sign(s.position.z) * half;
          }
        }

        s.position.y = getTerrainHeight(s.position.x, s.position.z);
        s.rotation.y = -sheep.targetAngle + Math.PI / 2;

        // Leg animation
        const legAnim = Math.sin(elapsed * 6 + s.position.x) * 0.3;
        s.children.forEach((child, i) => {
          if (i >= 3 && i <= 6) {
            (child as THREE.Mesh).rotation.x = (i % 2 === 0 ? 1 : -1) * legAnim;
          }
        });
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
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("resize", onResize);
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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Three.js canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-crosshair"
        onClick={lockPointer}
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

      {/* Minimap (top-right) */}
      {gameState.isLocked && (
        <canvas
          ref={minimapRef}
          width={160}
          height={160}
          className="fixed top-4 right-4 pointer-events-none"
          style={{
            border: "2px solid rgba(255,255,255,0.25)",
            borderRadius: 8,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}

      {/* HUD (top-left) */}
      {gameState.isLocked && (
        <div className="fixed top-4 left-4 pointer-events-none select-none space-y-2">
          <div
            className="rounded-xl px-4 py-3 text-white text-sm"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
          >
            <div className="font-bold text-base mb-2 flex items-center gap-2">
              <span>Open World</span>
              <span className="text-xs font-normal opacity-60">
                🕐 {gameState.timeLabel} &nbsp; 🧭 {gameState.direction}
              </span>
            </div>
            <div>
              🐑 Ohrady:{" "}
              <span className="font-bold text-green-300">
                {gameState.sheepCollected}
              </span>{" "}
              / {SHEEP_COUNT}
            </div>
            <div>
              🌟 Mince:{" "}
              <span className="font-bold text-yellow-300">
                {gameState.coinsCollected}
              </span>{" "}
              / {COIN_COUNT}
            </div>
            <div>
              ⏱ Čas: {minutes}:{String(seconds).padStart(2, "0")}
            </div>
            {gameState.sheepCollected === SHEEP_COUNT && (
              <div className="mt-2 text-yellow-300 font-bold animate-pulse">
                🎉 Všechny ovce jsou v ohradě!
              </div>
            )}
            {gameState.coinsCollected === COIN_COUNT && (
              <div className="mt-1 text-yellow-200 font-bold animate-pulse">
                💰 Všechny mince sesbírány!
              </div>
            )}
          </div>

          {/* Stamina bar */}
          <div
            className="rounded-lg px-3 py-2 text-white text-xs"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          >
            <div className="mb-1 opacity-70">
              ⚡ Výdrž {Math.round(staminaPct)}%
            </div>
            <div className="h-2 rounded-full bg-gray-700 w-32">
              <div
                className="h-2 rounded-full transition-all duration-100"
                style={{ width: `${staminaPct}%`, background: staminaColor }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Fox warning */}
      {foxWarning && gameState.isLocked && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-xl px-5 py-2 text-white font-bold text-sm animate-pulse"
            style={{ background: "rgba(180,40,0,0.7)" }}
          >
            🦊 Liška v blízkosti!
          </div>
        </div>
      )}

      {/* Controls hint */}
      {gameState.isLocked && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div
            className="rounded-lg px-3 py-2 text-white text-xs opacity-60"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            WASD – pohyb &nbsp;|&nbsp; Myš – pohled &nbsp;|&nbsp; Mezerník –
            skok &nbsp;|&nbsp; Shift – sprint &nbsp;|&nbsp; Esc – pauza &nbsp;|&nbsp;
            <span className="text-purple-300">IMPLEMENT</span> – návrh
          </div>
        </div>
      )}

      {/* Bleat popup */}
      {bleatingLabel && gameState.isLocked && (
        <div className="fixed bottom-20 right-48 pointer-events-none select-none animate-bounce">
          <div
            className="rounded-xl px-4 py-2 text-white font-bold text-lg"
            style={{ background: "rgba(0,0,0,0.5)" }}
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

      {/* Intro overlay */}
      {showIntro && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(5px)",
          }}
          onClick={lockPointer}
        >
          <div
            className="rounded-2xl p-10 text-center text-white max-w-lg"
            style={{
              background: "rgba(8,16,36,0.9)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="text-5xl mb-3">🌍</div>
            <h1 className="text-3xl font-bold mb-1">Open World</h1>
            <p className="text-gray-400 text-sm mb-4">
              Prozkoumej otevřený 3D svět s cyklem dne a noci
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-300 mb-6 text-left">
              <div className="space-y-1">
                <div>🐑 Zažeň <strong className="text-white">{SHEEP_COUNT} ovcí</strong> do ohrady</div>
                <div>🌟 Sesbírej <strong className="text-yellow-300">{COIN_COUNT} mincí</strong></div>
                <div>🦊 Dej si pozor na <strong className="text-orange-400">lišky</strong>!</div>
              </div>
              <div className="space-y-1">
                <div>🌅 Dynaminký <strong className="text-white">den/noc</strong></div>
                <div>🏚 Prozkoumej <strong className="text-white">ruiny</strong> a vesnici</div>
                <div>⚓ Najdi <strong className="text-white">maják</strong> na pobřeží</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-5 space-y-0.5">
              <div>🕹 <strong className="text-gray-300">WASD</strong> – pohyb &nbsp; 🖱 <strong className="text-gray-300">Myš</strong> – pohled</div>
              <div>⬆ <strong className="text-gray-300">Mezerník</strong> – skok &nbsp; 💨 <strong className="text-gray-300">Shift</strong> – sprint</div>
              <div>⏸ <strong className="text-gray-300">Esc</strong> – pauza &nbsp; 💡 napiš <strong className="text-purple-400">IMPLEMENT</strong> – návrh</div>
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
