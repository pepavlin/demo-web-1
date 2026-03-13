"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ── Material helpers ────────────────────────────────────────────────────────
const hullMat = (color: number, roughness = 0.85, metalness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

// ── Procedural ship geometry ────────────────────────────────────────────────

/** Create the massive outer ring – the most iconic District 9 element */
function createOuterRing(scene: THREE.Scene) {
  const group = new THREE.Group();

  // Primary torus – huge outer ring
  const torusGeo = new THREE.TorusGeometry(95, 8, 12, 80);
  const torusMat = hullMat(0x2e2820, 0.9, 0.5);
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.rotation.x = Math.PI / 2;
  group.add(torus);

  // Inner structural ring
  const innerGeo = new THREE.TorusGeometry(72, 4, 8, 64);
  const inner = new THREE.Mesh(innerGeo, hullMat(0x252018, 0.92, 0.45));
  inner.rotation.x = Math.PI / 2;
  group.add(inner);

  // Outer accent ring (thinner, slightly below)
  const accentGeo = new THREE.TorusGeometry(103, 2, 6, 80);
  const accent = new THREE.Mesh(accentGeo, hullMat(0x3a2e22, 0.88, 0.55));
  accent.rotation.x = Math.PI / 2;
  accent.position.y = -3;
  group.add(accent);

  scene.add(group);
  return group;
}

/** Massive central hub – layered cylinder cluster */
function createCentralHub(scene: THREE.Scene) {
  const group = new THREE.Group();

  // Base dome (underside)
  const domeGeo = new THREE.SphereGeometry(28, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, hullMat(0x1e1c18, 0.95, 0.4));
  dome.position.y = -2;
  group.add(dome);

  // Central cylinder
  const cylGeo = new THREE.CylinderGeometry(20, 24, 18, 16);
  const cyl = new THREE.Mesh(cylGeo, hullMat(0x2a2420, 0.88, 0.55));
  group.add(cyl);

  // Upper cone / cap
  const capGeo = new THREE.ConeGeometry(18, 22, 16);
  const cap = new THREE.Mesh(capGeo, hullMat(0x242018, 0.9, 0.5));
  cap.position.y = 18;
  group.add(cap);

  // Mid-level ring collar
  const collarGeo = new THREE.TorusGeometry(25, 3, 8, 32);
  const collar = new THREE.Mesh(collarGeo, hullMat(0x382e24, 0.85, 0.6));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 2;
  group.add(collar);

  // Asymmetric blister (organic bump, offset)
  const blister1 = new THREE.Mesh(
    new THREE.SphereGeometry(8, 10, 8),
    hullMat(0x201e1a, 0.95, 0.35)
  );
  blister1.position.set(18, -5, 8);
  group.add(blister1);

  const blister2 = new THREE.Mesh(
    new THREE.SphereGeometry(6, 10, 8),
    hullMat(0x201e1a, 0.95, 0.35)
  );
  blister2.position.set(-14, -8, 14);
  group.add(blister2);

  scene.add(group);
  return group;
}

/** Radial structural arms connecting hub to outer ring */
function createArms(scene: THREE.Scene) {
  const group = new THREE.Group();

  const armAngles = [0, 51, 103, 155, 205, 257, 308];
  const armWidths = [5, 3.5, 4.5, 3, 5.5, 3.5, 4];
  const armHeights = [6, 4, 5, 4.5, 7, 3.5, 5];

  armAngles.forEach((angleDeg, i) => {
    const angle = (angleDeg * Math.PI) / 180;
    const len = 70;
    const geo = new THREE.BoxGeometry(armWidths[i], armHeights[i], len);
    const mesh = new THREE.Mesh(geo, hullMat(0x28221e + i * 0x010000, 0.9, 0.5));
    mesh.position.set(
      Math.cos(angle) * (len / 2 + 22),
      -2 - i * 0.5,
      Math.sin(angle) * (len / 2 + 22)
    );
    mesh.rotation.y = -angle;
    group.add(mesh);

    // Secondary cross-brace
    if (i % 2 === 0) {
      const braceGeo = new THREE.BoxGeometry(2.5, 3, len * 0.6);
      const brace = new THREE.Mesh(braceGeo, hullMat(0x201c18, 0.92, 0.45));
      brace.position.set(
        Math.cos(angle) * (len * 0.3 + 22),
        -6,
        Math.sin(angle) * (len * 0.3 + 22)
      );
      brace.rotation.y = -angle;
      group.add(brace);
    }
  });

  scene.add(group);
  return group;
}

/** Hanging mechanical tendrils and structural mass hanging below the ring */
function createHangingElements(scene: THREE.Scene) {
  const group = new THREE.Group();

  // Large hanging mass modules (irregular)
  const hangPositions = [
    { x: 40, z: 60, rx: 0.1, rz: 0.08, sy: 1.2, w: 12, h: 20, d: 16 },
    { x: -55, z: 30, rx: -0.08, rz: 0.12, sy: 1.0, w: 10, h: 25, d: 12 },
    { x: 70, z: -20, rx: 0.05, rz: -0.1, sy: 1.1, w: 8, h: 18, d: 10 },
    { x: -30, z: -70, rx: 0.12, rz: 0.06, sy: 0.9, w: 14, h: 22, d: 18 },
    { x: 10, z: 85, rx: -0.06, rz: -0.08, sy: 1.3, w: 9, h: 16, d: 11 },
    { x: -80, z: -40, rx: 0.09, rz: 0.15, sy: 1.0, w: 11, h: 19, d: 14 },
    { x: 60, z: 70, rx: -0.12, rz: 0.07, sy: 1.1, w: 7, h: 14, d: 9 },
    { x: -20, z: 95, rx: 0.08, rz: -0.11, sy: 0.95, w: 13, h: 21, d: 15 },
  ];

  hangPositions.forEach(({ x, z, rx, rz, sy, w, h, d }) => {
    const geo = new THREE.BoxGeometry(w, h * sy, d);
    const mat = hullMat(0x1c1814, 0.95, 0.4);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, -12 - h * sy * 0.5, z);
    mesh.rotation.x = rx;
    mesh.rotation.z = rz;
    group.add(mesh);

    // Small accent box below each module
    const accentGeo = new THREE.BoxGeometry(w * 0.6, h * 0.3, d * 0.6);
    const accent = new THREE.Mesh(accentGeo, hullMat(0x251f1b, 0.93, 0.45));
    accent.position.set(x + 1, -12 - h * sy - h * 0.2, z - 1);
    group.add(accent);
  });

  // Thin structural tubes / pipes
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + (i * 0.3);
    const r = 45 + Math.sin(i * 1.7) * 30;
    const h = 8 + Math.cos(i * 2.3) * 5;
    const geo = new THREE.CylinderGeometry(0.5, 0.8, h, 5);
    const mesh = new THREE.Mesh(geo, hullMat(0x1a1612, 0.95, 0.5));
    mesh.position.set(
      Math.cos(angle) * r,
      -10 - h * 0.5,
      Math.sin(angle) * r
    );
    group.add(mesh);
  }

  scene.add(group);
  return group;
}

