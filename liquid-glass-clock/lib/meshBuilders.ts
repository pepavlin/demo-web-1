import * as THREE from "three";

// ─── Sheep ────────────────────────────────────────────────────────────────────

export interface SheepMeshParts {
  group: THREE.Group;
  /** Four leg pivot groups. Each pivots around its top (hip joint).
   *  Index: 0=front-right, 1=front-left, 2=back-right, 3=back-left
   *  Diagonal pairs for natural walk: (0,3) and (1,2)
   */
  legPivots: THREE.Group[];
  /** Head group — pivot origin is at the neck so rotation.z nods the head. */
  headGroup: THREE.Group;
  /** Wrapper around body sphere so it can bounce vertically. */
  bodyGroup: THREE.Group;
  /** Tail group — pivot origin is at the rump so rotation.y wags the tail. */
  tailGroup: THREE.Group;
}

export function buildSheepMesh(): SheepMeshParts {
  const group = new THREE.Group();

  const woolMat  = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const faceMat  = new THREE.MeshLambertMaterial({ color: 0xd4b896 }); // warm tan face
  const darkMat  = new THREE.MeshLambertMaterial({ color: 0x1a1008 }); // legs/hooves
  const eyeMat   = new THREE.MeshLambertMaterial({ color: 0x0a0808 });
  const noseMat  = new THREE.MeshLambertMaterial({ color: 0xc08060 });

  // ── Body group (so it can bounce) ─────────────────────────────────────────
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0;
  group.add(bodyGroup);

  // Main wool body — fluffy ovoid
  const bodyGeo = new THREE.SphereGeometry(0.52, 10, 8);
  bodyGeo.scale(1.35, 1.0, 1.0);
  const bodyMesh = new THREE.Mesh(bodyGeo, woolMat);
  bodyMesh.position.y = 0.72;
  bodyMesh.castShadow = true;
  bodyGroup.add(bodyMesh);

  // Rump wool bump (makes the back look fluffier)
  const rumpGeo = new THREE.SphereGeometry(0.36, 8, 6);
  rumpGeo.scale(1.0, 0.85, 1.0);
  const rump = new THREE.Mesh(rumpGeo, woolMat);
  rump.position.set(-0.45, 0.82, 0);
  bodyGroup.add(rump);

  // ── Tail group ─────────────────────────────────────────────────────────────
  // Pivot at the rump attachment point
  const tailGroup = new THREE.Group();
  tailGroup.position.set(-0.78, 0.82, 0);
  bodyGroup.add(tailGroup);

  const tailGeo = new THREE.SphereGeometry(0.14, 6, 5);
  tailGeo.scale(0.8, 0.8, 1.0);
  const tailMesh = new THREE.Mesh(tailGeo, woolMat);
  tailMesh.position.set(-0.1, 0.06, 0);  // hangs slightly behind/up
  tailGroup.add(tailMesh);

  // ── Head group ─────────────────────────────────────────────────────────────
  // Pivot at neck so rotation.z rocks head forward/back naturally
  const headGroup = new THREE.Group();
  headGroup.position.set(0.55, 0.88, 0); // neck attachment point
  bodyGroup.add(headGroup);

  // Wool cap on head
  const woolCapGeo = new THREE.SphereGeometry(0.24, 8, 6);
  const woolCap = new THREE.Mesh(woolCapGeo, woolMat);
  woolCap.position.set(0.08, 0.2, 0);
  woolCap.castShadow = true;
  headGroup.add(woolCap);

  // Face
  const faceGeo = new THREE.SphereGeometry(0.2, 8, 6);
  faceGeo.scale(1.2, 0.9, 1.0);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(0.18, 0.06, 0);
  headGroup.add(face);

  // Ears (one each side)
  const earGeo = new THREE.SphereGeometry(0.09, 6, 5);
  earGeo.scale(0.6, 1.0, 1.6);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(earGeo, faceMat);
    ear.position.set(0.05, 0.14, side * 0.22);
    ear.rotation.x = side * 0.35;
    headGroup.add(ear);
  });

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.045, 6, 5);
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0.33, 0.1, side * 0.13);
    headGroup.add(eye);
    // Eye shine
    const shineGeo = new THREE.SphereGeometry(0.015, 4, 4);
    const shineMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const shine = new THREE.Mesh(shineGeo, shineMat);
    shine.position.set(0.355, 0.115, side * 0.125);
    headGroup.add(shine);
  });

  // Nostrils
  const nostrilGeo = new THREE.SphereGeometry(0.025, 4, 4);
  [-1, 1].forEach((side) => {
    const nostril = new THREE.Mesh(nostrilGeo, noseMat);
    nostril.position.set(0.37, -0.02, side * 0.06);
    headGroup.add(nostril);
  });

  // ── Legs (4 pivot groups) ──────────────────────────────────────────────────
  const HIP_Y   = 0.56; // y-level of hip joint in group space
  const LEG_H   = 0.52; // leg height
  const HOOF_R  = 0.085;
  // positions: [x, z] for each leg (x=forward/back, z=left/right)
  // 0=front-right, 1=front-left, 2=back-right, 3=back-left
  const legXZ: [number, number][] = [
    [ 0.28, -0.28], // front-right
    [ 0.28,  0.28], // front-left
    [-0.28, -0.28], // back-right
    [-0.28,  0.28], // back-left
  ];

  const legGeo   = new THREE.CylinderGeometry(0.065, 0.055, LEG_H, 6);
  const hoofGeo  = new THREE.SphereGeometry(HOOF_R, 6, 5);
  hoofGeo.scale(1.1, 0.6, 1.1);

  const legPivots: THREE.Group[] = [];
  legXZ.forEach(([lx, lz]) => {
    const pivot = new THREE.Group();
    pivot.position.set(lx, HIP_Y, lz);
    bodyGroup.add(pivot);

    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.y = -LEG_H / 2;  // hangs down from pivot
    leg.castShadow = true;
    pivot.add(leg);

    const hoof = new THREE.Mesh(hoofGeo, darkMat);
    hoof.position.y = -LEG_H - 0.04;
    pivot.add(hoof);

    legPivots.push(pivot);
  });

  group.castShadow = true;
  group.scale.setScalar(0.82);
  return { group, legPivots, headGroup, bodyGroup, tailGroup };
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

export interface TreeMeshResult {
  group: THREE.Group;
  /** Sub-group containing only the foliage — animate this for wind sway. */
  foliageGroup: THREE.Group;
  /** Trunk radius at base — used for collision detection. */
  trunkRadius: number;
  /** True for large trees that block player movement. */
  hasCollision: boolean;
}

