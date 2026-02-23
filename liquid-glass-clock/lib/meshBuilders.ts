import * as THREE from "three";

// ─── Sheep ────────────────────────────────────────────────────────────────────
export function buildSheepMesh(): THREE.Group {
  const group = new THREE.Group();
  const woolColor = new THREE.Color(0xeeeeee);
  const darkColor = new THREE.Color(0x222222);
  const wool = new THREE.MeshLambertMaterial({ color: woolColor });
  const dark = new THREE.MeshLambertMaterial({ color: darkColor });

  const bodyGeo = new THREE.SphereGeometry(0.5, 8, 6);
  bodyGeo.scale(1.4, 1, 1);
  const body = new THREE.Mesh(bodyGeo, wool);
  body.position.y = 0.7;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.28, 7, 6);
  const head = new THREE.Mesh(headGeo, wool);
  head.position.set(0.65, 1.0, 0);
  group.add(head);

  const eyeGeo = new THREE.SphereGeometry(0.05, 5, 5);
  const leftEye = new THREE.Mesh(eyeGeo, dark);
  leftEye.position.set(0.88, 1.08, 0.16);
  const rightEye = new THREE.Mesh(eyeGeo, dark);
  rightEye.position.set(0.88, 1.08, -0.16);
  group.add(leftEye, rightEye);

  const legGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6);
  const positions: [number, number, number][] = [
    [0.3, 0.25, 0.3], [0.3, 0.25, -0.3],
    [-0.3, 0.25, 0.3], [-0.3, 0.25, -0.3],
  ];
  positions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(x, y, z);
    group.add(leg);
  });

  group.castShadow = true;
  group.scale.setScalar(0.8);
  return group;
}

// ─── Fox ──────────────────────────────────────────────────────────────────────
export function buildFoxMesh(): THREE.Group {
  const group = new THREE.Group();
  const foxMat = new THREE.MeshLambertMaterial({ color: 0xd4622a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

  // Body
  const bodyGeo = new THREE.SphereGeometry(0.38, 8, 6);
  bodyGeo.scale(1.5, 0.85, 1);
  const body = new THREE.Mesh(bodyGeo, foxMat);
  body.position.y = 0.55;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.3, 7, 6);
  const head = new THREE.Mesh(headGeo, foxMat);
  head.position.set(0.6, 0.75, 0);
  group.add(head);

  // Snout
  const snoutGeo = new THREE.BoxGeometry(0.25, 0.12, 0.18);
  const snout = new THREE.Mesh(snoutGeo, foxMat);
  snout.position.set(0.9, 0.72, 0);
  group.add(snout);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.05, 5, 5);
  [-0.13, 0.13].forEach((z) => {
    const eye = new THREE.Mesh(eyeGeo, darkMat);
    eye.position.set(0.82, 0.84, z);
    group.add(eye);
  });

  // Ears
  const earGeo = new THREE.ConeGeometry(0.1, 0.22, 4);
  [-0.15, 0.15].forEach((z) => {
    const ear = new THREE.Mesh(earGeo, foxMat);
    ear.position.set(0.5, 1.05, z);
    group.add(ear);
  });

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.4, 6);
  const legPositions: [number, number, number][] = [
    [0.22, 0.2, 0.25], [0.22, 0.2, -0.25],
    [-0.22, 0.2, 0.25], [-0.22, 0.2, -0.25],
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(x, y, z);
    group.add(leg);
  });

  // Tail
  const tailGeo = new THREE.CylinderGeometry(0.05, 0.12, 0.7, 6);
  const tail = new THREE.Mesh(tailGeo, foxMat);
  tail.rotation.z = Math.PI / 3;
  tail.position.set(-0.75, 0.8, 0);
  group.add(tail);

  // Tail tip (white)
  const tailTipGeo = new THREE.SphereGeometry(0.13, 6, 5);
  const tailTip = new THREE.Mesh(tailTipGeo, whiteMat);
  tailTip.position.set(-1.1, 1.05, 0);
  group.add(tailTip);

  group.castShadow = true;
  group.scale.setScalar(0.9);
  return group;
}