/** Underside panel detail – flat panels covering parts of the hull */
function createUndersidePanels(scene: THREE.Scene) {
  const group = new THREE.Group();

  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = 30 + (i % 5) * 10;
    const w = 8 + (i % 3) * 4;
    const d = 6 + (i % 4) * 3;
    const geo = new THREE.BoxGeometry(w, 1, d);
    const mat = hullMat(
      i % 3 === 0 ? 0x1e1c18 : i % 3 === 1 ? 0x252018 : 0x1a1814,
      0.95,
      0.45
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      Math.cos(angle) * r,
      -4 - (i % 4) * 1.5,
      Math.sin(angle) * r
    );
    mesh.rotation.y = angle + (i * 0.2);
    group.add(mesh);
  }

  scene.add(group);
  return group;
}

/** Orange/amber lights on the underside – iconic District 9 glow */
function createShipLights(scene: THREE.Scene): { meshes: THREE.Mesh[]; lights: THREE.PointLight[] } {
  const meshes: THREE.Mesh[] = [];
  const lights: THREE.PointLight[] = [];

  const positions = [
    { x: 0, y: -8, z: 0, intensity: 20, color: 0xff8833 },       // central
    { x: 45, y: -6, z: 20, intensity: 15, color: 0xff6622 },
    { x: -50, y: -7, z: -15, intensity: 16, color: 0xffaa44 },
    { x: 20, y: -5, z: -60, intensity: 14, color: 0xff7733 },
    { x: -25, y: -6, z: 55, intensity: 15, color: 0xff5511 },
    { x: 70, y: -5, z: -40, intensity: 13, color: 0xffbb55 },
    { x: -65, y: -7, z: 45, intensity: 14, color: 0xff6633 },
    { x: 30, y: -4, z: 80, intensity: 12, color: 0xff8844 },
    { x: -80, y: -5, z: -30, intensity: 13, color: 0xff5522 },
    { x: 55, y: -6, z: -70, intensity: 12, color: 0xffaa33 },
    // Smaller accent lights
    { x: 12, y: -5, z: 35, intensity: 8, color: 0xff7722 },
    { x: -35, y: -4, z: -50, intensity: 8, color: 0xff6611 },
    { x: 80, y: -5, z: 10, intensity: 10, color: 0xffcc55 },
    { x: -15, y: -6, z: -85, intensity: 10, color: 0xff8833 },
  ];

  positions.forEach(({ x, y, z, intensity, color }) => {
    // Visible glow sphere
    const geo = new THREE.SphereGeometry(1.5 + intensity * 0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    meshes.push(mesh);

    // Actual light source (increased range for better coverage)
    const light = new THREE.PointLight(color, intensity, 120, 2);
    light.position.set(x, y, z);
    lights.push(light);
  });

  return { meshes, lights };
}

/** Porthole / window lights – rows of small glowing spheres along arms and hub */
function createPortholeLights(scene: THREE.Scene): { meshes: THREE.Mesh[]; lights: THREE.PointLight[] } {
  void scene;
  const meshes: THREE.Mesh[] = [];
  const lights: THREE.PointLight[] = [];

  // Windows along the 7 radial arms
  const armAngles = [0, 51, 103, 155, 205, 257, 308];
  armAngles.forEach((angleDeg, armIdx) => {
    const angle = (angleDeg * Math.PI) / 180;
    const windowColors = [0xaaccff, 0x88bbff, 0xffffff, 0xbbddff];
    // Place 5 windows per arm, spread across arm length
    for (let w = 0; w < 5; w++) {
      const dist = 28 + w * 12; // distance from center
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = 2 + (w % 2 === 0 ? 1.5 : -1.5);
      const color = windowColors[(armIdx + w) % windowColors.length];

      const geo = new THREE.SphereGeometry(0.7, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      meshes.push(mesh);

      // Every other window gets a small point light
      if (w % 2 === 0) {
        const light = new THREE.PointLight(color, 4, 30, 2);
        light.position.set(x, y, z);
        lights.push(light);
      }
    }
  });

  // Ring of windows around the central hub
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const r = 21;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = 3;
    const color = i % 4 === 0 ? 0xffffff : i % 4 === 1 ? 0xaaddff : i % 4 === 2 ? 0x88bbff : 0xccccff;

    const geo = new THREE.SphereGeometry(0.6, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    meshes.push(mesh);

    if (i % 4 === 0) {
      const light = new THREE.PointLight(color, 5, 35, 2);
      light.position.set(x, y, z);
      lights.push(light);
    }
  }

  // Outer ring accent lights (evenly spaced around the torus)
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = 95;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = -2;
    const warm = i % 3 === 0;
    const color = warm ? 0xff9944 : 0x6699ff;

    const geo = new THREE.SphereGeometry(0.8, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    meshes.push(mesh);

    if (i % 3 === 0) {
      const light = new THREE.PointLight(color, 6, 40, 2);
      light.position.set(x, y, z);
      lights.push(light);
    }
  }

  return { meshes, lights };
}

/** Central reactor glow – blue-white light from the hub underside */
function createReactorGlow(): { mesh: THREE.Mesh; light: THREE.PointLight } {
  // Glowing core sphere
  const geo = new THREE.SphereGeometry(4, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0x66aaff });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -14, 0);

  // Strong blue-white point light
  const light = new THREE.PointLight(0x4488ff, 30, 160, 1.8);
  light.position.set(0, -14, 0);

  return { mesh, light };
}