export function buildTreeMesh(rng: () => number): TreeMeshResult {
  const group = new THREE.Group();
  const foliageGroup = new THREE.Group();

  // Pick tree type: 30% pine, 40% oak, 20% birch, 10% dead
  const typeRoll = rng();
  const treeType =
    typeRoll < 0.30 ? "pine" :
    typeRoll < 0.70 ? "oak" :
    typeRoll < 0.90 ? "birch" : "dead";

  if (treeType === "pine") {
    // ── Pine / Conifer ──────────────────────────────────────────────────────
    const trunkH = 4.5 + rng() * 4.0;   // 4.5–8.5 — tall and narrow
    const trunkR = 0.11 + rng() * 0.08;
    const isLarge = trunkH > 5.0;

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3a2010 });
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.45, trunkR, trunkH, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Slight natural lean
    group.rotation.z = (rng() - 0.5) * 0.07;
    group.rotation.x = (rng() - 0.5) * 0.05;

    const tiers = 4 + Math.floor(rng() * 4); // 4–7 cone tiers
    const darkGreen = new THREE.Color(0x183d0a);
    const midGreen  = new THREE.Color(0x2d6e1c);
    const leafColor = new THREE.Color().lerpColors(darkGreen, midGreen, rng());
    const leafMat = new THREE.MeshLambertMaterial({ color: leafColor });

    // Stack cones from wide base to narrow tip
    let coneY = trunkH * 0.28; // start above the lower trunk
    for (let i = 0; i < tiers; i++) {
      const frac  = i / (tiers - 1);
      const r     = (1.5 - frac * 1.1) * (0.75 + rng() * 0.35);
      const h     = (1.1 - frac * 0.3) * (0.85 + rng() * 0.4);
      const leafGeo = new THREE.ConeGeometry(r, h, 8);
      const leaves  = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.y = coneY + h * 0.5;
      leaves.castShadow = true;
      foliageGroup.add(leaves);
      coneY += h * 0.58; // overlap tiers
    }
    group.add(foliageGroup);
    return { group, foliageGroup, trunkRadius: trunkR, hasCollision: isLarge };

  } else if (treeType === "oak") {
    // ── Oak / Deciduous ─────────────────────────────────────────────────────
    const trunkH = 2.8 + rng() * 2.5;   // 2.8–5.3
    const trunkR = 0.18 + rng() * 0.14; // 0.18–0.32
    const isLarge = trunkH > 3.2;

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.65, trunkR * 1.1, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Root flare for a grounded look
    const rootGeo = new THREE.CylinderGeometry(trunkR * 1.35, trunkR * 1.8, 0.35, 8);
    const root = new THREE.Mesh(rootGeo, trunkMat);
    root.position.y = 0.17;
    group.add(root);

    group.rotation.z = (rng() - 0.5) * 0.09;

    // Foliage: overlapping sphere blobs forming a broad rounded crown
    const leafColorHex = [0x2d5a1b, 0x3a7a20, 0x1e4012, 0x4a9030, 0x3d6e1a][
      Math.floor(rng() * 5)
    ];
    const leafColor  = new THREE.Color(leafColorHex);
    const innerColor = leafColor.clone().multiplyScalar(0.68);
    const leafMat  = new THREE.MeshLambertMaterial({ color: leafColor });
    const innerMat = new THREE.MeshLambertMaterial({ color: innerColor });

    const crownR   = 1.3 + rng() * 0.9;
    const crownCY  = trunkH + crownR * 0.35;
    const numBlobs = 6 + Math.floor(rng() * 5); // 6–10

    for (let i = 0; i < numBlobs; i++) {
      const theta  = (i / numBlobs) * Math.PI * 2 + rng() * 0.6;
      const blobR  = 0.55 + rng() * 0.55;
      const dist   = crownR * (0.25 + rng() * 0.75);
      const x      = Math.cos(theta) * dist;
      const z      = Math.sin(theta) * dist;
      const y      = crownCY + (rng() - 0.38) * crownR * 0.9;
      const blobGeo = new THREE.SphereGeometry(blobR, 7, 6);
      const blob    = new THREE.Mesh(blobGeo, rng() > 0.45 ? leafMat : innerMat);
      blob.position.set(x, y, z);
      blob.castShadow = true;
      foliageGroup.add(blob);
    }
    // Central top blob fills in the crown
    const topGeo  = new THREE.SphereGeometry(crownR * 0.62, 8, 7);
    const topBlob = new THREE.Mesh(topGeo, leafMat);
    topBlob.position.y = crownCY + crownR * 0.08;
    topBlob.castShadow = true;
    foliageGroup.add(topBlob);

    group.add(foliageGroup);
    return { group, foliageGroup, trunkRadius: trunkR, hasCollision: isLarge };

  } else if (treeType === "birch") {
    // ── Birch ───────────────────────────────────────────────────────────────
    const trunkH = 3.2 + rng() * 2.5;   // 3.2–5.7  slender and tall
    const trunkR = 0.07 + rng() * 0.05; // slim trunk
    const isLarge = trunkH > 4.5;

    // White/cream bark
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0xe0d8c8 });
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.55, trunkR, trunkH, 7);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Horizontal dark bark markings
    const markMat = new THREE.MeshLambertMaterial({ color: 0x201818 });
    for (let i = 0; i < 3; i++) {
      const markGeo = new THREE.CylinderGeometry(
        trunkR * 1.06, trunkR * 1.06, 0.055, 7
      );
      const mark = new THREE.Mesh(markGeo, markMat);
      mark.position.y = 0.4 + i * trunkH * 0.24 + rng() * 0.3;
      group.add(mark);
    }

    // Graceful lean — birches often arch slightly
    group.rotation.z = (rng() - 0.5) * 0.18;
    group.rotation.x = (rng() - 0.5) * 0.12;

    // Light yellow-green foliage blobs
    const birchColors = [0x8ab840, 0x9ac855, 0x78a030, 0xaac850];
    const leafMat = new THREE.MeshLambertMaterial({
      color: birchColors[Math.floor(rng() * birchColors.length)],
    });
    const crownR  = 0.85 + rng() * 0.65;
    const crownCY = trunkH + crownR * 0.15;
    const numBlobs = 4 + Math.floor(rng() * 3); // 4–6

    for (let i = 0; i < numBlobs; i++) {
      const theta = (i / numBlobs) * Math.PI * 2 + rng() * 0.8;
      const blobR = 0.32 + rng() * 0.38;
      const dist  = crownR * (0.2 + rng() * 0.65);
      const x     = Math.cos(theta) * dist;
      const z     = Math.sin(theta) * dist;
      const y     = crownCY + (rng() - 0.4) * crownR * 0.55;
      const blobGeo = new THREE.SphereGeometry(blobR, 7, 6);
      const blob    = new THREE.Mesh(blobGeo, leafMat);
      blob.position.set(x, y, z);
      blob.castShadow = true;
      foliageGroup.add(blob);
    }
    group.add(foliageGroup);
    return { group, foliageGroup, trunkRadius: trunkR, hasCollision: isLarge };

  } else {
    // ── Dead / Bare tree ────────────────────────────────────────────────────
    const trunkH = 3.0 + rng() * 3.5;
    const trunkR = 0.10 + rng() * 0.09;
    const isLargeDead = trunkH > 4.5;

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x252015 });
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.4, trunkR, trunkH, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Gnarled branch arms
    const branchCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < branchCount; i++) {
      const brH   = 1.0 + rng() * 1.6;
      const brR   = trunkR * 0.28;
      const brGeo = new THREE.CylinderGeometry(brR * 0.38, brR, brH, 5);
      const branch = new THREE.Mesh(brGeo, trunkMat);
      const angle  = rng() * Math.PI * 2;
      const tilt   = 0.85 + rng() * 0.5;
      branch.position.set(
        Math.cos(angle) * trunkR * 0.7,
        trunkH * (0.5 + rng() * 0.45),
        Math.sin(angle) * trunkR * 0.7
      );
      branch.rotation.z = Math.cos(angle) * tilt;
      branch.rotation.x = Math.sin(angle) * tilt;
      branch.castShadow = true;
      group.add(branch);
    }
    // Dead trees: no foliage — foliageGroup stays empty
    group.add(foliageGroup);
    return { group, foliageGroup, trunkRadius: trunkR, hasCollision: isLargeDead };
  }
}

// ─── Bush / Shrub ─────────────────────────────────────────────────────────────

export interface BushMeshResult {
  group: THREE.Group;
  /** Same as group — the whole bush sways in wind. */
  foliageGroup: THREE.Group;
}