// ─── Tree ─────────────────────────────────────────────────────────────────────
export function buildTreeMesh(rng: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunkH = 1.5 + rng() * 2;
  const trunkR = 0.12 + rng() * 0.08;

  const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5d3a1a });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  group.add(trunk);

  const leafColors = [0x2d5a1b, 0x3a7a20, 0x1e4012, 0x4a9030];
  const leafColor = leafColors[Math.floor(rng() * leafColors.length)];
  const leafMat = new THREE.MeshLambertMaterial({ color: leafColor });

  const tiers = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < tiers; i++) {
    const r = (1.2 - i * 0.25) * (0.8 + rng() * 0.5);
    const h = (0.9 - i * 0.15) * (1 + rng() * 0.4);
    const leafGeo = new THREE.ConeGeometry(r, h, 8);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = trunkH + i * (h * 0.55);
    leaves.castShadow = true;
    group.add(leaves);
  }

  return group;
}

// ─── Rock ─────────────────────────────────────────────────────────────────────
export function buildRockMesh(rng: () => number): THREE.Mesh {
  const geo = new THREE.DodecahedronGeometry(0.3 + rng() * 0.5, 0);
  geo.scale(1 + rng() * 0.5, 0.6 + rng() * 0.5, 1 + rng() * 0.5);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(0.45 + rng() * 0.1, 0.42 + rng() * 0.1, 0.4 + rng() * 0.1),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ─── Coin ─────────────────────────────────────────────────────────────────────
export function buildCoinMesh(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12);
  const mat = new THREE.MeshLambertMaterial({
    color: 0xffd700,
    emissive: 0x886600,
    emissiveIntensity: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  return mesh;
}

// ─── Windmill ─────────────────────────────────────────────────────────────────
export function buildWindmill(): { group: THREE.Group; blades: THREE.Group } {
  const group = new THREE.Group();

  const towerMat = new THREE.MeshLambertMaterial({ color: 0xd4c4a0 });
  const towerGeo = new THREE.CylinderGeometry(0.7, 1.1, 10, 8);
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.y = 5;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const capMat = new THREE.MeshLambertMaterial({ color: 0x8b3a0a });
  const capGeo = new THREE.ConeGeometry(1.4, 2.2, 8);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 11.1;
  cap.castShadow = true;
  group.add(cap);

  // Door
  const doorGeo = new THREE.BoxGeometry(0.7, 1.4, 0.15);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x5a3010 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 0.7, 1.12);
  group.add(door);

  // Blades
  const blades = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xc8a060, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const bladeGeo = new THREE.BoxGeometry(0.18, 3.2, 0.06);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 1.6;
    blade.castShadow = true;
    const pivot = new THREE.Group();
    pivot.rotation.z = (i * Math.PI) / 2;
    pivot.add(blade);
    blades.add(pivot);
  }
  blades.position.set(0, 9.8, 1.15);
  group.add(blades);

  return { group, blades };
}

// ─── House / Barn ─────────────────────────────────────────────────────────────
export function buildHouse(rng: () => number): THREE.Group {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xd4c4a0 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b2020 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x99ccee, transparent: true, opacity: 0.7 });

  // Main walls
  const wallGeo = new THREE.BoxGeometry(7, 4.5, 5.5);
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = 2.25;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Gable ends
  const gableGeo = new THREE.CylinderGeometry(0, 4, 2.5, 4);
  const gable = new THREE.Mesh(gableGeo, roofMat);
  gable.rotation.y = Math.PI / 4;
  gable.position.y = 5.75;
  gable.castShadow = true;
  group.add(gable);

  // Door
  const doorGeo = new THREE.BoxGeometry(1.1, 2.2, 0.15);
  const door = new THREE.Mesh(doorGeo, darkMat);
  door.position.set(0.5, 1.1, 2.83);
  group.add(door);

  // Windows x2
  [[-2.5, 2.5, 2.83], [2.5, 2.5, 2.83]].forEach(([x, y, z]) => {
    const winGeo = new THREE.BoxGeometry(1.1, 0.9, 0.15);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(x, y, z);
    group.add(win);
    // Window frame
    const frameGeo = new THREE.BoxGeometry(1.2, 1.0, 0.12);
    const frame = new THREE.Mesh(frameGeo, darkMat);
    frame.position.set(x, y, z - 0.05);
    group.add(frame);
  });

  // Chimney
  const chimneyGeo = new THREE.BoxGeometry(0.5, 1.8, 0.5);
  const chimney = new THREE.Mesh(chimneyGeo, wallMat);
  chimney.position.set(-2, 6.5, 0.8);
  chimney.castShadow = true;
  group.add(chimney);

  // Smoke effect placeholder (just a dark disc)
  const smokeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
  const smokeMat = new THREE.MeshLambertMaterial({ color: 0x888888, transparent: true, opacity: 0.6 });
  const smoke = new THREE.Mesh(smokeGeo, smokeMat);
  smoke.position.set(-2, 7.5, 0.8);
  group.add(smoke);

  void rng; // rng reserved for future variation
  return group;
}