/** Floating debris particles around the ship */
function createDebrisField(): THREE.Points {
  const count = 600;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 80;
    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = Math.sin(theta) * r;
    sizes[i] = 0.3 + Math.random() * 1.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    color: 0x8a7a6a,
    size: 0.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.5,
  });

  return new THREE.Points(geo, mat);
}

/** Slow-drifting atmospheric haze particles below the ship */
function createHazeParticles(): THREE.Points {
  const count = 300;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 300;
    positions[i * 3 + 1] = -20 + Math.random() * 15;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0x556677,
      size: 2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.15,
    })
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function MotherShip() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // ── Scene & Fog ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060f);
    scene.fog = new THREE.FogExp2(0x080c1a, 0.003);

    // ── Camera ────────────────────────────────────────────────────────────
    // Positioned at ground level, tilted upward to make the ship fill the sky
    const camera = new THREE.PerspectiveCamera(
      82,
      canvas.clientWidth / canvas.clientHeight,
      0.5,
      2000
    );
    camera.position.set(0, 0, 0);
    // Look up-and-slightly-forward so the ship dominates the upper frame
    camera.lookAt(0, 80, -20);

    // ── Ambient & Directional Light ───────────────────────────────────────
    const ambient = new THREE.AmbientLight(0x2a3050, 1.5);
    scene.add(ambient);

    // Orange glow from city fires below
    const cityGlow = new THREE.DirectionalLight(0xff6633, 0.8);
    cityGlow.position.set(0, -1, 0);
    scene.add(cityGlow);

    // Cold edge light – distant overcast sun
    const edgeLight = new THREE.DirectionalLight(0x8899bb, 0.6);
    edgeLight.position.set(-1, 0.2, 1);
    scene.add(edgeLight);

    // ── Ship Group (all ship geometry) ────────────────────────────────────
    const shipGroup = new THREE.Group();
    shipGroup.position.set(0, 80, -30); // high above, slightly back

    const outerRing = createOuterRing(scene);
    scene.remove(outerRing);
    shipGroup.add(outerRing);

    const centralHub = createCentralHub(scene);
    scene.remove(centralHub);
    shipGroup.add(centralHub);

    const arms = createArms(scene);
    scene.remove(arms);
    shipGroup.add(arms);

    const hangingElements = createHangingElements(scene);
    scene.remove(hangingElements);
    shipGroup.add(hangingElements);

    const underpanels = createUndersidePanels(scene);
    scene.remove(underpanels);
    shipGroup.add(underpanels);

    // Orange/amber underside lights
    const { meshes: lightMeshes, lights: lightObjects } = createShipLights(scene);
    lightMeshes.forEach((m) => shipGroup.add(m));
    lightObjects.forEach((l) => shipGroup.add(l));

    // Porthole / window lights
    const { meshes: portholeMeshes, lights: portholeObjects } = createPortholeLights(scene);
    portholeMeshes.forEach((m) => shipGroup.add(m));
    portholeObjects.forEach((l) => shipGroup.add(l));

    // Central reactor glow
    const { mesh: reactorMesh, light: reactorLight } = createReactorGlow();
    shipGroup.add(reactorMesh);
    shipGroup.add(reactorLight);

    scene.add(shipGroup);

    // ── Particle fields (in world space, not moving with ship) ────────────
    const debris = createDebrisField();
    debris.position.set(0, 80, -30);
    scene.add(debris);

    const haze = createHazeParticles();
    scene.add(haze);

    // ── Stars ─────────────────────────────────────────────────────────────
    // Distant stars (very few – overcast atmosphere)
    {
      const count = 120;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.45; // only top half
        const r = 800;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(
        new THREE.Points(
          geo,
          new THREE.PointsMaterial({ color: 0xaabbcc, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.5 })
        )
      );
    }

    // ── Resize handler ────────────────────────────────────────────────────
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Animation loop ────────────────────────────────────────────────────
    let frameId: number;
    let lastTime = 0;

    const animate = (time: number) => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const t = time * 0.001;

      // Ultra-slow ship rotation – takes ~5 minutes for full rotation
      shipGroup.rotation.y = t * 0.018;

      // Gentle bob / sway
      shipGroup.position.y = 80 + Math.sin(t * 0.12) * 1.2;
      shipGroup.rotation.z = Math.sin(t * 0.07) * 0.008;

      // Debris particles orbit with the ship but faster
      debris.rotation.y = t * 0.025;

      // Haze drift
      haze.position.x = Math.sin(t * 0.04) * 5;

      // Flickering orange/amber lights
      lightObjects.forEach((l, i) => {
        if (!(l as { _base?: number })._base) {
          (l as { _base?: number })._base = l.intensity;
        }
        const flicker = 0.85 + Math.sin(t * (1.2 + i * 0.37) + i) * 0.15;
        l.intensity = ((l as { _base?: number })._base ?? l.intensity) * flicker;
      });

      // Gentle pulse on porthole lights
      portholeObjects.forEach((l, i) => {
        if (!(l as { _base?: number })._base) {
          (l as { _base?: number })._base = l.intensity;
        }
        const pulse = 0.9 + Math.sin(t * (0.6 + i * 0.2) + i * 1.3) * 0.1;
        l.intensity = ((l as { _base?: number })._base ?? l.intensity) * pulse;
      });

      // Reactor slow breathing
      if (!(reactorLight as { _base?: number })._base) {
        (reactorLight as { _base?: number })._base = reactorLight.intensity;
      }
      const reactorBreath = 0.8 + Math.sin(t * 0.4) * 0.2;
      reactorLight.intensity = ((reactorLight as { _base?: number })._base ?? reactorLight.intensity) * reactorBreath;

      renderer.render(scene, camera);

      // suppress unused variable warning
      void dt;
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="mothership-canvas"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        zIndex: 0,
      }}
    />
  );
}