export function buildBushMesh(rng: () => number): BushMeshResult {
  const group = new THREE.Group();

  const scale = 0.45 + rng() * 0.65; // size variation

  const leafColorHex = [0x1e5e10, 0x2d7a1a, 0x1a4a0e, 0x3a6e20, 0x255e15][
    Math.floor(rng() * 5)
  ];
  const leafColor  = new THREE.Color(leafColorHex);
  const innerColor = leafColor.clone().multiplyScalar(0.62);
  const leafMat  = new THREE.MeshLambertMaterial({ color: leafColor });
  const innerMat = new THREE.MeshLambertMaterial({ color: innerColor });

  const numBlobs = 3 + Math.floor(rng() * 3); // 3–5 blobs

  for (let i = 0; i < numBlobs; i++) {
    const theta  = (i / numBlobs) * Math.PI * 2 + rng() * 1.1;
    const blobR  = (0.28 + rng() * 0.30) * scale;
    const dist   = scale * (0.18 + rng() * 0.42);
    const x      = Math.cos(theta) * dist;
    const z      = Math.sin(theta) * dist;
    const y      = blobR * 0.55 + rng() * 0.18 * scale;
    const blobGeo = new THREE.SphereGeometry(blobR, 7, 6);
    blobGeo.scale(1 + rng() * 0.3, 0.78 + rng() * 0.32, 1 + rng() * 0.3);
    const blob = new THREE.Mesh(blobGeo, rng() > 0.35 ? leafMat : innerMat);
    blob.position.set(x, y, z);
    blob.castShadow = true;
    group.add(blob);
  }

  // ~20% chance of berry clusters (red or orange)
  if (rng() < 0.20) {
    const berryColors = [0xcc2222, 0xdd6600, 0x991188];
    const berryMat = new THREE.MeshLambertMaterial({
      color: berryColors[Math.floor(rng() * berryColors.length)],
    });
    const numBerries = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < numBerries; i++) {
      const berryGeo = new THREE.SphereGeometry(0.045 * scale, 4, 4);
      const berry = new THREE.Mesh(berryGeo, berryMat);
      berry.position.set(
        (rng() - 0.5) * scale * 0.9,
        (0.18 + rng() * 0.45) * scale,
        (rng() - 0.5) * scale * 0.9
      );
      group.add(berry);
    }
  }

  return { group, foliageGroup: group };
}

// ─── Rock ─────────────────────────────────────────────────────────────────────
export interface RockMeshResult {
  mesh: THREE.Mesh;
  /** Maximum horizontal radius of this rock, for cylinder collision detection. */
  collisionRadius: number;
}

export function buildRockMesh(rng: () => number): RockMeshResult {
  const baseRadius = 0.3 + rng() * 0.5;
  const scaleX = 1 + rng() * 0.5;
  const scaleY = 0.6 + rng() * 0.5;
  const scaleZ = 1 + rng() * 0.5;
  const geo = new THREE.DodecahedronGeometry(baseRadius, 0);
  geo.scale(scaleX, scaleY, scaleZ);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color(0.45 + rng() * 0.1, 0.42 + rng() * 0.1, 0.4 + rng() * 0.1),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const collisionRadius = baseRadius * Math.max(scaleX, scaleZ);
  return { mesh, collisionRadius };
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

/** Local-space box collider (relative to ruins group origin). */
export interface RuinsBoxCollider {
  lx: number; lz: number;
  halfW: number; halfD: number;
  rotY: number;
}
/** Local-space cylinder collider (relative to ruins group origin). */
export interface RuinsCylCollider {
  lx: number; lz: number;
  radius: number;
}
export interface RuinsResult {
  group: THREE.Group;
  boxColliders: RuinsBoxCollider[];
  cylColliders: RuinsCylCollider[];
}

export function buildRuins(rng: () => number): RuinsResult {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x999088 });
  const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x6a6058 });

  const boxColliders: RuinsBoxCollider[] = [];
  const cylColliders: RuinsCylCollider[] = [];

  // Broken walls
  const w1H = 2.5 + rng() * 2;
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(8, w1H, 0.7), stoneMat);
  w1.position.set(0, w1H / 2, 0);
  w1.rotation.y = (rng() - 0.5) * 0.15;
  w1.castShadow = true;
  group.add(w1);
  boxColliders.push({ lx: 0, lz: 0, halfW: 4, halfD: 0.35, rotY: w1.rotation.y });

  // Side wall (partial)
  const w2H = 1.8 + rng() * 1.5;
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, w2H, 6), stoneMat);
  w2.position.set(4, w2H / 2, -3);
  w2.castShadow = true;
  group.add(w2);
  boxColliders.push({ lx: 4, lz: -3, halfW: 0.35, halfD: 3, rotY: 0 });

  // Arch remnant
  const archBaseL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), darkStoneMat);
  archBaseL.position.set(-2, 1.75, 0.1);
  archBaseL.castShadow = true;
  group.add(archBaseL);
  cylColliders.push({ lx: -2, lz: 0.1, radius: 0.6 });

  const archBaseR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), darkStoneMat);
  archBaseR.position.set(2, 1.75, 0.1);
  archBaseR.castShadow = true;
  group.add(archBaseR);
  cylColliders.push({ lx: 2, lz: 0.1, radius: 0.6 });

  const archTop = new THREE.Mesh(new THREE.BoxGeometry(5, 0.8, 0.8), darkStoneMat);
  archTop.position.set(0, 3.9, 0.1);
  archTop.castShadow = true;
  group.add(archTop);

  // Columns
  for (let i = 0; i < 3; i++) {
    const colH = 2 + rng() * 3;
    const colGeo = new THREE.CylinderGeometry(0.35, 0.4, colH, 8);
    const col = new THREE.Mesh(colGeo, stoneMat);
    const colX = -6 + i * 3 + rng() * 0.5;
    const colZ = 4 + (rng() - 0.5) * 2;
    col.position.set(colX, colH / 2, colZ);
    col.rotation.z = (rng() - 0.5) * 0.12;
    col.castShadow = true;
    group.add(col);
    cylColliders.push({ lx: colX, lz: colZ, radius: 0.5 });
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

  return { group, boxColliders, cylColliders };
}

// ─── Bullet ───────────────────────────────────────────────────────────────────
/** Small glowing yellow sphere used as a visible projectile. */
export function buildBulletMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.07, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  return new THREE.Mesh(geo, mat);
}

// ─── Weapon (pistol) ──────────────────────────────────────────────────────────
/** Simple first-person pistol shown in bottom-right of viewport. */
export function buildWeaponMesh(): THREE.Group {
  const group = new THREE.Group();
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x282828 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const greyMat = new THREE.MeshLambertMaterial({ color: 0x444444 });

  // Slide (main upper body)
  const slideGeo = new THREE.BoxGeometry(0.065, 0.075, 0.33);
  const slide = new THREE.Mesh(slideGeo, metalMat);
  slide.position.set(0, 0.01, 0);
  group.add(slide);

  // Barrel extension in front
  const barrelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8);
  const barrel = new THREE.Mesh(barrelGeo, darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, -0.004, -0.235);
  group.add(barrel);

  // Frame / dust cover below slide
  const frameGeo = new THREE.BoxGeometry(0.06, 0.045, 0.28);
  const frame = new THREE.Mesh(frameGeo, greyMat);
  frame.position.set(0, -0.06, -0.02);
  group.add(frame);

  // Grip
  const gripGeo = new THREE.BoxGeometry(0.055, 0.17, 0.09);
  const grip = new THREE.Mesh(gripGeo, metalMat);
  grip.position.set(0, -0.135, 0.1);
  grip.rotation.x = 0.18;
  group.add(grip);

  // Trigger guard
  const guardGeo = new THREE.TorusGeometry(0.026, 0.009, 5, 8, Math.PI);
  const guard = new THREE.Mesh(guardGeo, greyMat);
  guard.rotation.z = Math.PI / 2;
  guard.rotation.y = Math.PI / 2;
  guard.position.set(0, -0.062, 0.04);
  group.add(guard);

  // Sight (front)
  const sightGeo = new THREE.BoxGeometry(0.01, 0.018, 0.01);
  const sight = new THREE.Mesh(sightGeo, darkMat);
  sight.position.set(0, 0.056, -0.155);
  group.add(sight);

  return group;
}