// ─── Ancient Ruins ────────────────────────────────────────────────────────────
export function buildRuins(rng: () => number): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x999088 });
  const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x6a6058 });

  // Broken walls
  const w1H = 2.5 + rng() * 2;
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(8, w1H, 0.7), stoneMat);
  w1.position.set(0, w1H / 2, 0);
  w1.rotation.y = (rng() - 0.5) * 0.15;
  w1.castShadow = true;
  group.add(w1);

  // Side wall (partial)
  const w2H = 1.8 + rng() * 1.5;
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, w2H, 6), stoneMat);
  w2.position.set(4, w2H / 2, -3);
  w2.castShadow = true;
  group.add(w2);

  // Arch remnant
  const archBaseL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), darkStoneMat);
  archBaseL.position.set(-2, 1.75, 0.1);
  archBaseL.castShadow = true;
  group.add(archBaseL);

  const archBaseR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), darkStoneMat);
  archBaseR.position.set(2, 1.75, 0.1);
  archBaseR.castShadow = true;
  group.add(archBaseR);

  const archTop = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 0.8), darkStoneMat);
  archTop.position.set(0, 3.9, 0.1);
  archTop.castShadow = true;
  group.add(archTop);

  // Columns
  for (let i = 0; i < 3; i++) {
    const colH = 2 + rng() * 3;
    const colGeo = new THREE.CylinderGeometry(0.35, 0.4, colH, 8);
    const col = new THREE.Mesh(colGeo, stoneMat);
    col.position.set(-6 + i * 3 + rng() * 0.5, colH / 2, 4 + (rng() - 0.5) * 2);
    col.rotation.z = (rng() - 0.5) * 0.12;
    col.castShadow = true;
    group.add(col);
    // Capital
    const capGeo = new THREE.BoxGeometry(0.9, 0.3, 0.9);
    const capMesh = new THREE.Mesh(capGeo, darkStoneMat);
    capMesh.position.set(col.position.x, col.position.y + colH / 2 + 0.15, col.position.z);
    capMesh.castShadow = true;
    group.add(capMesh);
  }

  // Scattered debris
  for (let i = 0; i < 6; i++) {
    const r = 0.25 + rng() * 0.45;
    const debrisGeo = new THREE.DodecahedronGeometry(r, 0);
    const debris = new THREE.Mesh(debrisGeo, stoneMat);
    debris.position.set(
      (rng() - 0.5) * 12,
      r * 0.3,
      (rng() - 0.5) * 10
    );
    debris.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    debris.castShadow = true;
    group.add(debris);
  }

  return group;
}

// ─── Lighthouse ───────────────────────────────────────────────────────────────
export function buildLighthouse(): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xffff88, emissive: 0xffff00, emissiveIntensity: 0.5 });

  // Base
  const baseGeo = new THREE.CylinderGeometry(1.8, 2.2, 1.2, 12);
  const base = new THREE.Mesh(baseGeo, bodyMat);
  base.position.y = 0.6;
  base.castShadow = true;
  group.add(base);

  // Tower (alternating white/red bands via 3 segments)
  const bandH = 3;
  const mats = [bodyMat, redMat, bodyMat, redMat, bodyMat];
  for (let i = 0; i < 5; i++) {
    const topR = i === 4 ? 0.85 : 1.0;
    const botR = i === 0 ? 1.15 : 1.0;
    const bandGeo = new THREE.CylinderGeometry(topR, botR, bandH, 12);
    const band = new THREE.Mesh(bandGeo, mats[i]);
    band.position.y = 1.2 + i * bandH + bandH / 2;
    band.castShadow = true;
    group.add(band);
  }

  // Lantern room
  const lanternGeo = new THREE.CylinderGeometry(1.3, 1.1, 1.8, 12);
  const lantern = new THREE.Mesh(lanternGeo, glassMat);
  lantern.position.y = 1.2 + 5 * bandH + 0.9;
  group.add(lantern);

  // Dome
  const domeGeo = new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, redMat);
  dome.position.y = 1.2 + 5 * bandH + 1.8;
  dome.castShadow = true;
  group.add(dome);

  return group;
}