// ─── Weapon (sword) ───────────────────────────────────────────────────────────
/** Simple first-person sword shown in bottom-right of viewport. */
export function buildSwordMesh(): THREE.Group {
  const group = new THREE.Group();
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0xd0e8ff, emissive: 0x4488cc, emissiveIntensity: 0.18 });
  const guardMat = new THREE.MeshLambertMaterial({ color: 0xc8960c });
  const gripMat = new THREE.MeshLambertMaterial({ color: 0x5c2a0a });
  const pommelMat = new THREE.MeshLambertMaterial({ color: 0xc8960c });

  // Blade (long flat box, oriented along -Z)
  const bladeGeo = new THREE.BoxGeometry(0.028, 0.008, 0.52);
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 0, -0.24);
  group.add(blade);

  // Blade edge bevel (slightly narrower, offset)
  const bevelGeo = new THREE.BoxGeometry(0.018, 0.015, 0.50);
  const bevel = new THREE.Mesh(bevelGeo, bladeMat);
  bevel.position.set(0, 0.008, -0.23);
  group.add(bevel);

  // Cross-guard
  const guardGeo = new THREE.BoxGeometry(0.18, 0.018, 0.022);
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.set(0, 0, 0.005);
  group.add(guard);

  // Guard decoration (small spheres at ends)
  const knobGeo = new THREE.SphereGeometry(0.016, 6, 6);
  const knobL = new THREE.Mesh(knobGeo, guardMat);
  knobL.position.set(-0.091, 0, 0.005);
  group.add(knobL);
  const knobR = new THREE.Mesh(knobGeo.clone(), guardMat);
  knobR.position.set(0.091, 0, 0.005);
  group.add(knobR);

  // Grip (wrapped handle)
  const gripGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.14, 8);
  const grip = new THREE.Mesh(gripGeo, gripMat);
  grip.rotation.x = Math.PI / 2;
  grip.position.set(0, 0, 0.082);
  group.add(grip);

  // Pommel
  const pommelGeo = new THREE.SphereGeometry(0.024, 8, 8);
  const pommel = new THREE.Mesh(pommelGeo, pommelMat);
  pommel.position.set(0, 0, 0.162);
  group.add(pommel);

  return group;
}

// ─── Weapon (sniper rifle) ────────────────────────────────────────────────────
/** Simple first-person sniper rifle shown in bottom-right of viewport. */
export function buildSniperMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b3d1a });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x88ddff, emissive: 0x224488, emissiveIntensity: 0.35 });
  const lensMat = new THREE.MeshLambertMaterial({ color: 0x99ccff, emissive: 0x4488cc, emissiveIntensity: 0.5 });

  // Long barrel
  const barrelGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.72, 8);
  const barrel = new THREE.Mesh(barrelGeo, bodyMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.005, -0.34);
  group.add(barrel);

  // Barrel suppressor/flash hider at tip
  const tipGeo = new THREE.CylinderGeometry(0.022, 0.019, 0.06, 8);
  const tip = new THREE.Mesh(tipGeo, metalMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.005, -0.71);
  group.add(tip);

  // Receiver (main body)
  const receiverGeo = new THREE.BoxGeometry(0.07, 0.065, 0.30);
  const receiver = new THREE.Mesh(receiverGeo, bodyMat);
  receiver.position.set(0, 0, -0.02);
  group.add(receiver);

  // Stock (wooden part)
  const stockGeo = new THREE.BoxGeometry(0.055, 0.055, 0.22);
  const stock = new THREE.Mesh(stockGeo, woodMat);
  stock.position.set(0, -0.01, 0.19);
  stock.rotation.x = 0.12;
  group.add(stock);

  // Cheekrest
  const cheekGeo = new THREE.BoxGeometry(0.05, 0.032, 0.12);
  const cheek = new THREE.Mesh(cheekGeo, woodMat);
  cheek.position.set(0, 0.045, 0.16);
  group.add(cheek);

  // Scope body (tube)
  const scopeBodyGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10);
  const scopeBody = new THREE.Mesh(scopeBodyGeo, metalMat);
  scopeBody.rotation.x = Math.PI / 2;
  scopeBody.position.set(0, 0.062, -0.04);
  group.add(scopeBody);

  // Scope objective lens (front - larger)
  const objLensGeo = new THREE.CylinderGeometry(0.028, 0.026, 0.022, 10);
  const objLens = new THREE.Mesh(objLensGeo, metalMat);
  objLens.rotation.x = Math.PI / 2;
  objLens.position.set(0, 0.062, -0.152);
  group.add(objLens);

  // Scope glass (front lens)
  const glassGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.004, 10);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0.062, -0.165);
  group.add(glass);

  // Scope eyepiece (rear - slightly smaller)
  const eyepieceGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.018, 10);
  const eyepiece = new THREE.Mesh(eyepieceGeo, metalMat);
  eyepiece.rotation.x = Math.PI / 2;
  eyepiece.position.set(0, 0.062, 0.072);
  group.add(eyepiece);

  // Eyepiece lens
  const eyeLensGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.004, 10);
  const eyeLens = new THREE.Mesh(eyeLensGeo, lensMat);
  eyeLens.rotation.x = Math.PI / 2;
  eyeLens.position.set(0, 0.062, 0.082);
  group.add(eyeLens);

  // Scope turrets (elevation knob)
  const turretGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.022, 6);
  const turret = new THREE.Mesh(turretGeo, metalMat);
  turret.position.set(0, 0.084, -0.02);
  group.add(turret);

  // Trigger guard
  const guardGeo = new THREE.TorusGeometry(0.024, 0.008, 5, 8, Math.PI);
  const guard = new THREE.Mesh(guardGeo, metalMat);
  guard.rotation.z = Math.PI / 2;
  guard.rotation.y = Math.PI / 2;
  guard.position.set(0, -0.042, 0.05);
  group.add(guard);

  // Grip (pistol grip below receiver)
  const gripGeo = new THREE.BoxGeometry(0.048, 0.13, 0.072);
  const grip = new THREE.Mesh(gripGeo, bodyMat);
  grip.position.set(0, -0.095, 0.07);
  grip.rotation.x = 0.18;
  group.add(grip);

  // Bipod legs (folded down slightly)
  const bipodLegGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6);
  const legL = new THREE.Mesh(bipodLegGeo, metalMat);
  legL.position.set(-0.028, -0.075, -0.38);
  legL.rotation.z = 0.22;
  group.add(legL);
  const legR = new THREE.Mesh(bipodLegGeo.clone(), metalMat);
  legR.position.set(0.028, -0.075, -0.38);
  legR.rotation.z = -0.22;
  group.add(legR);

  return group;
}

// ─── Weapon (bow) ─────────────────────────────────────────────────────────────
/**
 * Limb dimensions for the bow — shared between mesh building and animation.
 * TIP_X: how far the limb tip leans toward the string (small, natural lean).
 * TIP_Y: vertical distance from grip centre to tip.
 * STRING_X: X position of the string (slightly past the tips).
 * HALF_LEN: length of each string half from tip to nock.
 */
export const BOW_DIMS = {
  TIP_X: 0.020,
  TIP_Y: 0.310,
  STRING_X: 0.030,
  HALF_LEN: 0.325,
  MAX_PULL_Z: 0.070, // max nock pull toward camera when fully drawn
} as const;

/** First-person bow with smooth TubeGeometry limbs and animated V-string. */
export function buildBowMesh(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a4a1a });
  const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x4a2a08 });
  const stringMat = new THREE.MeshLambertMaterial({ color: 0xeeddbb });
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0x8b5e3c });
  const arrowTipMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const fletchingMat = new THREE.MeshLambertMaterial({ color: 0xdd4444 });

  const { TIP_X, TIP_Y, STRING_X, HALF_LEN } = BOW_DIMS;

  // ── Grip (center handle) ─────────────────────────────────────────────────
  const gripGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.14, 8);
  const grip = new THREE.Mesh(gripGeo, darkWoodMat);
  group.add(grip);

  // Decorative riser bands where limbs meet the grip
  const riserGeo = new THREE.CylinderGeometry(0.018, 0.017, 0.038, 8);
  const upperRiser = new THREE.Mesh(riserGeo, darkWoodMat);
  upperRiser.position.set(0.001, 0.086, 0);
  group.add(upperRiser);
  const lowerRiser = new THREE.Mesh(riserGeo.clone(), darkWoodMat);
  lowerRiser.position.set(0.001, -0.086, 0);
  group.add(lowerRiser);

  // ── Limbs using TubeGeometry along a smooth CatmullRomCurve3 ────────────
  // Control points: X is a gentle lean toward the string side, Y is up/down.
  // TubeGeometry automatically orients each tube cross-section perpendicular
  // to the curve — no per-segment rotation needed.
  const upperPoints = [
    new THREE.Vector3(0.000,  0.068, 0),
    new THREE.Vector3(0.005,  0.145, 0),
    new THREE.Vector3(0.012,  0.222, 0),
    new THREE.Vector3(TIP_X,  TIP_Y,  0),
  ];
  const upperCurve = new THREE.CatmullRomCurve3(upperPoints);
  const upperGeo = new THREE.TubeGeometry(upperCurve, 14, 0.012, 8, false);
  group.add(new THREE.Mesh(upperGeo, woodMat));

  // Lower limb: mirror of upper in Y
  const lowerPoints = upperPoints.map(p => new THREE.Vector3(p.x, -p.y, p.z));
  const lowerCurve = new THREE.CatmullRomCurve3(lowerPoints);
  const lowerGeo = new THREE.TubeGeometry(lowerCurve, 14, 0.012, 8, false);
  group.add(new THREE.Mesh(lowerGeo, woodMat));

  // ── V-String: two half-segments pivoting from the fixed limb tips ─────────
  // Each half is a thin cylinder in a pivot-group whose origin is at the tip.
  // During draw animation, Game3D tilts these groups in X to form the V.
  const strHalfGeo = new THREE.CylinderGeometry(0.0025, 0.0025, HALF_LEN, 5);

  // Upper string half — pivot at upper tip
  const upperStrPivot = new THREE.Group();
  upperStrPivot.name = "upperStringPivot";
  upperStrPivot.position.set(STRING_X, HALF_LEN, 0); // at upper tip location
  const upperStrMesh = new THREE.Mesh(strHalfGeo, stringMat);
  upperStrMesh.position.set(0, -HALF_LEN / 2, 0); // hangs downward from pivot
  upperStrPivot.add(upperStrMesh);
  group.add(upperStrPivot);

  // Lower string half — pivot at lower tip
  const lowerStrPivot = new THREE.Group();
  lowerStrPivot.name = "lowerStringPivot";
  lowerStrPivot.position.set(STRING_X, -HALF_LEN, 0); // at lower tip location
  const lowerStrMesh = new THREE.Mesh(strHalfGeo.clone(), stringMat);
  lowerStrMesh.position.set(0, HALF_LEN / 2, 0); // reaches upward from pivot
  lowerStrPivot.add(lowerStrMesh);
  group.add(lowerStrPivot);

  // ── Nock-point group (moves in Z during draw animation) ────────────────────
  // Named "nockPoint" — Game3D sets nockPoint.position.z = pullZ.
  const nockPoint = new THREE.Group();
  nockPoint.name = "nockPoint";
  nockPoint.position.set(STRING_X, 0, 0);

  // ── Arrow nocked on the string (child of nockPoint so it pulls with it) ───
  const arrowGroup = new THREE.Group();
  arrowGroup.name = "nockedArrow";
  // Shaft oriented along -Z (toward target)
  const shaftGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.36, 6);
  const shaft = new THREE.Mesh(shaftGeo, arrowMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(-0.010, 0, -0.10); // on string, pointing forward
  arrowGroup.add(shaft);

  // Arrowhead
  const tipGeo = new THREE.ConeGeometry(0.008, 0.036, 6);
  const arrowTip = new THREE.Mesh(tipGeo, arrowTipMat);
  arrowTip.rotation.x = -Math.PI / 2;
  arrowTip.position.set(-0.010, 0, -0.290);
  arrowGroup.add(arrowTip);

  // Fletching (two flat fins at nock end)
  const fletchGeo = new THREE.BoxGeometry(0.002, 0.030, 0.048);
  const fletch1 = new THREE.Mesh(fletchGeo, fletchingMat);
  fletch1.position.set(-0.004, 0.016, 0.096);
  arrowGroup.add(fletch1);
  const fletch2 = new THREE.Mesh(fletchGeo.clone(), fletchingMat);
  fletch2.position.set(-0.004, -0.016, 0.096);
  arrowGroup.add(fletch2);

  nockPoint.add(arrowGroup);
  group.add(nockPoint);

  return group;
}

// ─── Arrow projectile mesh ─────────────────────────────────────────────────────
/**
 * Visible arrow mesh fired from the bow. Points along -Z (forward) by default.
 * Rotate each frame to align with velocity for arc trajectory.
 */
export function buildArrowProjectileMesh(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5e3c });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
  const fletchMat = new THREE.MeshLambertMaterial({ color: 0xcc3333 });

  // Shaft along -Z (forward)
  const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6);
  const shaft = new THREE.Mesh(shaftGeo, woodMat);
  shaft.rotation.x = Math.PI / 2; // cylinder Y → Z axis
  shaft.position.set(0, 0, -0.1); // center slightly forward
  group.add(shaft);

  // Arrowhead (cone, tip toward -Z = forward)
  const headGeo = new THREE.ConeGeometry(0.028, 0.10, 6);
  const head = new THREE.Mesh(headGeo, metalMat);
  head.rotation.x = -Math.PI / 2; // cone tip toward -Z
  head.position.set(0, 0, -0.42);
  group.add(head);

  // Fletching (3 small fins at rear = +Z side)
  const finGeo = new THREE.BoxGeometry(0.005, 0.08, 0.12);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo.clone(), fletchMat);
    const angle = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(angle) * 0.03, Math.sin(angle) * 0.03, 0.20);
    fin.rotation.z = angle;
    group.add(fin);
  }

  return group;
}

// ─── Weapon (crossbow) ────────────────────────────────────────────────────────
/** First-person crossbow with stock, horizontal limbs and loaded bolt. */
export function buildCrossbowMesh(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a1a08 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b3d1a });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  const darkMetalMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const stringMat = new THREE.MeshLambertMaterial({ color: 0xddccaa });
  const boltMat = new THREE.MeshLambertMaterial({ color: 0x7a4a1a });
  const boltTipMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

  // ── Stock (main wooden body, aimed along -Z) ──────────────────────────────
  const stockGeo = new THREE.BoxGeometry(0.06, 0.055, 0.40);
  const stock = new THREE.Mesh(stockGeo, woodMat);
  stock.position.set(0, 0, 0.02);
  group.add(stock);

  // Butt of the stock (wider end at back)
  const buttGeo = new THREE.BoxGeometry(0.07, 0.065, 0.10);
  const butt = new THREE.Mesh(buttGeo, woodMat);
  butt.position.set(0, -0.004, 0.22);
  group.add(butt);

  // ── Tiller / rail (forward rail for the bolt to slide on) ─────────────────
  const railGeo = new THREE.BoxGeometry(0.038, 0.022, 0.30);
  const rail = new THREE.Mesh(railGeo, darkMetalMat);
  rail.position.set(0, 0.038, -0.12);
  group.add(rail);

  // ── Horizontal bow limbs (perpendicular to aiming axis) ───────────────────
  // Left limb
  const leftLimbGeo = new THREE.CylinderGeometry(0.010, 0.013, 0.26, 7);
  const leftLimb = new THREE.Mesh(leftLimbGeo, bodyMat);
  leftLimb.rotation.z = Math.PI / 2;
  leftLimb.position.set(-0.13, 0.028, -0.22);
  group.add(leftLimb);

  // Right limb
  const rightLimbGeo = new THREE.CylinderGeometry(0.010, 0.013, 0.26, 7);
  const rightLimb = new THREE.Mesh(rightLimbGeo, bodyMat);
  rightLimb.rotation.z = Math.PI / 2;
  rightLimb.position.set(0.13, 0.028, -0.22);
  group.add(rightLimb);

  // ── Stirrup (metal loop at front, used to cock the crossbow) ─────────────
  const stirrupGeo = new THREE.TorusGeometry(0.028, 0.007, 6, 10, Math.PI);
  const stirrup = new THREE.Mesh(stirrupGeo, metalMat);
  stirrup.rotation.y = Math.PI / 2;
  stirrup.position.set(0, 0.006, -0.35);
  group.add(stirrup);

  // ── Bowstring (horizontal, pulled back in cocked position) ────────────────
  // Left string half
  const lStringGeo = new THREE.BoxGeometry(0.003, 0.003, 0.14);
  const lString = new THREE.Mesh(lStringGeo, stringMat);
  lString.position.set(-0.065, 0.028, -0.14);
  lString.rotation.y = 0.18;
  group.add(lString);

  // Right string half
  const rStringGeo = new THREE.BoxGeometry(0.003, 0.003, 0.14);
  const rString = new THREE.Mesh(rStringGeo, stringMat);
  rString.position.set(0.065, 0.028, -0.14);
  rString.rotation.y = -0.18;
  group.add(rString);

  // ── Trigger mechanism (simple block) ─────────────────────────────────────
  const triggerGeo = new THREE.BoxGeometry(0.022, 0.032, 0.028);
  const trigger = new THREE.Mesh(triggerGeo, metalMat);
  trigger.position.set(0, -0.01, 0.06);
  group.add(trigger);

  // Trigger guard
  const guardGeo = new THREE.TorusGeometry(0.022, 0.007, 5, 8, Math.PI);
  const guard = new THREE.Mesh(guardGeo, metalMat);
  guard.rotation.z = Math.PI / 2;
  guard.rotation.y = Math.PI / 2;
  guard.position.set(0, -0.038, 0.07);
  group.add(guard);

  // ── Loaded bolt (quarrel) on the rail ─────────────────────────────────────
  const boltShaftGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6);
  const boltShaft = new THREE.Mesh(boltShaftGeo, boltMat);
  boltShaft.rotation.x = Math.PI / 2;
  boltShaft.position.set(0, 0.048, -0.14);
  group.add(boltShaft);

  // Bolt tip
  const boltTipGeo = new THREE.ConeGeometry(0.010, 0.038, 6);
  const boltTip = new THREE.Mesh(boltTipGeo, boltTipMat);
  boltTip.rotation.x = -Math.PI / 2;
  boltTip.position.set(0, 0.048, -0.27);
  group.add(boltTip);

  return group;
}

// ─── Lighthouse ───────────────────────────────────────────────────────────────
export function buildLighthouse(): { group: THREE.Group; beamPivot: THREE.Group; lighthouseLight: THREE.PointLight } {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const redMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xffff88, emissive: 0xffff00, emissiveIntensity: 0.8 });

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
  const lanternY = 1.2 + 5 * bandH + 0.9; // 17.1
  const lanternGeo = new THREE.CylinderGeometry(1.3, 1.1, 1.8, 12);
  const lantern = new THREE.Mesh(lanternGeo, glassMat);
  lantern.position.y = lanternY;
  group.add(lantern);

  // Dome
  const domeGeo = new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, redMat);
  dome.position.y = 1.2 + 5 * bandH + 1.8;
  dome.castShadow = true;
  group.add(dome);

  // ── Rotating beam pivot ────────────────────────────────────────────────────
  // Pivot sits at lantern height; rotation.y is animated each frame
  const beamPivot = new THREE.Group();
  beamPivot.position.y = lanternY;

  const beamLength = 80;

  // Outer glow cone
  const outerGeo = new THREE.ConeGeometry(5, beamLength, 16, 1, true);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xffffaa,
    transparent: true,
    opacity: 0.10,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const outerBeam = new THREE.Mesh(outerGeo, outerMat);
  // Rotate so tip points toward +X; shift so tip is at x=0, base at x=beamLength
  outerBeam.rotation.z = Math.PI / 2;
  outerBeam.position.x = beamLength / 2;
  beamPivot.add(outerBeam);

  // Bright inner core cone
  const coreGeo = new THREE.ConeGeometry(1.8, beamLength, 8, 1, true);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const coreBeam = new THREE.Mesh(coreGeo, coreMat);
  coreBeam.rotation.z = Math.PI / 2;
  coreBeam.position.x = beamLength / 2;
  beamPivot.add(coreBeam);

  group.add(beamPivot);

  // ── Point light at lantern (actual scene illumination) ─────────────────────
  const lighthouseLight = new THREE.PointLight(0xffeeaa, 4, 130);
  lighthouseLight.position.y = lanternY;
  group.add(lighthouseLight);

  return { group, beamPivot, lighthouseLight };
}

// ─── Boat ──────────────────────────────────────────────────────────────────────
/**
 * A small wooden rowboat that floats on the water surface.
 * Origin sits at the waterline; the deck is ~0.4 units above origin.
 * Overall dimensions: ~4.8 × 2.2 × 0.9 (L × W × H).
 */
export function buildBoatMesh(): THREE.Group {
  const group = new THREE.Group();

  // ── ORIENTATION PIVOT ─────────────────────────────────────────────────────────
  // The boat geometry is built with its bow at local +X (length along X axis).
  // The rotation formula in Game3D uses Math.atan2(moveX, moveZ) for boat.rotation.y,
  // which assumes the boat's "forward" is local +Z when rotation.y = 0.
  //
  // VERIFICATION TECHNIQUE (rotation.y = -π/2 correction):
  //   Bow is at inner local +X. With pivot.rotation.y = -π/2:
  //     inner +X → outer +Z  (Rotation_Y(-π/2) × (1,0,0) = (0,0,1))
  //   When outer rotation.y = π (W key, yaw=0 → targetYaw=π):
  //     outer +Z → world -Z  (Rotation_Y(π) × (0,0,1) = (0,0,-1))
  //   That matches the -Z movement direction ✓
  //
  // All boat meshes go into this pivot, not directly into group.
  const pivot = new THREE.Group();
  pivot.rotation.y = -Math.PI / 2;
  group.add(pivot);

  const darkWood  = new THREE.MeshLambertMaterial({ color: 0x5C3317 }); // dark hull planks
  const lightWood = new THREE.MeshLambertMaterial({ color: 0xC8894A }); // deck & bench
  const redPaint  = new THREE.MeshLambertMaterial({ color: 0xAA2200 }); // decorative stripe
  const metalMat  = new THREE.MeshLambertMaterial({ color: 0x888888 }); // oarlocks

  // ── Hull floor ────────────────────────────────────────────────────────────────
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.22, 1.6), darkWood);
  floorMesh.position.y = 0.11;
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;
  pivot.add(floorMesh);

  // ── Hull sides (port & starboard) ─────────────────────────────────────────────
  const wallGeo = new THREE.BoxGeometry(4.8, 0.65, 0.18);
  ([-1, 1] as const).forEach((s) => {
    const wall = new THREE.Mesh(wallGeo, darkWood);
    wall.position.set(0, 0.55, s * 0.91);
    wall.castShadow = true;
    pivot.add(wall);
  });

  // ── Bow (front cap) ───────────────────────────────────────────────────────────
  const bowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 2.0), darkWood);
  bowMesh.position.set(2.37, 0.55, 0);
  bowMesh.castShadow = true;
  pivot.add(bowMesh);

  // ── Stern (rear cap) ──────────────────────────────────────────────────────────
  const sternMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 2.0), darkWood);
  sternMesh.position.set(-2.37, 0.55, 0);
  sternMesh.castShadow = true;
  pivot.add(sternMesh);

  // ── Red waterline stripe ──────────────────────────────────────────────────────
  const stripeGeo = new THREE.BoxGeometry(4.6, 0.09, 0.05);
  ([-1, 1] as const).forEach((s) => {
    const stripe = new THREE.Mesh(stripeGeo, redPaint);
    stripe.position.set(0, 0.82, s * 0.95);
    pivot.add(stripe);
  });

  // ── Deck planks ───────────────────────────────────────────────────────────────
  const PLANK_Z_POSITIONS = [-0.55, -0.18, 0.18, 0.55];
  PLANK_Z_POSITIONS.forEach((z) => {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 0.30), lightWood);
    plank.position.set(0, 0.26, z);
    pivot.add(plank);
  });

  // ── Bench (centre seat) ───────────────────────────────────────────────────────
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.10, 1.50), lightWood);
  benchTop.position.set(0, 0.44, 0);
  benchTop.castShadow = true;
  pivot.add(benchTop);

  // Bench legs
  const benchLegGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.18, 6);
  ([-0.58, 0.58] as const).forEach((z) => {
    const leg = new THREE.Mesh(benchLegGeo, lightWood);
    leg.position.set(0, 0.30, z);
    pivot.add(leg);
  });

  // ── Oarlocks ─────────────────────────────────────────────────────────────────
  const lockGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.20, 6);
  ([-1, 1] as const).forEach((s) => {
    const lock = new THREE.Mesh(lockGeo, metalMat);
    lock.position.set(0.4, 0.97, s * 0.93);
    pivot.add(lock);
  });

  // ── Oars (resting along hull sides) ──────────────────────────────────────────
  ([-1, 1] as const).forEach((s) => {
    // Handle: long cylinder laid flat along boat length (X axis)
    const handleGeo = new THREE.CylinderGeometry(0.038, 0.038, 3.6, 6);
    const handle = new THREE.Mesh(handleGeo, lightWood);
    handle.rotation.z = Math.PI / 2;            // lay along X
    handle.position.set(-0.1, 0.90, s * 1.04);
    pivot.add(handle);

    // Paddle blade at the bow end
    const bladeGeo = new THREE.BoxGeometry(0.55, 0.10, 0.16);
    const blade = new THREE.Mesh(bladeGeo, lightWood);
    blade.position.set(1.9, 0.90, s * 1.04);
    pivot.add(blade);
  });

  group.castShadow = true;
  group.receiveShadow = true;
  return group;
}

// ─── Catapult ─────────────────────────────────────────────────────────────────
// Returns the full catapult group and the arm sub-group (for fire animation).
// The arm pivots around the X axis at its origin (which sits at axle height).
export function buildCatapultMesh(): { group: THREE.Group; armGroup: THREE.Group } {
  const group = new THREE.Group();

  const wood    = new THREE.MeshLambertMaterial({ color: 0x8b5e3c });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
  const metal   = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
  const rope    = new THREE.MeshLambertMaterial({ color: 0xc8a060 });

  // ── Base frame ──────────────────────────────────────────────────────────────
  // Two long side beams running front-to-back (along Z axis)
  const sideBeamGeo = new THREE.BoxGeometry(0.22, 0.22, 3.4);
  ([-0.72, 0.72] as const).forEach((x) => {
    const beam = new THREE.Mesh(sideBeamGeo, wood);
    beam.position.set(x, 0.11, 0);
    beam.castShadow = true;
    group.add(beam);
  });

  // Front and rear crossbars
  const crossGeo = new THREE.BoxGeometry(1.65, 0.20, 0.20);
  [-1.1, 0, 1.1].forEach((z) => {
    const cross = new THREE.Mesh(crossGeo, darkWood);
    cross.position.set(0, 0.12, z);
    cross.castShadow = true;
    group.add(cross);
  });

  // ── Wheels (4 total, pairs at front & rear) ──────────────────────────────────
  const wheelGeo  = new THREE.CylinderGeometry(0.40, 0.40, 0.12, 12);
  const spokeGeo  = new THREE.BoxGeometry(0.06, 0.70, 0.08);
  ([-1, 1] as const).forEach((side) => {
    ([-1.0, 1.0] as const).forEach((z) => {
      const wheel = new THREE.Mesh(wheelGeo, darkWood);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.92, 0.40, z);
      wheel.castShadow = true;
      group.add(wheel);

      // 4 spokes per wheel
      for (let sp = 0; sp < 4; sp++) {
        const spoke = new THREE.Mesh(spokeGeo, wood);
        spoke.rotation.z = (sp * Math.PI) / 4;
        spoke.position.copy(wheel.position);
        spoke.position.x += side * 0.07;
        group.add(spoke);
      }

      // Metal hub cap
      const hubGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.16, 8);
      const hub = new THREE.Mesh(hubGeo, metal);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * 0.92, 0.40, z);
      group.add(hub);
    });
  });

  // ── Upright A-frame supports ─────────────────────────────────────────────────
  const AXLE_Y = 1.65; // height of the throwing arm axle
  const uprightGeo = new THREE.BoxGeometry(0.18, AXLE_Y, 0.18);
  // Two uprights, left and right, slightly forward of centre
  ([-0.62, 0.62] as const).forEach((x) => {
    const upright = new THREE.Mesh(uprightGeo, wood);
    upright.position.set(x, AXLE_Y / 2, -0.1);
    upright.castShadow = true;
    group.add(upright);

    // Diagonal brace from base to mid-upright
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.30, 0.12), darkWood);
    brace.position.set(x * 0.6, 0.8, 0.52);
    brace.rotation.x = 0.55;
    brace.castShadow = true;
    group.add(brace);
  });

  // Axle cylinder
  const axleGeo = new THREE.CylinderGeometry(0.075, 0.075, 1.55, 8);
  const axle = new THREE.Mesh(axleGeo, metal);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, AXLE_Y, -0.1);
  group.add(axle);

  // ── Throwing arm (pivots around axle) ────────────────────────────────────────
  // Long end (sling) extends upward/forward; short end (counterweight) goes back.
  const armGroup = new THREE.Group();
  armGroup.position.set(0, AXLE_Y, -0.1); // pivot at axle
  group.add(armGroup);

  // Arm beam — long side (toward sling)
  const longArmGeo = new THREE.BoxGeometry(0.14, 2.55, 0.14);
  const longArm = new THREE.Mesh(longArmGeo, wood);
  longArm.position.set(0, 1.275, 0); // extends upward from pivot
  longArm.castShadow = true;
  armGroup.add(longArm);

  // Arm beam — short side (counterweight side)
  const shortArmGeo = new THREE.BoxGeometry(0.14, 0.95, 0.14);
  const shortArm = new THREE.Mesh(shortArmGeo, darkWood);
  shortArm.position.set(0, -0.475, 0); // extends downward from pivot
  shortArm.castShadow = true;
  armGroup.add(shortArm);

  // Counterweight block on short end
  const cwGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
  const cw = new THREE.Mesh(cwGeo, metal);
  cw.position.set(0, -1.1, 0);
  cw.castShadow = true;
  armGroup.add(cw);

  // Sling rope (two thin cylinders forming a Y)
  const slingGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.70, 5);
  ([-0.15, 0.15] as const).forEach((x) => {
    const sling = new THREE.Mesh(slingGeo, rope);
    sling.position.set(x, 2.8, 0);
    sling.rotation.z = x > 0 ? -0.25 : 0.25;
    armGroup.add(sling);
  });

  // Cannonball in sling (round stone)
  const ballGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const ballMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.position.set(0, 3.05, 0);
  ballMesh.castShadow = true;
  armGroup.add(ballMesh);

  // Rest position: arm tilted back so sling is high behind
  armGroup.rotation.x = -1.1;

  return { group, armGroup };
}

// ── MotherShip ───────────────────────────────────────────────────────────────

const hullMat = (color: number, roughness = 0.85, metalness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

/**
 * Builds the District-9-style alien mothership mesh group.
 * Returns the root group and an array of point lights for flicker animation.
 * Scale the group externally (e.g. group.scale.setScalar(0.5)) as needed.
 */
export function buildMotherShipMesh(): { group: THREE.Group; lights: THREE.PointLight[] } {
  const shipGroup = new THREE.Group();

  // ── Outer ring ──────────────────────────────────────────────────────────────
  const outerRing = new THREE.Group();
  const torusMesh = new THREE.Mesh(new THREE.TorusGeometry(95, 8, 12, 80), hullMat(0x2e2820, 0.9, 0.5));
  torusMesh.rotation.x = Math.PI / 2;
  outerRing.add(torusMesh);

  const innerTorus = new THREE.Mesh(new THREE.TorusGeometry(72, 4, 8, 64), hullMat(0x252018, 0.92, 0.45));
  innerTorus.rotation.x = Math.PI / 2;
  outerRing.add(innerTorus);

  const accentTorus = new THREE.Mesh(new THREE.TorusGeometry(103, 2, 6, 80), hullMat(0x3a2e22, 0.88, 0.55));
  accentTorus.rotation.x = Math.PI / 2;
  accentTorus.position.y = -3;
  outerRing.add(accentTorus);
  shipGroup.add(outerRing);

  // ── Central hub ─────────────────────────────────────────────────────────────
  const hub = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(28, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    hullMat(0x1e1c18, 0.95, 0.4)
  );
  dome.position.y = -2;
  hub.add(dome);

  hub.add(new THREE.Mesh(new THREE.CylinderGeometry(20, 24, 18, 16), hullMat(0x2a2420, 0.88, 0.55)));

  const cap = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 16), hullMat(0x242018, 0.9, 0.5));
  cap.position.y = 18;
  hub.add(cap);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(25, 3, 8, 32), hullMat(0x382e24, 0.85, 0.6));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 2;
  hub.add(collar);

  const blister1 = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), hullMat(0x201e1a, 0.95, 0.35));
  blister1.position.set(18, -5, 8);
  hub.add(blister1);

  const blister2 = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), hullMat(0x201e1a, 0.95, 0.35));
  blister2.position.set(-14, -8, 14);
  hub.add(blister2);
  shipGroup.add(hub);

  // ── Radial arms ─────────────────────────────────────────────────────────────
  const armsGroup = new THREE.Group();
  const armAngles = [0, 51, 103, 155, 205, 257, 308];
  const armWidths  = [5, 3.5, 4.5, 3, 5.5, 3.5, 4];
  const armHeights = [6, 4, 5, 4.5, 7, 3.5, 5];
  armAngles.forEach((deg, i) => {
    const angle = (deg * Math.PI) / 180;
    const len = 70;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armWidths[i], armHeights[i], len),
      hullMat(0x28221e + i * 0x010000, 0.9, 0.5)
    );
    arm.position.set(Math.cos(angle) * (len / 2 + 22), -2 - i * 0.5, Math.sin(angle) * (len / 2 + 22));
    arm.rotation.y = -angle;
    armsGroup.add(arm);

    if (i % 2 === 0) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, len * 0.6), hullMat(0x201c18, 0.92, 0.45));
      brace.position.set(Math.cos(angle) * (len * 0.3 + 22), -6, Math.sin(angle) * (len * 0.3 + 22));
      brace.rotation.y = -angle;
      armsGroup.add(brace);
    }
  });
  shipGroup.add(armsGroup);

  // ── Hanging elements ─────────────────────────────────────────────────────────
  const hangGroup = new THREE.Group();
  const hangDefs = [
    { x: 40,  z: 60,  rx: 0.1,  rz: 0.08,  sy: 1.2, w: 12, h: 20, d: 16 },
    { x: -55, z: 30,  rx: -0.08,rz: 0.12,  sy: 1.0, w: 10, h: 25, d: 12 },
    { x: 70,  z: -20, rx: 0.05, rz: -0.1,  sy: 1.1, w: 8,  h: 18, d: 10 },
    { x: -30, z: -70, rx: 0.12, rz: 0.06,  sy: 0.9, w: 14, h: 22, d: 18 },
    { x: 10,  z: 85,  rx: -0.06,rz: -0.08, sy: 1.3, w: 9,  h: 16, d: 11 },
    { x: -80, z: -40, rx: 0.09, rz: 0.15,  sy: 1.0, w: 11, h: 19, d: 14 },
    { x: 60,  z: 70,  rx: -0.12,rz: 0.07,  sy: 1.1, w: 7,  h: 14, d: 9  },
    { x: -20, z: 95,  rx: 0.08, rz: -0.11, sy: 0.95,w: 13, h: 21, d: 15 },
  ];
  hangDefs.forEach(({ x, z, rx, rz, sy, w, h, d }) => {
    const mod = new THREE.Mesh(new THREE.BoxGeometry(w, h * sy, d), hullMat(0x1c1814, 0.95, 0.4));
    mod.position.set(x, -12 - h * sy * 0.5, z);
    mod.rotation.x = rx; mod.rotation.z = rz;
    hangGroup.add(mod);

    const acc = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.3, d * 0.6), hullMat(0x251f1b, 0.93, 0.45));
    acc.position.set(x + 1, -12 - h * sy - h * 0.2, z - 1);
    hangGroup.add(acc);
  });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + i * 0.3;
    const r = 45 + Math.sin(i * 1.7) * 30;
    const h = 8 + Math.cos(i * 2.3) * 5;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, h, 5), hullMat(0x1a1612, 0.95, 0.5));
    tube.position.set(Math.cos(angle) * r, -10 - h * 0.5, Math.sin(angle) * r);
    hangGroup.add(tube);
  }
  shipGroup.add(hangGroup);

  // ── Underside panels ────────────────────────────────────────────────────────
  const panelGroup = new THREE.Group();
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = 30 + (i % 5) * 10;
    const w = 8 + (i % 3) * 4;
    const d = 6 + (i % 4) * 3;
    const panelMat = hullMat(i % 3 === 0 ? 0x1e1c18 : i % 3 === 1 ? 0x252018 : 0x1a1814, 0.95, 0.45);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), panelMat);
    panel.position.set(Math.cos(angle) * r, -4 - (i % 4) * 1.5, Math.sin(angle) * r);
    panel.rotation.y = angle + i * 0.2;
    panelGroup.add(panel);
  }
  shipGroup.add(panelGroup);

  // ── Orange glow lights ───────────────────────────────────────────────────────
  const pointLights: THREE.PointLight[] = [];
  const lightDefs = [
    { x: 0,   y: -8, z: 0,   intensity: 12, color: 0xff8833 },
    { x: 45,  y: -6, z: 20,  intensity: 8,  color: 0xff6622 },
    { x: -50, y: -7, z: -15, intensity: 9,  color: 0xffaa44 },
    { x: 20,  y: -5, z: -60, intensity: 7,  color: 0xff7733 },
    { x: -25, y: -6, z: 55,  intensity: 8,  color: 0xff5511 },
    { x: 70,  y: -5, z: -40, intensity: 6,  color: 0xffbb55 },
    { x: -65, y: -7, z: 45,  intensity: 7,  color: 0xff6633 },
    { x: 30,  y: -4, z: 80,  intensity: 5,  color: 0xff8844 },
    { x: -80, y: -5, z: -30, intensity: 6,  color: 0xff5522 },
    { x: 55,  y: -6, z: -70, intensity: 5,  color: 0xffaa33 },
    { x: 12,  y: -5, z: 35,  intensity: 3,  color: 0xff7722 },
    { x: -35, y: -4, z: -50, intensity: 3,  color: 0xff6611 },
    { x: 80,  y: -5, z: 10,  intensity: 4,  color: 0xffcc55 },
    { x: -15, y: -6, z: -85, intensity: 4,  color: 0xff8833 },
  ];
  lightDefs.forEach(({ x, y, z, intensity, color }) => {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.5 + intensity * 0.15, 8, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    glow.position.set(x, y, z);
    shipGroup.add(glow);

    const light = new THREE.PointLight(color, intensity, 80, 2);
    light.position.set(x, y, z);
    // Store base intensity for flicker animation
    (light as THREE.PointLight & { _base: number })._base = intensity;
    shipGroup.add(light);
    pointLights.push(light);
  });

  // ── Debris particles around the ship ────────────────────────────────────────
  const count = 500;
  const debrisPos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 80;
    debrisPos[i * 3]     = Math.cos(theta) * r;
    debrisPos[i * 3 + 1] = (Math.random() - 0.5) * 30;
    debrisPos[i * 3 + 2] = Math.sin(theta) * r;
  }
  const debrisGeo = new THREE.BufferGeometry();
  debrisGeo.setAttribute("position", new THREE.BufferAttribute(debrisPos, 3));
  const debris = new THREE.Points(
    debrisGeo,
    new THREE.PointsMaterial({ color: 0x8a7a6a, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.45 })
  );
  shipGroup.add(debris);

  return { group: shipGroup, lights: pointLights };
}
