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

/** Local-space box collider (relative to a group origin). */
export interface RuinsBoxCollider {
  lx: number; lz: number;
  halfW: number; halfD: number;
  rotY: number;
  /** Local Y centre of the collider (default 0). */
  ly?: number;
  /** Half-height of the collider (default 0 → effectively flat barrier). */
  halfH?: number;
  /** True if the player can stand on the top face (default false). */
  walkable?: boolean;
}
/** Local-space cylinder collider (relative to a group origin). */
export interface RuinsCylCollider {
  lx: number; lz: number;
  radius: number;
  /** Full height of the cylinder (default 0 → effectively a flat disc). */
  height?: number;
  /** True if the player can stand on the top face (default false). */
  walkable?: boolean;
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
  boxColliders.push({ lx: 0, lz: 0, halfW: 4, halfD: 0.35, rotY: w1.rotation.y, ly: w1H / 2, halfH: w1H / 2, walkable: true });

  // Side wall (partial)
  const w2H = 1.8 + rng() * 1.5;
  const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, w2H, 6), stoneMat);
  w2.position.set(4, w2H / 2, -3);
  w2.castShadow = true;
  group.add(w2);
  boxColliders.push({ lx: 4, lz: -3, halfW: 0.35, halfD: 3, rotY: 0, ly: w2H / 2, halfH: w2H / 2, walkable: true });

  // Arch remnant
  const archBaseL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), darkStoneMat);
  archBaseL.position.set(-2, 1.75, 0.1);
  archBaseL.castShadow = true;
  group.add(archBaseL);
  cylColliders.push({ lx: -2, lz: 0.1, radius: 0.6, height: 3.5, walkable: false });

  const archBaseR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), darkStoneMat);
  archBaseR.position.set(2, 1.75, 0.1);
  archBaseR.castShadow = true;
  group.add(archBaseR);
  cylColliders.push({ lx: 2, lz: 0.1, radius: 0.6, height: 3.5, walkable: false });

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
    cylColliders.push({ lx: colX, lz: colZ, radius: 0.5, height: colH, walkable: false });
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
 * Helper: compute rotation.z so a CylinderGeometry (default Y-axis) points
 * from point A to point B in the XY plane.
 * Formula: rotation.z = atan2(-dx, dy) where (dx, dy) = B - A.
 */
function bowLimbRotZ(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(-(bx - ax), by - ay);
}

/** First-person bow with curved limbs and a visible string. */
export function buildBowMesh(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a4a1a });
  const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x4a2a08 });
  const stringMat = new THREE.MeshLambertMaterial({ color: 0xeeddbb });
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0x8b5e3c });
  const arrowTipMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
  const fletchingMat = new THREE.MeshLambertMaterial({ color: 0xdd4444 });

  // ── Grip (center handle) ─────────────────────────────────────────────────
  const gripGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.14, 8);
  const grip = new THREE.Mesh(gripGeo, darkWoodMat);
  group.add(grip);

  // ── Limb keypoints (X = toward string, Y = up/down) ──────────────────────
  // Upper limb: K0 (grip top) → K1 → K2 → K3 (tip)
  // Each segment is oriented so its Y-axis aligns with the segment direction,
  // wider end (larger radius) at the grip side, narrower at the tip.
  const K = {
    // Upper limb
    u0: [0.000,  0.070] as [number, number],
    u1: [0.022,  0.153] as [number, number],
    u2: [0.054,  0.231] as [number, number],
    u3: [0.086,  0.306] as [number, number],
    // Lower limb (mirror of upper in Y)
    l0: [0.000, -0.070] as [number, number],
    l1: [0.022, -0.153] as [number, number],
    l2: [0.054, -0.231] as [number, number],
    l3: [0.086, -0.306] as [number, number],
  };

  // ── Upper limb – segment 1 (K u0 → u1) ──────────────────────────────────
  const u1Len = Math.hypot(K.u1[0] - K.u0[0], K.u1[1] - K.u0[1]);
  const u1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, u1Len, 7), woodMat);
  u1.position.set((K.u0[0] + K.u1[0]) / 2, (K.u0[1] + K.u1[1]) / 2, 0);
  u1.rotation.z = bowLimbRotZ(K.u0[0], K.u0[1], K.u1[0], K.u1[1]);
  group.add(u1);

  // ── Upper limb – segment 2 (K u1 → u2) ──────────────────────────────────
  const u2Len = Math.hypot(K.u2[0] - K.u1[0], K.u2[1] - K.u1[1]);
  const u2 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, u2Len, 7), woodMat);
  u2.position.set((K.u1[0] + K.u2[0]) / 2, (K.u1[1] + K.u2[1]) / 2, 0);
  u2.rotation.z = bowLimbRotZ(K.u1[0], K.u1[1], K.u2[0], K.u2[1]);
  group.add(u2);

  // ── Upper limb – segment 3 (K u2 → u3, tip) ─────────────────────────────
  const u3Len = Math.hypot(K.u3[0] - K.u2[0], K.u3[1] - K.u2[1]);
  const u3 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, u3Len, 6), woodMat);
  u3.position.set((K.u2[0] + K.u3[0]) / 2, (K.u2[1] + K.u3[1]) / 2, 0);
  u3.rotation.z = bowLimbRotZ(K.u2[0], K.u2[1], K.u3[0], K.u3[1]);
  group.add(u3);

  // ── Lower limb – segment 1 (K l0 → l1) ──────────────────────────────────
  // Going downward; wider end at the grip side (l0), narrower at l1.
  // rotation.z ≈ -(π - upper_angle) to correctly orient downward+rightward.
  const l1Len = Math.hypot(K.l1[0] - K.l0[0], K.l1[1] - K.l0[1]);
  const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, l1Len, 7), woodMat);
  l1.position.set((K.l0[0] + K.l1[0]) / 2, (K.l0[1] + K.l1[1]) / 2, 0);
  l1.rotation.z = bowLimbRotZ(K.l0[0], K.l0[1], K.l1[0], K.l1[1]);
  group.add(l1);

  // ── Lower limb – segment 2 (K l1 → l2) ──────────────────────────────────
  const l2Len = Math.hypot(K.l2[0] - K.l1[0], K.l2[1] - K.l1[1]);
  const l2 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, l2Len, 7), woodMat);
  l2.position.set((K.l1[0] + K.l2[0]) / 2, (K.l1[1] + K.l2[1]) / 2, 0);
  l2.rotation.z = bowLimbRotZ(K.l1[0], K.l1[1], K.l2[0], K.l2[1]);
  group.add(l2);

  // ── Lower limb – segment 3 (K l2 → l3, tip) ─────────────────────────────
  const l3Len = Math.hypot(K.l3[0] - K.l2[0], K.l3[1] - K.l2[1]);
  const l3 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, l3Len, 6), woodMat);
  l3.position.set((K.l2[0] + K.l3[0]) / 2, (K.l2[1] + K.l3[1]) / 2, 0);
  l3.rotation.z = bowLimbRotZ(K.l2[0], K.l2[1], K.l3[0], K.l3[1]);
  group.add(l3);

  // ── Bowstring group (animated – pulled back when drawing) ─────────────────
  // Named "bowstring" so Game3D can find and animate it.
  const bowstringGroup = new THREE.Group();
  bowstringGroup.name = "bowstring";

  // String runs from upper tip to lower tip; tips are at X=0.086, Y=±0.306.
  // String positioned at X=0.092 (slightly in front of tips for visual clarity).
  const stringHeight = K.u3[1] * 2 + 0.012; // ≈ 0.624
  const stringGeo = new THREE.BoxGeometry(0.003, stringHeight, 0.002);
  const stringMesh = new THREE.Mesh(stringGeo, stringMat);
  stringMesh.position.set(0.092, 0, 0);
  bowstringGroup.add(stringMesh);

  // ── Arrow nocked on the string (child of bowstringGroup so it pulls with it)
  const arrowGroup = new THREE.Group();
  arrowGroup.name = "nockedArrow";
  // Shaft – oriented along -Z (into screen = forward)
  const shaftGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.36, 6);
  const shaft = new THREE.Mesh(shaftGeo, arrowMat);
  shaft.rotation.x = Math.PI / 2;         // Y→Z: arrow points along Z
  shaft.position.set(0.072, 0, -0.08);    // resting on string, pointing forward
  arrowGroup.add(shaft);

  // Arrowhead (cone pointing forward = -Z)
  const tipGeo = new THREE.ConeGeometry(0.008, 0.036, 6);
  const arrowTip = new THREE.Mesh(tipGeo, arrowTipMat);
  arrowTip.rotation.x = -Math.PI / 2;     // tip of cone toward -Z
  arrowTip.position.set(0.072, 0, -0.278);
  arrowGroup.add(arrowTip);

  // Fletching (two flat fins at nock end)
  const fletchGeo = new THREE.BoxGeometry(0.002, 0.030, 0.048);
  const fletch1 = new THREE.Mesh(fletchGeo, fletchingMat);
  fletch1.position.set(0.078, 0.016, 0.098);
  arrowGroup.add(fletch1);
  const fletch2 = new THREE.Mesh(fletchGeo.clone(), fletchingMat);
  fletch2.position.set(0.078, -0.016, 0.098);
  arrowGroup.add(fletch2);

  bowstringGroup.add(arrowGroup);
  group.add(bowstringGroup);

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

// ─── Sniper Tower ─────────────────────────────────────────────────────────────
/**
 * A tall stone observation tower with a spiral staircase on the exterior and a
 * sniper nest platform at the top.
 *
 * Origin sits at the base (ground level).
 * Tower height: SNIPER_TOWER_HEIGHT (16 units above ground).
 * Staircase wraps around the exterior (radius 3.0 – 5.2 from tower centre).
 *
 * Returns the root group and the world-space Y of the top platform floor
 * (relative to the group origin, so add terrain height to get world Y).
 */
export interface SniperTowerResult {
  group: THREE.Group;
  /** Y of the top platform surface relative to group origin (group Y = terrain height). */
  topPlatformY: number;
  /** Cylinder collider radius for the solid tower body (excludes staircase). */
  towerBodyRadius: number;
  /** Outer radius of the staircase ramp for physics. */
  stairOuterRadius: number;
  /** Inner radius of the staircase ramp (== tower body radius). */
  stairInnerRadius: number;
}

export const SNIPER_TOWER_HEIGHT = 16; // usable height from base to top platform

export function buildSniperTowerMesh(): SniperTowerResult {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x888070 });
  const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x5a5448 });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a5030 });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const battlementMat = new THREE.MeshLambertMaterial({ color: 0x706858 });

  const TOWER_RADIUS = 2.8;
  const TOWER_HEIGHT = SNIPER_TOWER_HEIGHT;
  const STAIR_INNER = TOWER_RADIUS;
  const STAIR_OUTER = 5.0;
  const STAIR_WIDTH = STAIR_OUTER - STAIR_INNER;

  // ── Tower body (stone cylinder) ────────────────────────────────────────────
  const towerBodyGeo = new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS + 0.3, TOWER_HEIGHT, 16);
  const towerBody = new THREE.Mesh(towerBodyGeo, stoneMat);
  towerBody.position.y = TOWER_HEIGHT / 2;
  towerBody.castShadow = true;
  towerBody.receiveShadow = true;
  group.add(towerBody);

  // ── Horizontal mortar lines (decorative bands) ─────────────────────────────
  for (let i = 2; i < TOWER_HEIGHT; i += 2) {
    const bandGeo = new THREE.TorusGeometry(TOWER_RADIUS + 0.05, 0.08, 4, 24);
    const band = new THREE.Mesh(bandGeo, darkStoneMat);
    band.position.y = i;
    band.rotation.x = Math.PI / 2;
    group.add(band);
  }

  // ── Spiral staircase (32 steps wrapping once around the exterior) ──────────
  const STEP_COUNT = 32;
  const stepGeo = new THREE.BoxGeometry(STAIR_WIDTH, 0.22, 1.4);
  for (let i = 0; i < STEP_COUNT; i++) {
    const angle = (i / STEP_COUNT) * Math.PI * 2 - Math.PI / 2; // start from south
    const stepFraction = i / STEP_COUNT;
    const stepY = stepFraction * TOWER_HEIGHT;
    const midR = STAIR_INNER + STAIR_WIDTH / 2;
    const step = new THREE.Mesh(stepGeo, darkStoneMat);
    step.position.set(
      Math.cos(angle) * midR,
      stepY,
      Math.sin(angle) * midR
    );
    step.rotation.y = -angle;
    step.castShadow = true;
    group.add(step);
  }

  // ── Staircase railing (thin posts + handrail ring) ─────────────────────────
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.1, 5);
  const RAILING_POSTS = 20;
  for (let i = 0; i < RAILING_POSTS; i++) {
    const angle = (i / RAILING_POSTS) * Math.PI * 2 - Math.PI / 2;
    const frac = i / RAILING_POSTS;
    const postY = frac * TOWER_HEIGHT + 0.55;
    const post = new THREE.Mesh(postGeo, metalMat);
    post.position.set(
      Math.cos(angle) * STAIR_OUTER,
      postY,
      Math.sin(angle) * STAIR_OUTER
    );
    group.add(post);
  }

  // Outer handrail tube (torus approximation using a torus that wraps once)
  // Use a series of short cylinders to approximate the spiral rail
  const railSegGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.9, 5);
  for (let i = 0; i < RAILING_POSTS; i++) {
    const a0 = (i / RAILING_POSTS) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / RAILING_POSTS) * Math.PI * 2 - Math.PI / 2;
    const f0 = i / RAILING_POSTS;
    const f1 = (i + 1) / RAILING_POSTS;
    const aMid = (a0 + a1) / 2;
    const fMid = (f0 + f1) / 2;
    const x0 = Math.cos(a0) * STAIR_OUTER;
    const z0 = Math.sin(a0) * STAIR_OUTER;
    const y0 = f0 * TOWER_HEIGHT + 0.9;
    const x1 = Math.cos(a1) * STAIR_OUTER;
    const z1 = Math.sin(a1) * STAIR_OUTER;
    const y1 = f1 * TOWER_HEIGHT + 0.9;
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    const midZ = (z0 + z1) / 2;
    const seg = new THREE.Mesh(railSegGeo, metalMat);
    seg.position.set(midX, midY, midZ);
    // Orient from p0 to p1
    const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize();
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(seg);
  }

  // ── Top platform ──────────────────────────────────────────────────────────
  const TOP_Y = TOWER_HEIGHT;
  const platformGeo = new THREE.CylinderGeometry(TOWER_RADIUS + 1.0, TOWER_RADIUS + 0.2, 0.45, 16);
  const platform = new THREE.Mesh(platformGeo, stoneMat);
  platform.position.y = TOP_Y + 0.225;
  platform.castShadow = true;
  platform.receiveShadow = true;
  group.add(platform);

  // ── Battlements (merlons around top) ──────────────────────────────────────
  const MERLON_COUNT = 12;
  const merlonGeo = new THREE.BoxGeometry(0.7, 1.2, 0.6);
  for (let i = 0; i < MERLON_COUNT; i++) {
    const angle = (i / MERLON_COUNT) * Math.PI * 2;
    const merlon = new THREE.Mesh(merlonGeo, battlementMat);
    const mr = TOWER_RADIUS + 0.7;
    merlon.position.set(
      Math.cos(angle) * mr,
      TOP_Y + 0.45 + 0.6,
      Math.sin(angle) * mr
    );
    merlon.rotation.y = angle;
    merlon.castShadow = true;
    group.add(merlon);
  }

  // ── Sniper platform floor (wooden planks) ──────────────────────────────────
  const floorGeo = new THREE.CylinderGeometry(TOWER_RADIUS - 0.1, TOWER_RADIUS - 0.1, 0.15, 16);
  const floor = new THREE.Mesh(floorGeo, woodMat);
  floor.position.y = TOP_Y + 0.52;
  floor.receiveShadow = true;
  group.add(floor);

  // ── Sniper rifle on stand at top ──────────────────────────────────────────
  // Display sniper rifle on a wooden stand pointing outward
  const standPostGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6);
  const standPost = new THREE.Mesh(standPostGeo, woodMat);
  standPost.position.set(0, TOP_Y + 0.52 + 0.35, -1.2);
  group.add(standPost);

  const standBaseGeo = new THREE.BoxGeometry(0.5, 0.08, 0.3);
  const standBase = new THREE.Mesh(standBaseGeo, woodMat);
  standBase.position.set(0, TOP_Y + 0.52 + 0.08, -1.2);
  group.add(standBase);

  // Rifle display (use a simplified version from buildSniperMesh idea)
  const rifleBarrelGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8);
  const rifleBarrel = new THREE.Mesh(rifleBarrelGeo, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(0, TOP_Y + 0.52 + 0.72, -1.2);
  group.add(rifleBarrel);

  const rifleBodyGeo = new THREE.BoxGeometry(0.14, 0.12, 0.55);
  const rifleBody = new THREE.Mesh(rifleBodyGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rifleBody.position.set(0, TOP_Y + 0.52 + 0.72, -0.8);
  group.add(rifleBody);

  const rifleScopeGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10);
  const rifleScope = new THREE.Mesh(rifleScopeGeo, new THREE.MeshLambertMaterial({ color: 0x333333 }));
  rifleScope.rotation.x = Math.PI / 2;
  rifleScope.position.set(0, TOP_Y + 0.52 + 0.845, -0.82);
  group.add(rifleScope);

  // Scope lens glow
  const scopeLensGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.008, 10);
  const scopeLens = new THREE.Mesh(scopeLensGeo, new THREE.MeshLambertMaterial({
    color: 0x88ccff,
    emissive: 0x4488cc,
    emissiveIntensity: 0.5,
  }));
  scopeLens.rotation.x = Math.PI / 2;
  scopeLens.position.set(0, TOP_Y + 0.52 + 0.845, -1.055);
  group.add(scopeLens);

  // Subtle ambient glow at top (hint for the player)
  const glowLight = new THREE.PointLight(0x9966ff, 1.2, 8);
  glowLight.position.set(0, TOP_Y + 1.5, 0);
  group.add(glowLight);

  const topPlatformY = TOP_Y + 0.52;

  return {
    group,
    topPlatformY,
    towerBodyRadius: TOWER_RADIUS,
    stairOuterRadius: STAIR_OUTER,
    stairInnerRadius: STAIR_INNER,
  };
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

// ─── Rocket ───────────────────────────────────────────────────────────────────
// A sleek rocket standing on its launch pad.  Returns:
//   group       – root THREE.Group (everything)
//   flameGroup  – sub-group for engine flame (toggle visible)
//   launchPad   – sub-group for the launch pad beneath the rocket
//   exhaustParticles – array of Mesh for animated smoke puffs
//
// Geometry overview (all local Y measured from ground level):
//   0 – 0.5   launch pad  (flat concrete slab)
//   0.5 – 9   rocket body (cylinder, radius 0.85)
//   9 – 12    nose cone   (ConeGeometry tapering to tip)
//   0.5 fin stubs at Y≈1.5–4, splayed 45° at base
export function buildRocketMesh(): {
  group: THREE.Group;
  flameGroup: THREE.Group;
  launchPad: THREE.Group;
  exhaustParticles: THREE.Mesh[];
} {
  const group = new THREE.Group();

  // ── Materials ───────────────────────────────────────────────────────────────
  const bodyMat   = new THREE.MeshLambertMaterial({ color: 0xdde8f0 });   // white body
  const accentMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });   // red accent
  const metalMat  = new THREE.MeshLambertMaterial({ color: 0x9aacbc });   // metallic parts
  const nozzleMat = new THREE.MeshLambertMaterial({ color: 0x555566 });   // dark nozzle
  const glassMat  = new THREE.MeshLambertMaterial({ color: 0x66aadd, transparent: true, opacity: 0.6 }); // porthole glass
  const padMat    = new THREE.MeshLambertMaterial({ color: 0x888899 });   // concrete pad
  const flameMat  = new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: new THREE.Color(0xff5500), emissiveIntensity: 1.2 });
  const smokeMat  = new THREE.MeshLambertMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.55 });

  // ── Launch pad ──────────────────────────────────────────────────────────────
  const launchPad = new THREE.Group();

  // Main concrete slab
  const slabGeo = new THREE.BoxGeometry(6, 0.4, 6);
  const slab = new THREE.Mesh(slabGeo, padMat);
  slab.position.y = 0.2;
  slab.receiveShadow = true;
  launchPad.add(slab);

  // Support legs (4 corner pillars)
  const legGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.4, 8);
  [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(x, -0.2, z);
    launchPad.add(leg);
  });

  // Launch tower arm (one gantry arm pointing toward rocket)
  const towerBaseGeo = new THREE.BoxGeometry(0.35, 10, 0.35);
  const tower = new THREE.Mesh(towerBaseGeo, metalMat);
  tower.position.set(-4, 5, 0);
  tower.castShadow = true;
  launchPad.add(tower);

  // Gantry crossbeam
  const armGeo = new THREE.BoxGeometry(3.6, 0.22, 0.22);
  [4.0, 6.5, 9.0].forEach((y) => {
    const arm = new THREE.Mesh(armGeo, metalMat);
    arm.position.set(-2.2, y, 0);
    launchPad.add(arm);
  });

  // NOTE: launchPad is NOT added to group here — it is placed directly in the
  // scene from Game3D.tsx so that it stays on the ground while the rocket flies.

  // ── Rocket body (cylinder, sits above the slab) ─────────────────────────────
  const bodyGeo = new THREE.CylinderGeometry(0.82, 0.88, 8.5, 16);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 4.65 + 0.4; // half height + slab top
  body.castShadow = true;
  group.add(body);

  // Red accent stripe around middle of body
  const stripeGeo = new THREE.CylinderGeometry(0.90, 0.90, 0.38, 16);
  const stripe = new THREE.Mesh(stripeGeo, accentMat);
  stripe.position.y = 5.5;
  group.add(stripe);

  // Second stripe (upper)
  const stripe2 = new THREE.Mesh(stripeGeo.clone(), accentMat);
  stripe2.position.y = 7.8;
  group.add(stripe2);

  // ── Nose cone ───────────────────────────────────────────────────────────────
  const coneGeo = new THREE.ConeGeometry(0.82, 3.2, 16);
  const noseCone = new THREE.Mesh(coneGeo, bodyMat);
  noseCone.position.y = 10.5; // body top + half cone height
  noseCone.castShadow = true;
  group.add(noseCone);

  // Nose cone tip accent
  const tipGeo = new THREE.ConeGeometry(0.18, 0.7, 8);
  const tip = new THREE.Mesh(tipGeo, accentMat);
  tip.position.y = 12.3;
  group.add(tip);

  // ── Porthole window ─────────────────────────────────────────────────────────
  const portholeRimGeo = new THREE.TorusGeometry(0.32, 0.07, 8, 16);
  const portholeRim = new THREE.Mesh(portholeRimGeo, metalMat);
  portholeRim.position.set(0.88, 7.5, 0);
  portholeRim.rotation.y = Math.PI / 2;
  group.add(portholeRim);

  const glassDiskGeo = new THREE.CircleGeometry(0.28, 16);
  const glassDisk = new THREE.Mesh(glassDiskGeo, glassMat);
  glassDisk.position.set(0.90, 7.5, 0);
  glassDisk.rotation.y = Math.PI / 2;
  group.add(glassDisk);

  // ── Fins (4 symmetric, placed at base of body) ──────────────────────────────
  const FIN_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  FIN_ANGLES.forEach((angle) => {
    const finGroup = new THREE.Group();
    finGroup.rotation.y = angle;

    // Main fin blade — tapered box
    const finGeo = new THREE.BoxGeometry(0.14, 3.5, 1.8);
    const fin = new THREE.Mesh(finGeo, accentMat);
    // Position so inner edge touches rocket body, fin sweeps back/out
    fin.position.set(1.4, 2.2, -0.4);
    fin.rotation.x = 0.3; // slight sweep-back
    fin.castShadow = true;
    finGroup.add(fin);

    group.add(finGroup);
  });

  // ── Engine nozzle (bell at very bottom of body) ──────────────────────────────
  const nozzleGeo = new THREE.CylinderGeometry(0.55, 0.80, 0.9, 12, 1, true);
  const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle.position.y = 0.4 + 0.45; // slab top + half nozzle
  group.add(nozzle);

  // ── Ladder rungs (on one side of the rocket body) ───────────────────────────
  for (let i = 0; i < 8; i++) {
    const rungGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6);
    const rung = new THREE.Mesh(rungGeo, metalMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0.91, 2.0 + i * 0.9, 0);
    group.add(rung);
  }
  // Ladder side rails
  const railGeo = new THREE.CylinderGeometry(0.025, 0.025, 7.2, 6);
  ([-0.22, 0.22] as const).forEach((z) => {
    const rail = new THREE.Mesh(railGeo, metalMat);
    rail.position.set(0.91, 5.6, z);
    group.add(rail);
  });

  // ── Flame / exhaust group (hidden by default) ────────────────────────────────
  const flameGroup = new THREE.Group();
  flameGroup.visible = false;

  // Core flame cone (bright orange/white center)
  const flameCoreMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffdd44),
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.9,
  });
  const flameCoreGeo = new THREE.ConeGeometry(0.45, 2.8, 12);
  const flameCore = new THREE.Mesh(flameCoreGeo, flameCoreMat);
  flameCore.rotation.x = Math.PI; // point downward
  flameCore.position.y = -0.5;
  flameGroup.add(flameCore);

  // Outer flame (larger, more orange)
  const flameOuterGeo = new THREE.ConeGeometry(0.75, 3.8, 12);
  const flameOuter = new THREE.Mesh(flameOuterGeo, flameMat);
  flameOuter.rotation.x = Math.PI;
  flameOuter.position.y = -0.8;
  flameGroup.add(flameOuter);

  // Place flame group at nozzle exit
  flameGroup.position.y = 0.9;
  group.add(flameGroup);

  // ── Exhaust smoke particles ─────────────────────────────────────────────────
  const exhaustParticles: THREE.Mesh[] = [];
  const puffGeo = new THREE.SphereGeometry(0.55, 8, 8);
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(puffGeo, smokeMat.clone());
    puff.visible = false;
    puff.position.y = -1.5 - i * 0.6;
    (puff.material as THREE.MeshLambertMaterial).opacity = 0.5 - i * 0.05;
    group.add(puff);
    exhaustParticles.push(puff);
  }

  group.castShadow = true;
  group.receiveShadow = true;

  return { group, flameGroup, launchPad, exhaustParticles };
}

// ─────────────────────────────────────────────────────────────────────────────
// Space Station Interior
// ─────────────────────────────────────────────────────────────────────────────

export interface SpaceStationInteriorResult {
  group: THREE.Group;
  /** Walkable AABB boxes in group-local space (used for collision). */
  rooms: THREE.Box3[];
  /** Player spawn position in group-local space (inside airlock). */
  spawnPosition: THREE.Vector3;
  /** Animated lights to flicker in animation loop. */
  lights: { light: THREE.PointLight; baseIntensity: number; phase: number }[];
  /** Animated holographic displays to rotate/pulse. */
  animatedMeshes: { mesh: THREE.Mesh; type: 'hologram' | 'reactor' | 'panel' }[];
}

/**
 * Build a walkable space-station interior.
 *
 * Room layout (X = right, Y = up, Z = forward/into corridor):
 *
 *   [Airlock] ──── [Main Corridor] ──── [Bridge]
 *                        │
 *               ┌────────┴────────┐
 *          [Crew Quarters]  [Engineering Bay]
 *
 * The group origin is the centre of the Airlock floor.
 * Rooms are defined so the player (PLAYER_HEIGHT = 1.8) can walk inside them.
 */
export function buildSpaceStationInterior(): SpaceStationInteriorResult {
  const group = new THREE.Group();

  // ── Shared materials ──────────────────────────────────────────────────────
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x1a2233,
    roughness: 0.8,
    metalness: 0.6,
  });
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1c2b3a,
    roughness: 0.7,
    metalness: 0.4,
  });
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x111924,
    roughness: 0.9,
    metalness: 0.3,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.5,
    metalness: 0.7,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a9f,
    roughness: 0.4,
    metalness: 0.8,
    emissive: new THREE.Color(0x0a2040),
    emissiveIntensity: 0.5,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x0a1830,
    roughness: 0.0,
    metalness: 0.1,
    emissive: new THREE.Color(0x050d1a),
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.85,
  });
  const glowGreenMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: new THREE.Color(0x00ff88),
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0.1,
  });
  const glowBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: new THREE.Color(0x0055cc),
    emissiveIntensity: 2.0,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7,
  });
  const reactorMat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 2.5,
    roughness: 0.2,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x3a4a5a,
    roughness: 0.6,
    metalness: 0.9,
  });
  const consoleMat = new THREE.MeshStandardMaterial({
    color: 0x0d1f33,
    roughness: 0.5,
    metalness: 0.8,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x001a33,
    emissive: new THREE.Color(0x002266),
    emissiveIntensity: 1.8,
    roughness: 0.0,
    metalness: 0.0,
  });
  const warningMat = new THREE.MeshStandardMaterial({
    color: 0xff4400,
    emissive: new THREE.Color(0xff2200),
    emissiveIntensity: 1.2,
    roughness: 0.4,
    metalness: 0.3,
  });
  const doorFrameMat = new THREE.MeshStandardMaterial({
    color: 0x2a5080,
    roughness: 0.4,
    metalness: 0.9,
    emissive: new THREE.Color(0x0a1830),
    emissiveIntensity: 0.6,
  });

  // ── Room definitions (walkable AABB) ────────────────────────────────────
  // Y=0 is the floor level; player height = 1.8
  const rooms: THREE.Box3[] = [];
  const lights: { light: THREE.PointLight; baseIntensity: number; phase: number }[] = [];
  const animatedMeshes: { mesh: THREE.Mesh; type: 'hologram' | 'reactor' | 'panel' }[] = [];

  // Helper: add a room box and build its visible walls/floor/ceiling
  const addRoom = (
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
    _name: string
  ) => {
    rooms.push(new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ)
    ));

    const w = maxX - minX;
    const h = maxY - minY;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    // Floor
    const floorGeo = new THREE.BoxGeometry(w - 0.1, 0.12, d - 0.1);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(cx, minY + 0.06, cz);
    group.add(floor);

    // Ceiling
    const ceilGeo = new THREE.BoxGeometry(w - 0.1, 0.12, d - 0.1);
    const ceil = new THREE.Mesh(ceilGeo, ceilingMat);
    ceil.position.set(cx, maxY - 0.06, cz);
    group.add(ceil);

    // Walls (hull panels — will be partially overridden with decorative meshes)
    // Left wall (-X face)
    const wallLGeo = new THREE.BoxGeometry(0.15, h, d);
    const wallL = new THREE.Mesh(wallLGeo, hullMat);
    wallL.position.set(minX + 0.07, cy, cz);
    group.add(wallL);

    // Right wall (+X face)
    const wallR = new THREE.Mesh(wallLGeo, hullMat);
    wallR.position.set(maxX - 0.07, cy, cz);
    group.add(wallR);

    // Front wall (+Z face)
    const wallFGeo = new THREE.BoxGeometry(w, h, 0.15);
    const wallF = new THREE.Mesh(wallFGeo, hullMat);
    wallF.position.set(cx, cy, maxZ - 0.07);
    group.add(wallF);

    // Back wall (-Z face)
    const wallB = new THREE.Mesh(wallFGeo, hullMat);
    wallB.position.set(cx, cy, minZ + 0.07);
    group.add(wallB);

    // Floor accent strips
    const stripGeo = new THREE.BoxGeometry(w - 0.5, 0.04, 0.08);
    for (let i = 0; i < 3; i++) {
      const strip = new THREE.Mesh(stripGeo, accentMat);
      strip.position.set(cx, minY + 0.16, minZ + (d / 4) + i * (d / 4));
      group.add(strip);
    }

    // Ceiling lights (strip)
    const ceilLightGeo = new THREE.BoxGeometry(w * 0.7, 0.06, 0.25);
    const ceilLight = new THREE.Mesh(ceilLightGeo, glowBlueMat);
    ceilLight.position.set(cx, maxY - 0.1, cz);
    group.add(ceilLight);

    // Add a point light for this room
    const pLight = new THREE.PointLight(0x4488ff, 1.5, Math.max(w, d) * 1.8);
    pLight.position.set(cx, maxY - 0.5, cz);
    group.add(pLight);
    lights.push({ light: pLight, baseIntensity: 1.5, phase: Math.random() * Math.PI * 2 });
  };

  // Helper: add a door frame between rooms
  const addDoorFrame = (cx: number, cy: number, cz: number, axis: 'x' | 'z') => {
    const fw = axis === 'x' ? 0.2 : 2.2;
    const fd = axis === 'x' ? 2.2 : 0.2;
    // Left/right door pillars
    const pillarGeo = new THREE.BoxGeometry(fw, 3.0, fd);
    const leftPillar = new THREE.Mesh(pillarGeo, doorFrameMat);
    if (axis === 'x') {
      leftPillar.position.set(cx, cy + 0.5, cz - 1.4);
    } else {
      leftPillar.position.set(cx - 1.4, cy + 0.5, cz);
    }
    group.add(leftPillar);
    const rightPillar = new THREE.Mesh(pillarGeo, doorFrameMat);
    if (axis === 'x') {
      rightPillar.position.set(cx, cy + 0.5, cz + 1.4);
    } else {
      rightPillar.position.set(cx + 1.4, cy + 0.5, cz);
    }
    group.add(rightPillar);
    // Top beam
    const beamGeo = new THREE.BoxGeometry(fw, 0.25, fd === 0.2 ? 3.0 : 0.2);
    const topBeam = new THREE.Mesh(
      axis === 'x' ? new THREE.BoxGeometry(0.2, 0.25, 3.0) : new THREE.BoxGeometry(3.0, 0.25, 0.2),
      doorFrameMat
    );
    topBeam.position.set(cx, cy + 2.1, cz);
    group.add(topBeam);
    void beamGeo.dispose();
    void beamGeo; // suppress unused warning
  };

  // Helper: add a console desk with screen
  const addConsole = (x: number, y: number, z: number, rotY: number) => {
    const deskGeo = new THREE.BoxGeometry(2.0, 0.8, 0.8);
    const desk = new THREE.Mesh(deskGeo, consoleMat);
    desk.position.set(x, y + 0.4, z);
    desk.rotation.y = rotY;
    group.add(desk);

    const screenGeo = new THREE.BoxGeometry(1.5, 0.9, 0.06);
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(x, y + 1.0, z);
    screen.rotation.y = rotY;
    // Tilt screen back
    screen.rotation.x = -0.25;
    group.add(screen);

    // Small blinking indicators
    const indicatorGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const colors = [0x00ff44, 0xff4400, 0x0066ff];
    colors.forEach((col, i) => {
      const ind = new THREE.Mesh(indicatorGeo, new THREE.MeshStandardMaterial({
        color: col, emissive: new THREE.Color(col), emissiveIntensity: 2.0,
      }));
      const offsetX = -0.35 + i * 0.35;
      ind.position.set(x + Math.cos(rotY) * offsetX, y + 0.85, z + Math.sin(rotY) * offsetX);
      group.add(ind);
      animatedMeshes.push({ mesh: ind, type: 'panel' });
    });
  };

  // Helper: add a pipe segment
  const addPipe = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, radius = 0.08) => {
    const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
    const length = dir.length();
    dir.normalize();
    const pipeGeo = new THREE.CylinderGeometry(radius, radius, length, 8);
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.add(pipe);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // ROOM 1: Airlock (entry point, XZ centred at origin)
  //  X: -5 .. 5, Y: 0 .. 4, Z: -5 .. 5
  // ──────────────────────────────────────────────────────────────────────────
  addRoom(-5, 0, -5, 5, 4.5, 5, 'Airlock');

  // Airlock doors (visual only — outer door)
  const outerDoorGeo = new THREE.BoxGeometry(0.12, 3.0, 2.8);
  const outerDoorL = new THREE.Mesh(outerDoorGeo, doorFrameMat);
  outerDoorL.position.set(-4.93, 1.5, -1.0);
  group.add(outerDoorL);
  const outerDoorR = new THREE.Mesh(outerDoorGeo, doorFrameMat);
  outerDoorR.position.set(-4.93, 1.5, 1.0);
  group.add(outerDoorR);

  // Warning stripe on airlock floor
  const warnGeo = new THREE.BoxGeometry(1.5, 0.02, 4.0);
  const warnMesh = new THREE.Mesh(warnGeo, warningMat);
  warnMesh.position.set(-3.5, 0.14, 0);
  group.add(warnMesh);
  animatedMeshes.push({ mesh: warnMesh, type: 'panel' });

  // Airlock wall-mounted control panel (left wall)
  const cpGeo = new THREE.BoxGeometry(0.08, 1.2, 0.8);
  const cp = new THREE.Mesh(cpGeo, consoleMat);
  cp.position.set(-4.9, 1.4, 3.5);
  group.add(cp);
  // Screen on control panel
  const cpScreenGeo = new THREE.BoxGeometry(0.07, 0.7, 0.5);
  const cpScreen = new THREE.Mesh(cpScreenGeo, screenMat);
  cpScreen.position.set(-4.87, 1.6, 3.5);
  group.add(cpScreen);
  animatedMeshes.push({ mesh: cpScreen, type: 'panel' });

  // Airlock status light (green = safe)
  const statusLight = new THREE.PointLight(0x00ff44, 0.8, 6);
  statusLight.position.set(0, 3.8, 0);
  group.add(statusLight);
  lights.push({ light: statusLight, baseIntensity: 0.8, phase: 0.5 });

  // ──────────────────────────────────────────────────────────────────────────
  // ROOM 2: Main Corridor (connects airlock to bridge and side rooms)
  //  X: 5 .. 35, Y: 0 .. 4, Z: -3 .. 3
  // ──────────────────────────────────────────────────────────────────────────
  addRoom(5, 0, -3, 35, 4.5, 3, 'Main Corridor');

  // Door frames connecting airlock → corridor
  addDoorFrame(5, 0.5, 0, 'x');
  // Door frame at corridor → bridge
  addDoorFrame(35, 0.5, 0, 'x');

  // Ceiling pipes along corridor
  addPipe(5, 4.0, 1.5, 35, 4.0, 1.5, 0.07);
  addPipe(5, 4.0, -1.5, 35, 4.0, -1.5, 0.07);

  // Pipes with glowing nodes at intervals
  for (let px = 10; px <= 30; px += 10) {
    const nodeGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const nodeTop = new THREE.Mesh(nodeGeo, glowBlueMat);
    nodeTop.position.set(px, 4.0, 1.5);
    group.add(nodeTop);
    animatedMeshes.push({ mesh: nodeTop, type: 'panel' });
    const nodeBot = new THREE.Mesh(nodeGeo, glowBlueMat);
    nodeBot.position.set(px, 4.0, -1.5);
    group.add(nodeBot);
    animatedMeshes.push({ mesh: nodeBot, type: 'panel' });
  }

  // Storage lockers along right wall
  for (let lx = 8; lx <= 32; lx += 6) {
    const lockerGeo = new THREE.BoxGeometry(1.2, 2.6, 0.5);
    const locker = new THREE.Mesh(lockerGeo, panelMat);
    locker.position.set(lx, 1.3, 2.7);
    group.add(locker);
    const handleGeo = new THREE.BoxGeometry(0.08, 0.3, 0.06);
    const handle = new THREE.Mesh(handleGeo, accentMat);
    handle.position.set(lx + 0.2, 1.3, 2.46);
    group.add(handle);
  }

  // Small windows along left wall (viewport into space)
  for (let wx = 12; wx <= 30; wx += 9) {
    const winGeo = new THREE.BoxGeometry(0.08, 1.2, 1.4);
    const win = new THREE.Mesh(winGeo, windowMat);
    win.position.set(5.1, 2.2, wx - 20); // left wall of corridor at X=5
    // Actually corridor left wall is at X=5 (inner) — create window on it
    // We'll offset correctly: left wall is Z=±3, not X=5...
    // Corridor is X:5..35, Z:-3..3, so walls are at Z=-3 and Z=3, X=5 and X=35
    win.position.set(wx, 2.2, 2.93);
    group.add(win);

    // Star field behind window (emissive plane)
    const starBgGeo = new THREE.PlaneGeometry(1.3, 1.1);
    const starBgMat = new THREE.MeshStandardMaterial({
      color: 0x000010,
      emissive: new THREE.Color(0x000520),
      emissiveIntensity: 1.0,
    });
    const starBg = new THREE.Mesh(starBgGeo, starBgMat);
    starBg.position.set(wx, 2.2, 2.80);
    starBg.rotation.y = Math.PI;
    group.add(starBg);

    // A few stars on each window background
    const starGeo = new THREE.SphereGeometry(0.015, 4, 4);
    for (let s = 0; s < 12; s++) {
      const star = new THREE.Mesh(starGeo, new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 3.0,
      }));
      star.position.set(
        wx + (Math.random() - 0.5) * 1.2,
        2.2 + (Math.random() - 0.5) * 1.0,
        2.78
      );
      group.add(star);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROOM 3: Bridge (command centre, at far end of corridor)
  //  X: 35 .. 58, Y: -0.5 .. 6, Z: -12 .. 12
  // ──────────────────────────────────────────────────────────────────────────
  addRoom(35, 0, -12, 58, 6.0, 12, 'Bridge');

  // Large panoramic window on far wall of bridge
  const panoramaGeo = new THREE.BoxGeometry(0.12, 4.0, 18.0);
  const panorama = new THREE.Mesh(panoramaGeo, windowMat);
  panorama.position.set(57.93, 3.0, 0);
  group.add(panorama);

  // Stars visible through panoramic window
  for (let s = 0; s < 80; s++) {
    const sGeo = new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 4, 4);
    const sMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(s % 5 === 0 ? 0xffccaa : 0xffffff),
      emissiveIntensity: 2.5 + Math.random() * 1.5,
    });
    const star = new THREE.Mesh(sGeo, sMat);
    star.position.set(
      57.8 + Math.random() * 0.3,
      1.2 + Math.random() * 3.8,
      -8.0 + Math.random() * 16.0
    );
    group.add(star);
  }

  // Planet visible through panoramic window (the planet below)
  const planetGeo = new THREE.SphereGeometry(3.5, 24, 24);
  const planetMat = new THREE.MeshStandardMaterial({
    color: 0x2244aa,
    emissive: new THREE.Color(0x112255),
    emissiveIntensity: 0.4,
    roughness: 0.9,
  });
  const planet = new THREE.Mesh(planetGeo, planetMat);
  planet.position.set(62, -1, -5);
  group.add(planet);

  // Planet atmosphere glow
  const atmoGeo = new THREE.SphereGeometry(3.9, 24, 24);
  const atmoMat = new THREE.MeshStandardMaterial({
    color: 0x88bbff,
    emissive: new THREE.Color(0x4477cc),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.25,
  });
  const atmo = new THREE.Mesh(atmoGeo, atmoMat);
  atmo.position.copy(planet.position);
  group.add(atmo);

  // Captain's chair (centre of bridge)
  const chairBaseGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.15, 12);
  const chairBase = new THREE.Mesh(chairBaseGeo, consoleMat);
  chairBase.position.set(46, 0.15, 0);
  group.add(chairBase);
  const seatGeo = new THREE.BoxGeometry(1.2, 0.18, 1.0);
  const seat = new THREE.Mesh(seatGeo, panelMat);
  seat.position.set(46, 0.85, 0);
  group.add(seat);
  const backGeo = new THREE.BoxGeometry(1.2, 1.2, 0.14);
  const back = new THREE.Mesh(backGeo, panelMat);
  back.position.set(46, 1.4, 0.5);
  back.rotation.x = -0.15;
  group.add(back);

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.14, 0.1, 0.75);
  const armL = new THREE.Mesh(armGeo, consoleMat);
  armL.position.set(45.4, 1.0, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, consoleMat);
  armR.position.set(46.6, 1.0, 0);
  group.add(armR);

  // Bridge consoles in semicircle around captain's chair
  const consoleAngles = [-0.8, -0.4, 0, 0.4, 0.8];
  consoleAngles.forEach((angle) => {
    const cx2 = 52 + Math.sin(angle) * 3;
    const cz2 = Math.cos(angle) * 3;
    addConsole(cx2, 0, cz2, Math.PI + angle);
  });

  // Holographic display in centre of bridge (above captain's chair)
  const holoGeo = new THREE.TorusGeometry(1.2, 0.05, 8, 32);
  const holoRing = new THREE.Mesh(holoGeo, glowBlueMat);
  holoRing.position.set(46, 3.5, 0);
  group.add(holoRing);
  animatedMeshes.push({ mesh: holoRing, type: 'hologram' });

  const holoSphereGeo = new THREE.SphereGeometry(0.6, 16, 16);
  const holoSphere = new THREE.Mesh(holoSphereGeo, new THREE.MeshStandardMaterial({
    color: 0x0044cc,
    emissive: new THREE.Color(0x0022aa),
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.45,
    wireframe: false,
  }));
  holoSphere.position.set(46, 3.5, 0);
  group.add(holoSphere);
  animatedMeshes.push({ mesh: holoSphere, type: 'hologram' });

  const holoWireGeo = new THREE.SphereGeometry(0.62, 10, 10);
  const holoWire = new THREE.Mesh(holoWireGeo, new THREE.MeshStandardMaterial({
    color: 0x0088ff,
    emissive: new THREE.Color(0x0066dd),
    emissiveIntensity: 2.0,
    wireframe: true,
  }));
  holoWire.position.set(46, 3.5, 0);
  group.add(holoWire);
  animatedMeshes.push({ mesh: holoWire, type: 'hologram' });

  // Bridge overhead lights (stronger)
  const bridgeLight = new THREE.PointLight(0x3366ff, 2.0, 28);
  bridgeLight.position.set(46, 5.5, 0);
  group.add(bridgeLight);
  lights.push({ light: bridgeLight, baseIntensity: 2.0, phase: 1.0 });

  const bridgeAccentLight = new THREE.PointLight(0x00aaff, 1.2, 20);
  bridgeAccentLight.position.set(52, 5.0, 0);
  group.add(bridgeAccentLight);
  lights.push({ light: bridgeAccentLight, baseIntensity: 1.2, phase: 2.1 });

  // Wall display panels on bridge sides
  for (let pz = -9; pz <= 9; pz += 6) {
    const dispGeo = new THREE.BoxGeometry(0.1, 2.8, 3.2);
    const disp = new THREE.Mesh(dispGeo, screenMat);
    disp.position.set(35.1, 2.5, pz);
    group.add(disp);
    animatedMeshes.push({ mesh: disp, type: 'panel' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROOM 4: Crew Quarters (connected from main corridor, +Z side)
  //  X: 10 .. 28, Y: 0 .. 4.5, Z: 3 .. 20
  // ──────────────────────────────────────────────────────────────────────────
  addRoom(10, 0, 3, 28, 4.5, 20, 'Crew Quarters');

  // Door frame connecting corridor → crew quarters
  addDoorFrame(19, 0.5, 3, 'z');

  // Four bunk beds
  const bunkPositions = [[13, 6], [13, 16], [22, 6], [22, 16]] as [number, number][];
  bunkPositions.forEach(([bx, bz]) => {
    // Lower bunk
    const mattressGeo = new THREE.BoxGeometry(1.8, 0.2, 0.9);
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0x334466, roughness: 0.9 });
    const mattress = new THREE.Mesh(mattressGeo, mattressMat);
    mattress.position.set(bx, 0.55, bz);
    group.add(mattress);
    const frameGeo = new THREE.BoxGeometry(1.9, 0.08, 1.0);
    const frame = new THREE.Mesh(frameGeo, consoleMat);
    frame.position.set(bx, 0.35, bz);
    group.add(frame);
    // Upper bunk
    const mattressU = new THREE.Mesh(mattressGeo, mattressMat);
    mattressU.position.set(bx, 1.75, bz);
    group.add(mattressU);
    const frameU = new THREE.Mesh(frameGeo, consoleMat);
    frameU.position.set(bx, 1.55, bz);
    group.add(frameU);
    // Ladder
    for (let rung = 0; rung < 3; rung++) {
      const rungGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6);
      const rungMesh = new THREE.Mesh(rungGeo, pipeMat);
      rungMesh.rotation.z = Math.PI / 2;
      rungMesh.position.set(bx + 1.0, 0.55 + rung * 0.4, bz + 0.47);
      group.add(rungMesh);
    }
  });

  // Personal locker wall
  for (let lz = 5; lz <= 18; lz += 4.5) {
    const lockerGeo2 = new THREE.BoxGeometry(0.45, 2.8, 1.4);
    const locker2 = new THREE.Mesh(lockerGeo2, panelMat);
    locker2.position.set(27.7, 1.4, lz);
    group.add(locker2);
    // Locker screen/indicator
    const locScreenGeo = new THREE.BoxGeometry(0.08, 0.35, 0.55);
    const locScreen = new THREE.Mesh(locScreenGeo, screenMat);
    locScreen.position.set(27.48, 1.8, lz);
    group.add(locScreen);
    animatedMeshes.push({ mesh: locScreen, type: 'panel' });
  }

  // Reading light above each bunk
  bunkPositions.forEach(([bx, bz]) => {
    const readLight = new THREE.PointLight(0xffcc88, 0.6, 4);
    readLight.position.set(bx, 2.5, bz);
    group.add(readLight);
    lights.push({ light: readLight, baseIntensity: 0.6, phase: Math.random() * Math.PI * 2 });
  });

  // Small round window in crew quarters
  const crewWinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20);
  const crewWin = new THREE.Mesh(crewWinGeo, windowMat);
  crewWin.rotation.z = Math.PI / 2;
  crewWin.position.set(10.06, 2.4, 11.5);
  group.add(crewWin);
  for (let s = 0; s < 15; s++) {
    const sGeo2 = new THREE.SphereGeometry(0.018, 4, 4);
    const star2 = new THREE.Mesh(sGeo2, new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 3.0,
    }));
    star2.position.set(
      9.9,
      2.4 + (Math.random() - 0.5) * 0.9,
      11.5 + (Math.random() - 0.5) * 0.9
    );
    group.add(star2);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROOM 5: Engineering Bay (connected from main corridor, -Z side)
  //  X: 8 .. 32, Y: 0 .. 5.5, Z: -22 .. -3
  // ──────────────────────────────────────────────────────────────────────────
  addRoom(8, 0, -22, 32, 5.5, -3, 'Engineering Bay');

  // Door frame connecting corridor → engineering
  addDoorFrame(19, 0.5, -3, 'z');

  // Central reactor column
  const reactorColGeo = new THREE.CylinderGeometry(1.0, 1.2, 4.5, 16);
  const reactorCol = new THREE.Mesh(reactorColGeo, new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.7,
    metalness: 0.9,
  }));
  reactorCol.position.set(20, 0, -12);
  group.add(reactorCol);

  // Reactor core (glowing)
  const reactorCoreGeo = new THREE.SphereGeometry(0.7, 20, 20);
  const reactorCore = new THREE.Mesh(reactorCoreGeo, reactorMat);
  reactorCore.position.set(20, 2.2, -12);
  group.add(reactorCore);
  animatedMeshes.push({ mesh: reactorCore, type: 'reactor' });

  // Reactor energy rings
  for (let ring = 0; ring < 3; ring++) {
    const ringGeo = new THREE.TorusGeometry(1.0 + ring * 0.35, 0.06, 8, 32);
    const ringMesh = new THREE.Mesh(ringGeo, glowBlueMat);
    ringMesh.position.set(20, 1.2 + ring * 0.9, -12);
    ringMesh.rotation.x = (ring * Math.PI) / 5;
    group.add(ringMesh);
    animatedMeshes.push({ mesh: ringMesh, type: 'reactor' });
  }

  // Reactor glow light
  const reactorLight = new THREE.PointLight(0xff6600, 3.5, 22);
  reactorLight.position.set(20, 2.2, -12);
  group.add(reactorLight);
  lights.push({ light: reactorLight, baseIntensity: 3.5, phase: 0 });

  // Pipe network around reactor
  addPipe(20, 4.0, -12, 8.2, 4.0, -12, 0.1);
  addPipe(20, 4.0, -12, 31.8, 4.0, -12, 0.1);
  addPipe(20, 4.0, -12, 20, 0.1, -12, 0.1);
  addPipe(8.2, 0.5, -5, 8.2, 4.0, -12, 0.08);
  addPipe(31.8, 0.5, -5, 31.8, 4.0, -12, 0.08);

  // Glowing pipe joints
  const pipeJointGeo = new THREE.SphereGeometry(0.13, 8, 8);
  [[8.2, 4.0, -12], [31.8, 4.0, -12], [20, 4.0, -5], [20, 4.0, -20]].forEach(([jx, jy, jz]) => {
    const joint = new THREE.Mesh(pipeJointGeo, glowGreenMat);
    joint.position.set(jx, jy, jz);
    group.add(joint);
    animatedMeshes.push({ mesh: joint, type: 'reactor' });
  });

  // Engineering consoles
  addConsole(12, 0, -5.5, Math.PI * 0.5);
  addConsole(28, 0, -5.5, -Math.PI * 0.5);
  addConsole(12, 0, -20, Math.PI * 0.5);
  addConsole(28, 0, -20, -Math.PI * 0.5);

  // Equipment racks
  for (let ex = 10; ex <= 30; ex += 5) {
    const rackGeo = new THREE.BoxGeometry(1.0, 3.2, 0.45);
    const rack = new THREE.Mesh(rackGeo, panelMat);
    rack.position.set(ex, 1.6, -21.7);
    group.add(rack);
    // LEDs on rack
    for (let led = 0; led < 4; led++) {
      const ledGeo = new THREE.SphereGeometry(0.04, 4, 4);
      const ledMesh = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({
        color: led % 2 === 0 ? 0x00ff44 : 0x0055ff,
        emissive: new THREE.Color(led % 2 === 0 ? 0x00ff44 : 0x0055ff),
        emissiveIntensity: 2.5,
      }));
      ledMesh.position.set(ex - 0.3 + led * 0.2, 1.0 + led * 0.5, -21.5);
      group.add(ledMesh);
      animatedMeshes.push({ mesh: ledMesh, type: 'panel' });
    }
  }

  // Engineering bay extra lights
  const engLight1 = new THREE.PointLight(0xff4400, 1.2, 18);
  engLight1.position.set(13, 5.0, -12);
  group.add(engLight1);
  lights.push({ light: engLight1, baseIntensity: 1.2, phase: 0.7 });
  const engLight2 = new THREE.PointLight(0xff4400, 1.2, 18);
  engLight2.position.set(27, 5.0, -12);
  group.add(engLight2);
  lights.push({ light: engLight2, baseIntensity: 1.2, phase: 2.3 });

  // ──────────────────────────────────────────────────────────────────────────
  // Global ambient fill for the interior
  // ──────────────────────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0x102040, 0.8);
  group.add(ambientLight);

  return {
    group,
    rooms,
    spawnPosition: new THREE.Vector3(0, 1.8, 0), // inside airlock, standing height
    lights,
    animatedMeshes,
  };
}

// ─── Pumpkin (pickable world item) ───────────────────────────────────────────

/**
 * Builds a pumpkin mesh for placement in the world.
 * The group origin is at the bottom centre of the pumpkin so it sits flush
 * on the terrain.
 *
 * @param scale - uniform scale multiplier (default 1.0). Pass ~0.55 for the
 *   hand-held "held item" version shown in first-person view.
 */
export function buildPumpkinMesh(scale = 1.0): THREE.Group {
  const group = new THREE.Group();

  const orangeMat = new THREE.MeshLambertMaterial({ color: 0xe07820 });
  const darkOrangeMat = new THREE.MeshLambertMaterial({ color: 0xb85010 });
  const greenMat = new THREE.MeshLambertMaterial({ color: 0x3a8a20 });
  const darkGreenMat = new THREE.MeshLambertMaterial({ color: 0x246010 });

  // ── Main body (slightly flattened sphere) ──────────────────────────────────
  const bodyGeo = new THREE.SphereGeometry(0.42, 10, 8);
  // Flatten vertically to make it look more like a pumpkin
  const bodyMesh = new THREE.Mesh(bodyGeo, orangeMat);
  bodyMesh.scale.y = 0.78;
  bodyMesh.position.y = 0.33; // sit on ground
  group.add(bodyMesh);

  // ── Ribs (4 vertical elongated spheres overlaid for the segmented look) ────
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const ribGeo = new THREE.SphereGeometry(0.16, 6, 6);
    const rib = new THREE.Mesh(ribGeo, darkOrangeMat);
    rib.scale.set(1.0, 1.4, 1.0);
    rib.position.set(
      Math.cos(angle) * 0.28,
      0.33,
      Math.sin(angle) * 0.28
    );
    group.add(rib);
  }

  // ── Stem ──────────────────────────────────────────────────────────────────
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.07, 0.28, 6);
  const stem = new THREE.Mesh(stemGeo, darkGreenMat);
  stem.position.y = 0.72;
  stem.rotation.z = 0.18; // slight lean
  group.add(stem);

  // ── Leaf curl (small torus arc on the stem) ──────────────────────────────
  const leafGeo = new THREE.TorusGeometry(0.10, 0.025, 4, 8, Math.PI * 1.1);
  const leaf = new THREE.Mesh(leafGeo, greenMat);
  leaf.position.set(0.08, 0.80, 0.0);
  leaf.rotation.set(Math.PI / 2, 0, 0.5);
  group.add(leaf);

  group.scale.setScalar(scale);
  return group;
}

// ─── Spider ───────────────────────────────────────────────────────────────────

/**
 * Builds a spider mesh with 8 legs and glowing red eyes.
 * The returned group is centered at ground level (y = 0 at the belly).
 * Scale the group externally to get small / medium / large variants.
 */
export function buildSpiderMesh(): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a0a0a }); // near-black dark brown
  const legMat  = new THREE.MeshLambertMaterial({ color: 0x2a0f0f }); // slightly lighter
  const eyeMat  = new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.6 });

  // ── Abdomen (rear body) ─────────────────────────────────────────────────────
  const abdomenGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const abdomen = new THREE.Mesh(abdomenGeo, bodyMat);
  abdomen.scale.set(1, 0.85, 1.2);
  abdomen.position.set(-0.55, 0.42, 0);
  abdomen.castShadow = true;
  group.add(abdomen);

  // ── Cephalothorax (front body / head) ──────────────────────────────────────
  const cephGeo = new THREE.SphereGeometry(0.40, 10, 8);
  const ceph = new THREE.Mesh(cephGeo, bodyMat);
  ceph.scale.set(1, 0.8, 0.9);
  ceph.position.set(0.15, 0.38, 0);
  ceph.castShadow = true;
  group.add(ceph);

  // ── Eyes (8 small glowing red spheres arranged on front) ───────────────────
  const eyeGeo = new THREE.SphereGeometry(0.055, 5, 4);
  const eyePositions = [
    [0.52,  0.58,  0.14],
    [0.52,  0.58, -0.14],
    [0.50,  0.62,  0.07],
    [0.50,  0.62, -0.07],
    [0.48,  0.56,  0.22],
    [0.48,  0.56, -0.22],
    [0.46,  0.50,  0.18],
    [0.46,  0.50, -0.18],
  ];
  eyePositions.forEach(([x, y, z]) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(x, y, z);
    group.add(eye);
  });

  // ── Legs (8 legs, 4 on each side) ──────────────────────────────────────────
  const legSegGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.7, 5);
  const legTipGeo = new THREE.CylinderGeometry(0.03, 0.01, 0.55, 5);

  const legSideZ = [0.30, 0.12, -0.12, -0.30]; // 4 attachment points per side

  for (let side = 0; side < 2; side++) {
    const sideSign = side === 0 ? 1 : -1;
    legSideZ.forEach((zOffset, i) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(-0.05 + i * 0.12, 0.38, sideSign * Math.abs(zOffset));

      // Upper leg segment
      const upper = new THREE.Mesh(legSegGeo, legMat);
      upper.rotation.z = sideSign * (0.7 + i * 0.12); // angle outward
      upper.rotation.x = (i - 1.5) * 0.18;
      upper.position.set(sideSign * 0.3, -0.1, 0);
      upper.castShadow = true;
      legGroup.add(upper);

      // Lower leg segment (angled down to ground)
      const lower = new THREE.Mesh(legTipGeo, legMat);
      lower.rotation.z = sideSign * (-0.5);
      lower.rotation.x = (i - 1.5) * 0.15;
      lower.position.set(sideSign * 0.65, -0.42, 0);
      lower.castShadow = true;
      legGroup.add(lower);

      group.add(legGroup);
    });
  }

  // ── Chelicerae (fangs) ──────────────────────────────────────────────────────
  const fangGeo = new THREE.CylinderGeometry(0.025, 0.01, 0.22, 4);
  const fangMat = new THREE.MeshLambertMaterial({ color: 0x4a1010 });
  [-0.08, 0.08].forEach((zOff) => {
    const fang = new THREE.Mesh(fangGeo, fangMat);
    fang.position.set(0.52, 0.28, zOff);
    fang.rotation.z = 0.5;
    group.add(fang);
  });

  return group;
}

// ─── Cave ─────────────────────────────────────────────────────────────────────

/**
 * Builds a cave entrance + interior chamber.
 * The group origin is at the center of the cave entrance at ground level (y = 0).
 * Interior depth runs along -Z axis (into the cave).
 */
export function buildCaveMesh(): THREE.Group {
  const group = new THREE.Group();

  const stoneMat  = new THREE.MeshLambertMaterial({ color: 0x5a5055 });  // dark grey-purple stone
  const darkMat   = new THREE.MeshLambertMaterial({ color: 0x2a2530 });  // deep shadow interior
  const floorMat  = new THREE.MeshLambertMaterial({ color: 0x484048 });  // cave floor

  // ── Entrance arch (several large stone blocks forming a jagged opening) ─────
  const archPositions: Array<[number, number, number, number, number, number]> = [
    // [x, y, z, sx, sy, sz]  — box extents for each stone block of the arch
    [-4.5, 2.5,  0,   1.2, 3.5, 2.0], // left pillar
    [ 4.5, 2.5,  0,   1.2, 3.5, 2.0], // right pillar
    [ 0,   6.2,  0,  10.0, 1.8, 2.2], // top lintel
    [-3.0, 5.0,  0,   2.8, 1.2, 1.8], // top-left fill
    [ 3.0, 5.0,  0,   2.8, 1.2, 1.8], // top-right fill
    [-5.2, 0.8,  0,   1.0, 2.2, 1.8], // base left bump
    [ 5.2, 0.8,  0,   1.0, 2.2, 1.8], // base right bump
  ];

  archPositions.forEach(([x, y, z, sx, sy, sz]) => {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, stoneMat);
    mesh.position.set(x, y, z);
    // Add slight random rotation for jagged natural look
    mesh.rotation.z = (Math.random() - 0.5) * 0.12;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  // ── Interior walls (left, right, ceiling) ──────────────────────────────────
  const interiorDepth = 22;
  const interiorWidth = 9;
  const interiorHeight = 5.5;

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, interiorHeight + 2, interiorDepth),
    stoneMat
  );
  leftWall.position.set(-interiorWidth / 2 - 0.75, interiorHeight / 2, -interiorDepth / 2);
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, interiorHeight + 2, interiorDepth),
    stoneMat
  );
  rightWall.position.set(interiorWidth / 2 + 0.75, interiorHeight / 2, -interiorDepth / 2);
  rightWall.receiveShadow = true;
  group.add(rightWall);

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(interiorWidth + 3, 1.8, interiorDepth),
    darkMat
  );
  ceiling.position.set(0, interiorHeight + 0.9, -interiorDepth / 2);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Back wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(interiorWidth + 3, interiorHeight + 3, 2.0),
    stoneMat
  );
  backWall.position.set(0, interiorHeight / 2, -interiorDepth - 1);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(interiorWidth + 3, 0.5, interiorDepth + 2),
    floorMat
  );
  floor.position.set(0, -0.25, -interiorDepth / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // ── Stalactites hanging from ceiling ──────────────────────────────────────
  const stalMat = new THREE.MeshLambertMaterial({ color: 0x504a55 });
  const stalPositions: Array<[number, number]> = [
    [-2.5, -5], [-1.0, -8], [1.5, -6], [3.0, -10],
    [-3.5, -13], [0.5, -15], [2.5, -18], [-1.8, -20],
  ];
  stalPositions.forEach(([sx, sz]) => {
    const height = 0.6 + Math.random() * 1.2;
    const stalGeo = new THREE.ConeGeometry(0.18, height, 6);
    const stal = new THREE.Mesh(stalGeo, stalMat);
    stal.position.set(sx, interiorHeight - 0.05, sz);
    stal.rotation.z = Math.PI; // point downward
    stal.castShadow = true;
    group.add(stal);
  });

  // ── Stalagmites on floor ──────────────────────────────────────────────────
  const stagPositions: Array<[number, number]> = [
    [-4.0, -4], [3.8, -7], [-3.5, -16], [4.2, -19],
  ];
  stagPositions.forEach(([sx, sz]) => {
    const height = 0.4 + Math.random() * 0.8;
    const stagGeo = new THREE.ConeGeometry(0.14, height, 6);
    const stag = new THREE.Mesh(stagGeo, stalMat);
    stag.position.set(sx, height / 2, sz);
    stag.castShadow = true;
    group.add(stag);
  });

  return group;
}

// ─── Cave Torch ───────────────────────────────────────────────────────────────

/**
 * Builds a wall-mounted torch mesh.
 * Returns the group (attach a PointLight separately).
 * Origin is at the torch base (wall mount point).
 */
export function buildTorchMesh(): THREE.Group {
  const group = new THREE.Group();

  const stickMat  = new THREE.MeshLambertMaterial({ color: 0x5c3a1e }); // dark wood
  const bandMat   = new THREE.MeshLambertMaterial({ color: 0x8b6914 }); // iron band
  const flameMat  = new THREE.MeshLambertMaterial({
    color: 0xff8800,
    emissive: new THREE.Color(0xff6600),
    emissiveIntensity: 0.9,
  });
  const glowMat   = new THREE.MeshLambertMaterial({
    color: 0xffcc44,
    emissive: new THREE.Color(0xffaa00),
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.7,
  });

  // Stick
  const stickGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.7, 7);
  const stick = new THREE.Mesh(stickGeo, stickMat);
  stick.position.y = 0.35;
  stick.castShadow = true;
  group.add(stick);

  // Iron band (bracket)
  const bandGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.08, 8);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = 0.15;
  group.add(band);

  // Flame (orange teardrop-like scaled sphere)
  const flameGeo = new THREE.SphereGeometry(0.13, 7, 6);
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.scale.set(1, 1.6, 1);
  flame.position.y = 0.78;
  flame.name = "flame"; // for animation reference
  group.add(flame);

  // Inner brighter core
  const coreGeo = new THREE.SphereGeometry(0.07, 5, 4);
  const core = new THREE.Mesh(coreGeo, glowMat);
  core.scale.set(1, 1.4, 1);
  core.position.y = 0.80;
  group.add(core);

  return group;
}

// ─── Treasure Chest ───────────────────────────────────────────────────────────

/**
 * Builds a treasure chest mesh.
 * Returns `{ group, lidGroup }` — rotate `lidGroup.rotation.x` to open the lid.
 * The chest origin is at the base (y = 0 = ground level).
 */
export function buildTreasureChestMesh(): { group: THREE.Group; lidGroup: THREE.Group } {
  const group = new THREE.Group();

  const woodMat  = new THREE.MeshLambertMaterial({ color: 0x5c3317 }); // dark oak
  const ironMat  = new THREE.MeshLambertMaterial({ color: 0x4a4a4a }); // iron fittings
  const goldMat  = new THREE.MeshLambertMaterial({ color: 0xd4a017, emissive: new THREE.Color(0x8b6914), emissiveIntensity: 0.3 });
  const gemMat   = new THREE.MeshLambertMaterial({ color: 0x00ccff, emissive: new THREE.Color(0x0088ff), emissiveIntensity: 0.5 });
  const interiorMat = new THREE.MeshLambertMaterial({ color: 0x2a1a08 }); // dark interior

  // ── Base ───────────────────────────────────────────────────────────────────
  const baseGeo = new THREE.BoxGeometry(1.4, 0.8, 0.9);
  const base = new THREE.Mesh(baseGeo, woodMat);
  base.position.y = 0.4;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Interior visible when open (dark box inside)
  const interiorGeo = new THREE.BoxGeometry(1.2, 0.6, 0.7);
  const interior = new THREE.Mesh(interiorGeo, interiorMat);
  interior.position.y = 0.4;
  group.add(interior);

  // ── Iron corner reinforcements ─────────────────────────────────────────────
  const cornerPositions: Array<[number, number, number]> = [
    [ 0.65, 0.4,  0.43],
    [-0.65, 0.4,  0.43],
    [ 0.65, 0.4, -0.43],
    [-0.65, 0.4, -0.43],
  ];
  cornerPositions.forEach(([x, y, z]) => {
    const cornerGeo = new THREE.BoxGeometry(0.12, 0.72, 0.12);
    const corner = new THREE.Mesh(cornerGeo, ironMat);
    corner.position.set(x, y, z);
    group.add(corner);
  });

  // Horizontal iron bands
  [0.2, 0.62].forEach((yBand) => {
    const bandGeo = new THREE.BoxGeometry(1.52, 0.06, 0.06);
    const bandFront = new THREE.Mesh(bandGeo, ironMat);
    bandFront.position.set(0, yBand, 0.46);
    group.add(bandFront);
    const bandBack = new THREE.Mesh(bandGeo, ironMat);
    bandBack.position.set(0, yBand, -0.46);
    group.add(bandBack);
  });

  // ── Lid group (pivot at hinge — back top of base) ─────────────────────────
  const lidGroup = new THREE.Group();
  // Pivot point is at back edge of the chest, top of the base
  lidGroup.position.set(0, 0.82, -0.43);

  const lidGeo = new THREE.BoxGeometry(1.4, 0.38, 0.9);
  const lid = new THREE.Mesh(lidGeo, woodMat);
  lid.position.set(0, 0.19, 0.02);
  lid.castShadow = true;
  lidGroup.add(lid);

  // Lid iron band
  const lidBandGeo = new THREE.BoxGeometry(1.52, 0.06, 0.06);
  const lidBandFront = new THREE.Mesh(lidBandGeo, ironMat);
  lidBandFront.position.set(0, 0.19, 0.47);
  lidGroup.add(lidBandFront);

  // Lid arch (rounded top strip)
  const lidArchGeo = new THREE.CylinderGeometry(0.20, 0.20, 1.42, 8, 1, false, 0, Math.PI);
  const lidArch = new THREE.Mesh(lidArchGeo, woodMat);
  lidArch.rotation.z = Math.PI / 2;
  lidArch.position.set(0, 0.20, 0.02);
  lidArch.castShadow = true;
  lidGroup.add(lidArch);

  group.add(lidGroup);

  // ── Lock clasp ─────────────────────────────────────────────────────────────
  const lockGeo = new THREE.BoxGeometry(0.18, 0.18, 0.08);
  const lock = new THREE.Mesh(lockGeo, goldMat);
  lock.position.set(0, 0.55, 0.48);
  group.add(lock);

  // ── Gold coins / gems visible inside when opened ──────────────────────────
  // (positioned inside chest — revealed when lid opens)
  const coinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8);
  const coinPositions: Array<[number, number, number]> = [
    [0.2, 0.05, 0.1], [-0.2, 0.05, 0.0], [0.0, 0.05, 0.08],
    [0.35, 0.05, -0.05], [-0.35, 0.05, 0.12],
  ];
  coinPositions.forEach(([x, y, z]) => {
    const coin = new THREE.Mesh(coinGeo, goldMat);
    coin.position.set(x, y, z);
    coin.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4;
    group.add(coin);
  });

  // Gem
  const gemGeo = new THREE.OctahedronGeometry(0.10, 0);
  const gem = new THREE.Mesh(gemGeo, gemMat);
  gem.position.set(-0.1, 0.18, 0.05);
  gem.rotation.y = 0.8;
  group.add(gem);

  return { group, lidGroup };
}

// ─── Airplane (3D flyable) ────────────────────────────────────────────────────
/**
 * Builds a detailed 3D propeller airplane that can be boarded and flown by the player.
 * The airplane faces +Z by default (nose toward +Z).  The caller rotates the root group
 * to match the current yaw/pitch/roll of the flight state.
 *
 * Returns:
 *  - `group`      – root THREE.Group (position this in world space)
 *  - `propeller`  – propeller disk mesh (rotate around Z each frame while flying)
 *  - `bodyGroup`  – fuselage group (useful for future animation)
 */
export function buildAirplane3DMesh(): { group: THREE.Group; propeller: THREE.Mesh; bodyGroup: THREE.Group } {
  const group = new THREE.Group();

  // ── Materials ──────────────────────────────────────────────────────────────
  const bodyMat    = new THREE.MeshLambertMaterial({ color: 0xd0e8ff }); // pale sky-blue
  const accentMat  = new THREE.MeshLambertMaterial({ color: 0x4488cc }); // darker blue stripe
  const windowMat  = new THREE.MeshLambertMaterial({ color: 0x99ddff, transparent: true, opacity: 0.7 });
  const propMat    = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const noseMat    = new THREE.MeshLambertMaterial({ color: 0xffdd44 }); // yellow nose tip
  const wheelMat   = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const strutMat   = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const exhaustMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

  // ── Body group (so it can be animated independently) ──────────────────────
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // Fuselage — elongated box, nose toward +Z
  const fuselageGeo = new THREE.CylinderGeometry(0.55, 0.40, 5.0, 10, 1);
  fuselageGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
  fuselage.castShadow = true;
  bodyGroup.add(fuselage);

  // Nose cone (tapered toward front)
  const noseGeo = new THREE.CylinderGeometry(0.08, 0.40, 1.0, 10);
  noseGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0, 2.9);
  nose.castShadow = true;
  bodyGroup.add(nose);

  // Tail section (slightly tapered)
  const tailFuselageGeo = new THREE.CylinderGeometry(0.20, 0.40, 1.8, 8, 1);
  tailFuselageGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const tailFuselage = new THREE.Mesh(tailFuselageGeo, accentMat);
  tailFuselage.position.set(0, 0, -2.9);
  tailFuselage.castShadow = true;
  bodyGroup.add(tailFuselage);

  // Blue accent stripe along fuselage
  const stripeGeo = new THREE.BoxGeometry(0.06, 0.22, 4.8);
  const stripeL = new THREE.Mesh(stripeGeo, accentMat);
  stripeL.position.set(0.52, 0.0, 0);
  bodyGroup.add(stripeL);
  const stripeR = stripeL.clone();
  stripeR.position.set(-0.52, 0.0, 0);
  bodyGroup.add(stripeR);

  // ── Main wings ─────────────────────────────────────────────────────────────
  // Wing root: slightly swept, tapered from root to tip
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.4);     // trailing root
  wingShape.lineTo(0, 0.6);      // leading root
  wingShape.lineTo(3.8, 0.2);    // leading tip
  wingShape.lineTo(3.8, -0.5);   // trailing tip
  wingShape.closePath();

  const wingExtrudeSettings = { depth: 0.10, bevelEnabled: false };
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  wingGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

  const wingR = new THREE.Mesh(wingGeo, bodyMat);
  wingR.position.set(0.05, -0.05, 0.3);
  wingR.castShadow = true;
  bodyGroup.add(wingR);

  // Left wing (mirror)
  const wingLGeo = wingGeo.clone();
  wingLGeo.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const wingL = new THREE.Mesh(wingLGeo, bodyMat);
  wingL.position.set(-0.05, -0.05, 0.3);
  wingL.castShadow = true;
  bodyGroup.add(wingL);

  // Wing accent stripe
  const wingStripeGeo = new THREE.BoxGeometry(3.6, 0.02, 0.18);
  const wingStripeR = new THREE.Mesh(wingStripeGeo, accentMat);
  wingStripeR.position.set(2.0, -0.01, 0.15);
  bodyGroup.add(wingStripeR);
  const wingStripeL = wingStripeR.clone();
  wingStripeL.position.set(-2.0, -0.01, 0.15);
  bodyGroup.add(wingStripeL);

  // ── Horizontal stabilisers (tail) ─────────────────────────────────────────
  const hStabShape = new THREE.Shape();
  hStabShape.moveTo(0, -0.25);
  hStabShape.lineTo(0, 0.35);
  hStabShape.lineTo(1.6, 0.10);
  hStabShape.lineTo(1.6, -0.30);
  hStabShape.closePath();
  const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.07, bevelEnabled: false });
  hStabGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

  const hStabR = new THREE.Mesh(hStabGeo, accentMat);
  hStabR.position.set(0.05, 0.05, -2.8);
  hStabR.castShadow = true;
  bodyGroup.add(hStabR);

  const hStabLGeo = hStabGeo.clone();
  hStabLGeo.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const hStabL = new THREE.Mesh(hStabLGeo, accentMat);
  hStabL.position.set(-0.05, 0.05, -2.8);
  hStabL.castShadow = true;
  bodyGroup.add(hStabL);

  // ── Vertical stabiliser (tail fin) ────────────────────────────────────────
  const vStabShape = new THREE.Shape();
  vStabShape.moveTo(0, 0);
  vStabShape.lineTo(0, 1.6);
  vStabShape.lineTo(-0.9, 1.4);
  vStabShape.lineTo(-1.4, 0);
  vStabShape.closePath();
  const vStabGeo = new THREE.ExtrudeGeometry(vStabShape, { depth: 0.08, bevelEnabled: false });
  vStabGeo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const vStab = new THREE.Mesh(vStabGeo, accentMat);
  vStab.position.set(0.04, 0.20, -2.4);
  vStab.castShadow = true;
  bodyGroup.add(vStab);

  // ── Cockpit canopy ─────────────────────────────────────────────────────────
  const canopyGeo = new THREE.SphereGeometry(0.40, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const canopy = new THREE.Mesh(canopyGeo, windowMat);
  canopy.position.set(0, 0.48, 0.8);
  canopy.scale.set(1.0, 0.7, 1.4);
  bodyGroup.add(canopy);

  // ── Engine / Propeller hub ─────────────────────────────────────────────────
  const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10);
  hubGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const hub = new THREE.Mesh(hubGeo, exhaustMat);
  hub.position.set(0, 0, 3.45);
  bodyGroup.add(hub);

  // Exhaust pipe
  const exhaustGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.45, 8);
  exhaustGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const exhaustL = new THREE.Mesh(exhaustGeo, exhaustMat);
  exhaustL.position.set(-0.45, -0.28, 1.9);
  bodyGroup.add(exhaustL);
  const exhaustR = exhaustL.clone();
  exhaustR.position.set(0.45, -0.28, 1.9);
  bodyGroup.add(exhaustR);

  // ── Propeller (2 blades) — rotates in animation loop ──────────────────────
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0, 3.57);
  bodyGroup.add(propGroup);

  const bladeSingleGeo = new THREE.BoxGeometry(2.2, 0.06, 0.22);
  const propeller = new THREE.Mesh(bladeSingleGeo, propMat) as THREE.Mesh;
  propeller.castShadow = true;
  propGroup.add(propeller);

  // Second blade perpendicular to first
  const blade2 = new THREE.Mesh(bladeSingleGeo.clone(), propMat);
  blade2.rotation.z = Math.PI / 2;
  propGroup.add(blade2);

  // Attach propGroup to bodyGroup so its rotation reference is preserved;
  // the animation loop will rotate propGroup.rotation.z each frame.
  // We export the propGroup itself as the "propeller" to rotate.
  const propGroupAsRef = propGroup as unknown as THREE.Mesh;

  // ── Landing gear ──────────────────────────────────────────────────────────
  // Main struts (under wings)
  const strutGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6);
  const strutL = new THREE.Mesh(strutGeo, strutMat);
  strutL.position.set(-1.1, -0.75, 0.4);
  strutL.rotation.z = 0.12;
  bodyGroup.add(strutL);
  const strutR = strutL.clone();
  strutR.position.set(1.1, -0.75, 0.4);
  strutR.rotation.z = -0.12;
  bodyGroup.add(strutR);

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.12, 10);
  wheelGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const wheelL = new THREE.Mesh(wheelGeo, wheelMat);
  wheelL.position.set(-1.2, -1.12, 0.4);
  bodyGroup.add(wheelL);
  const wheelR = wheelL.clone();
  wheelR.position.set(1.2, -1.12, 0.4);
  bodyGroup.add(wheelR);

  // Tail wheel (smaller)
  const tailWheelGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.10, 8);
  tailWheelGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  const tailWheel = new THREE.Mesh(tailWheelGeo, wheelMat);
  tailWheel.position.set(0, -0.52, -3.1);
  bodyGroup.add(tailWheel);

  const tailStrutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.38, 6);
  const tailStrut = new THREE.Mesh(tailStrutGeo, strutMat);
  tailStrut.position.set(0, -0.33, -3.1);
  bodyGroup.add(tailStrut);

  // Return propGroup (as Mesh cast) so the caller can rotate it each frame
  return { group, propeller: propGroupAsRef, bodyGroup };
}

/**
 * Builds a simple flat airstrip runway mesh to mark the airplane spawn position.
 * The runway faces +Z and is 4 units wide × 30 units long.
 */
export function buildAirstripMesh(): THREE.Group {
  const group = new THREE.Group();

  const runwayMat    = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const markingMat   = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const poleMatGray  = new THREE.MeshLambertMaterial({ color: 0x888888 });
  const beaconMatYel = new THREE.MeshLambertMaterial({ color: 0xffdd00, emissive: new THREE.Color(0xffaa00), emissiveIntensity: 0.8 });
  const windsockMat  = new THREE.MeshLambertMaterial({ color: 0xff4400, emissive: new THREE.Color(0xff2200), emissiveIntensity: 0.3 });
  const windsockWhiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  // Asphalt surface
  const runwayGeo = new THREE.BoxGeometry(6, 0.08, 32);
  const runway = new THREE.Mesh(runwayGeo, runwayMat);
  runway.receiveShadow = true;
  group.add(runway);

  // Centre-line dashes
  for (let i = -5; i <= 5; i++) {
    const dashGeo = new THREE.BoxGeometry(0.25, 0.09, 1.6);
    const dash = new THREE.Mesh(dashGeo, markingMat);
    dash.position.set(0, 0, i * 2.8);
    group.add(dash);
  }

  // Threshold bars (each end)
  const threshGeo = new THREE.BoxGeometry(5.6, 0.09, 0.35);
  const threshFront = new THREE.Mesh(threshGeo, markingMat);
  threshFront.position.set(0, 0, 14.5);
  group.add(threshFront);
  const threshBack = threshFront.clone();
  threshBack.position.set(0, 0, -14.5);
  group.add(threshBack);

  // ── Tall beacon poles at both ends (visible from a distance) ──────────────
  const addBeaconPole = (x: number, z: number) => {
    const poleGeo = new THREE.CylinderGeometry(0.10, 0.12, 8, 8);
    const pole = new THREE.Mesh(poleGeo, poleMatGray);
    pole.position.set(x, 4, z);
    pole.castShadow = true;
    group.add(pole);

    // Bright yellow beacon sphere on top
    const beaconGeo = new THREE.SphereGeometry(0.32, 8, 8);
    const beacon = new THREE.Mesh(beaconGeo, beaconMatYel);
    beacon.position.set(x, 8.4, z);
    group.add(beacon);
  };

  // Four corner beacons
  addBeaconPole( 4,  16);
  addBeaconPole(-4,  16);
  addBeaconPole( 4, -16);
  addBeaconPole(-4, -16);

  // ── Windsock ──────────────────────────────────────────────────────────────
  // Horizontal mast on a short pole
  const windsockPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 4, 7);
  const windsockPole = new THREE.Mesh(windsockPoleGeo, poleMatGray);
  windsockPole.position.set(5, 2, 0);
  group.add(windsockPole);

  const mastGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6);
  mastGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const mast = new THREE.Mesh(mastGeo, poleMatGray);
  mast.position.set(5.9, 4.1, 0);
  group.add(mast);

  // Windsock cone — alternating orange and white rings
  const sockSegments = 5;
  for (let s = 0; s < sockSegments; s++) {
    const t = s / sockSegments;
    const r0 = 0.38 - t * 0.22;
    const r1 = 0.38 - (s + 1) / sockSegments * 0.22;
    const segLen = 0.45;
    const segGeo = new THREE.CylinderGeometry(r1, r0, segLen, 8, 1, true);
    segGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    const segMat = s % 2 === 0 ? windsockMat : windsockWhiteMat;
    const seg = new THREE.Mesh(segGeo, segMat);
    seg.position.set(7.05 + s * segLen, 4.1, 0);
    group.add(seg);
  }

  return group;
}

/**
 * Builds a small directional signpost that points toward the airstrip.
 * Place this near the player spawn (0,0) to guide players.
 */
export function buildAirstripSignMesh(): THREE.Group {
  const group = new THREE.Group();

  const poleMat  = new THREE.MeshLambertMaterial({ color: 0x8b6914 });
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x2a5f1a });
  const textMat  = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const arrowMat = new THREE.MeshLambertMaterial({ color: 0xffdd00, emissive: new THREE.Color(0xffaa00), emissiveIntensity: 0.5 });

  // Wooden post
  const poleGeo = new THREE.BoxGeometry(0.16, 3.5, 0.16);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(0, 1.75, 0);
  pole.castShadow = true;
  group.add(pole);

  // Sign board
  const boardGeo = new THREE.BoxGeometry(2.4, 0.6, 0.12);
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(1.0, 3.3, 0);
  board.castShadow = true;
  group.add(board);

  // Arrow pointer (pointing in +X direction toward airstrip)
  const arrowBodyGeo = new THREE.BoxGeometry(0.8, 0.14, 0.14);
  const arrowBody = new THREE.Mesh(arrowBodyGeo, arrowMat);
  arrowBody.position.set(1.4, 3.3, 0.09);
  group.add(arrowBody);

  const arrowHeadGeo = new THREE.ConeGeometry(0.14, 0.3, 6);
  arrowHeadGeo.applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));
  const arrowHead = new THREE.Mesh(arrowHeadGeo, arrowMat);
  arrowHead.position.set(1.95, 3.3, 0.09);
  group.add(arrowHead);

  // White stripe accent on board top
  const stripeGeo = new THREE.BoxGeometry(2.4, 0.06, 0.13);
  const stripe = new THREE.Mesh(stripeGeo, textMat);
  stripe.position.set(1.0, 3.57, 0);
  group.add(stripe);

  return group;
}

// ─── Big City ─────────────────────────────────────────────────────────────────

export interface CityResult {
  group: THREE.Group;
  /** Local-space box colliders (relative to city group origin). */
  boxColliders: RuinsBoxCollider[];
  /** Local-space cylinder colliders (relative to city group origin). */
  cylColliders: RuinsCylCollider[];
}

/** Options for terrain-adaptive city placement. */
export interface CityTerrainOptions {
  /**
   * Function that returns the world-space terrain height at (worldX, worldZ).
   * When provided every city element is raised/lowered to sit on the terrain.
   */
  terrainSampler: (worldX: number, worldZ: number) => number;
  /** World-space X of the city group origin (used to convert local→world coords). */
  worldX: number;
  /** World-space Z of the city group origin. */
  worldZ: number;
}

/**
 * Builds a large procedural city: skyscrapers, office buildings, apartments,
 * roads, street lights, and a central plaza.
 *
 * Local layout (centred at 0,0):
 *   3×3 super-blocks of ~18 × 18 units each, separated by 9-unit roads.
 *   Total footprint ≈ 81 × 81 units.
 *
 * Returns a THREE.Group plus local-space collider arrays for Game3D.tsx.
 */
export function buildCity(rng: () => number, terrain?: CityTerrainOptions): CityResult {
  const group = new THREE.Group();
  const boxColliders: RuinsBoxCollider[] = [];
  const cylColliders: RuinsCylCollider[] = [];

  // ── Terrain-adaptive helpers ───────────────────────────────────────────────
  // cityBaseH: world-space terrain height at the city group origin.
  // The city group is positioned at (worldX, cityBaseH, worldZ) in Game3D,
  // so local Y=0 corresponds to the terrain at the city centre.
  const cityBaseH = terrain
    ? terrain.terrainSampler(terrain.worldX, terrain.worldZ)
    : 0;

  /**
   * Returns the local-space terrain height at city-local offset (lx, lz).
   * Use this to lift/lower individual elements so they sit on the actual ground.
   * Returns 0 when no terrain sampler was provided (flat behaviour).
   */
  function localTH(lx: number, lz: number): number {
    if (!terrain) return 0;
    return terrain.terrainSampler(terrain.worldX + lx, terrain.worldZ + lz) - cityBaseH;
  }

  /**
   * Samples terrain at multiple points along a line (lx0→lx1, lz0→lz1) and
   * returns the average local terrain height.  Used to position road segments.
   */
  function avgTH(lx0: number, lz0: number, lx1: number, lz1: number, steps = 3): number {
    let sum = 0;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      sum += localTH(lx0 + (lx1 - lx0) * t, lz0 + (lz1 - lz0) * t);
    }
    return sum / (steps + 1);
  }

  // ── Shared materials ──────────────────────────────────────────────────────
  const glassMat      = new THREE.MeshLambertMaterial({ color: 0x7ab4d4, transparent: true, opacity: 0.82 });
  const glassNightMat = new THREE.MeshLambertMaterial({ color: 0xffd97a, transparent: true, opacity: 0.55 });
  const concreteMat   = new THREE.MeshLambertMaterial({ color: 0x8c8c8c });
  const darkConcrete  = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
  const brickMat      = new THREE.MeshLambertMaterial({ color: 0xb05c3c });
  const creamMat      = new THREE.MeshLambertMaterial({ color: 0xe0d5b0 });
  const roadMat       = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const sidewalkMat   = new THREE.MeshLambertMaterial({ color: 0xb0a898 });
  const plazaMat      = new THREE.MeshLambertMaterial({ color: 0x8ab875 });
  const lineMat       = new THREE.MeshLambertMaterial({ color: 0xeeee00 });
  const poleMatC      = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const lampMat       = new THREE.MeshLambertMaterial({ color: 0xfff8c0, emissive: 0xfff8c0, emissiveIntensity: 0.9 });
  const roofTrimMat   = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const foundationMat = new THREE.MeshLambertMaterial({ color: 0x6e6e6e });

  // ── Helper: add a box mesh + optional collider ────────────────────────────
  function addBox(
    w: number, h: number, d: number,
    mat: THREE.Material,
    lx: number, ly: number, lz: number,
    rotY = 0,
    shadow = true,
    withCollider = false,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(lx, ly, lz);
    mesh.rotation.y = rotY;
    if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    group.add(mesh);
    if (withCollider) {
      const hw = w / 2 + 0.05;
      const hd = d / 2 + 0.05;
      // Rotate the collider centre offset
      const cx = lx * Math.cos(rotY) - lz * Math.sin(rotY);
      const cz = lx * Math.sin(rotY) + lz * Math.cos(rotY);
      // Include 3D height info so players can land on top of buildings
      boxColliders.push({ lx: cx, lz: cz, halfW: hw, halfD: hd, rotY, ly, halfH: h / 2, walkable: true });
    }
    return mesh;
  }

  // ── 1. Ground (roads + sidewalks) ────────────────────────────────────────
  // Sidewalk: subdivided into a 6×6 grid so each tile follows the terrain.
  {
    const COLS = 6;
    const ROWS = 6;
    const totalW = 82;
    const totalD = 82;
    const tileW = totalW / COLS;
    const tileD = totalD / ROWS;
    for (let ci = 0; ci < COLS; ci++) {
      for (let ri = 0; ri < ROWS; ri++) {
        const cx = -totalW / 2 + (ci + 0.5) * tileW;
        const cz = -totalD / 2 + (ri + 0.5) * tileD;
        const th = localTH(cx, cz);
        addBox(tileW + 0.05, 0.12, tileD + 0.05, sidewalkMat, cx, th + 0.01, cz, 0, false);
      }
    }
  }

  // Road H-strips: 8 segments each so they follow terrain along their length.
  {
    const SEGS = 8;
    const segLen = 82 / SEGS;
    const roadZ = [-13.5, 13.5];
    for (const rz of roadZ) {
      for (let si = 0; si < SEGS; si++) {
        const segCX = -41 + (si + 0.5) * segLen;
        const th = avgTH(segCX - segLen / 2, rz, segCX + segLen / 2, rz);
        addBox(segLen + 0.05, 0.14, 9, roadMat, segCX, th + 0.02, rz, 0, false);
      }
    }
  }
  // Road V-strips: 8 segments each.
  {
    const SEGS = 8;
    const segLen = 82 / SEGS;
    const roadX = [-13.5, 13.5];
    for (const rx of roadX) {
      for (let si = 0; si < SEGS; si++) {
        const segCZ = -41 + (si + 0.5) * segLen;
        const th = avgTH(rx, segCZ - segLen / 2, rx, segCZ + segLen / 2);
        addBox(9, 0.14, segLen + 0.05, roadMat, rx, th + 0.02, segCZ, 0, false);
      }
    }
  }
  // Centre crossroad box
  {
    const th = localTH(0, 0);
    addBox(9, 0.16, 9, roadMat, 0, th + 0.03, 0, 0, false);
  }

  // Yellow centre dashes – H roads
  for (let x = -38; x <= 38; x += 5) {
    addBox(2.5, 0.18, 0.18, lineMat, x, localTH(x, -13.5) + 0.04, -13.5, 0, false);
    addBox(2.5, 0.18, 0.18, lineMat, x, localTH(x,  13.5) + 0.04,  13.5, 0, false);
  }
  // Yellow centre dashes – V roads
  for (let z = -38; z <= 38; z += 5) {
    addBox(0.18, 0.18, 2.5, lineMat, -13.5, localTH(-13.5, z) + 0.04, z, 0, false);
    addBox(0.18, 0.18, 2.5, lineMat,  13.5, localTH( 13.5, z) + 0.04, z, 0, false);
  }

  // ── 2. Central plaza (block 0,0) ──────────────────────────────────────────
  const plazaTH = localTH(0, 0);
  addBox(18, 0.15, 18, plazaMat, 0, plazaTH + 0.02, 0, 0, false);
  // Fountain base disc
  const fountainBaseGeo = new THREE.CylinderGeometry(3.2, 3.5, 0.5, 16);
  const fountainBase = new THREE.Mesh(fountainBaseGeo, concreteMat);
  fountainBase.position.set(0, plazaTH + 0.35, 0);
  fountainBase.castShadow = true;
  fountainBase.receiveShadow = true;
  group.add(fountainBase);
  // Fountain pool rim
  const rimGeo = new THREE.TorusGeometry(3.2, 0.22, 8, 24);
  const rim = new THREE.Mesh(rimGeo, concreteMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(0, plazaTH + 0.55, 0);
  group.add(rim);
  // Central column
  const colGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.5, 10);
  const col = new THREE.Mesh(colGeo, creamMat);
  col.position.set(0, plazaTH + 1.55, 0);
  col.castShadow = true;
  group.add(col);
  // Water disc (top of column)
  const waterGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 12);
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x66bbee, transparent: true, opacity: 0.7 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, plazaTH + 2.88, 0);
  group.add(water);
  // Fountain cylinder collider (low barrier, not walkable from the top)
  cylColliders.push({ lx: 0, lz: 0, radius: 3.8, height: 0.7, walkable: false });

  // ── 3. Skyscrapers (3 towers around plaza) ────────────────────────────────
  interface SkyscraperDef { lx: number; lz: number; w: number; d: number; h: number; mat: THREE.Material; rotY: number }
  const skyscrapers: SkyscraperDef[] = [
    { lx:  7, lz: -6, w: 8,  d: 7,  h: 38, mat: glassMat,    rotY: 0.1  },
    { lx: -7, lz:  5, w: 7,  d: 8,  h: 32, mat: concreteMat, rotY: -0.05 },
    { lx:  5, lz:  7, w: 6,  d: 6,  h: 28, mat: glassMat,    rotY: 0.05 },
  ];

  for (const sk of skyscrapers) {
    const th = localTH(sk.lx, sk.lz);
    // Foundation slab: extends 2 units below the terrain surface to prevent
    // gaps when the building stands on a slope.
    const foundH = 2.0;
    addBox(sk.w + 0.6, foundH, sk.d + 0.6, foundationMat, sk.lx, th - foundH / 2, sk.lz, sk.rotY);
    // Main tower body – base at terrain height
    addBox(sk.w, sk.h, sk.d, sk.mat, sk.lx, th + sk.h / 2, sk.lz, sk.rotY, true, true);
    // Stepped crown (smaller box on top)
    addBox(sk.w * 0.6, 4, sk.d * 0.6, darkConcrete, sk.lx, th + sk.h + 2, sk.lz, sk.rotY);
    // Antenna spire
    const antGeo = new THREE.CylinderGeometry(0.06, 0.12, 8, 6);
    const ant = new THREE.Mesh(antGeo, poleMatC);
    ant.position.set(sk.lx, th + sk.h + 8, sk.lz);
    ant.castShadow = true;
    group.add(ant);
    // Antenna beacon (tiny emissive sphere)
    const beaconGeo = new THREE.SphereGeometry(0.2, 6, 5);
    const beaconMat = new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(sk.lx, th + sk.h + 12.3, sk.lz);
    group.add(beacon);
    // Horizontal window strips (every ~2.5 units of height)
    for (let floor = 1; floor < Math.floor(sk.h / 2.5) - 1; floor++) {
      const winH = 1.1;
      const winGeo = new THREE.BoxGeometry(sk.w + 0.08, winH, sk.d + 0.08);
      const win = new THREE.Mesh(winGeo, glassNightMat);
      win.position.set(sk.lx, th + floor * 2.5 + 1.5, sk.lz);
      win.rotation.y = sk.rotY;
      group.add(win);
    }
    // Roof edge trim
    addBox(sk.w + 0.3, 0.4, sk.d + 0.3, roofTrimMat, sk.lx, th + sk.h + 0.22, sk.lz, sk.rotY);
  }

  // ── 4. Medium office buildings (remaining 6 blocks) ───────────────────────
  interface OfficeBlock { bx: number; bz: number }
  const officeBlocks: OfficeBlock[] = [
    { bx: -27, bz: -27 }, { bx: 0,   bz: -27 }, { bx: 27,  bz: -27 },
    { bx: -27, bz:   0 },                         { bx: 27,  bz:   0 },
    { bx: -27, bz:  27 }, { bx: 0,   bz:  27 }, { bx: 27,  bz:  27 },
  ];

  const officeMats = [concreteMat, creamMat, brickMat, concreteMat, creamMat, brickMat, concreteMat, creamMat];

  for (let bi = 0; bi < officeBlocks.length; bi++) {
    const { bx, bz } = officeBlocks[bi];
    const blockMat = officeMats[bi % officeMats.length];
    // Use deterministic layout per block (3-4 buildings arranged around the block centre)
    const numBuildings = 2 + (bi % 3); // 2, 3, or 4 buildings per block
    const buildingOffsets = [
      [-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5],
    ].slice(0, numBuildings);

    for (let i = 0; i < numBuildings; i++) {
      const [ox, oz] = buildingOffsets[i];
      const w = 5 + rng() * 4;   // 5–9 wide
      const d = 4 + rng() * 4;   // 4–8 deep
      const h = 6 + rng() * 12;  // 6–18 tall
      const ry = (rng() - 0.5) * 0.2;
      const lx = bx + ox;
      const lz = bz + oz;
      const th = localTH(lx, lz);
      // Foundation slab
      const foundH = 1.5;
      addBox(w + 0.4, foundH, d + 0.4, foundationMat, lx, th - foundH / 2, lz, ry);
      // Building body – base at terrain height
      addBox(w, h, d, blockMat, lx, th + h / 2, lz, ry, true, true);
      // Flat roof trim
      addBox(w + 0.2, 0.35, d + 0.2, roofTrimMat, lx, th + h + 0.18, lz, ry);
      // Window rows (every 2 units of height)
      const windowCount = Math.floor(h / 2) - 1;
      for (let floor = 1; floor <= windowCount; floor++) {
        const winGeo = new THREE.BoxGeometry(w + 0.06, 0.85, d + 0.06);
        const win = new THREE.Mesh(winGeo, glassNightMat);
        win.position.set(lx, th + floor * 2 + 1, lz);
        win.rotation.y = ry;
        group.add(win);
      }
    }
  }

  // ── 5. Street lights ──────────────────────────────────────────────────────
  // Place along each road edge at intervals
  const lightPositions: [number, number][] = [];
  for (let x = -36; x <= 36; x += 14) {
    lightPositions.push([x, -18.5]);
    lightPositions.push([x, -8.5]);
    lightPositions.push([x,  8.5]);
    lightPositions.push([x,  18.5]);
  }
  for (let z = -36; z <= 36; z += 14) {
    lightPositions.push([-18.5, z]);
    lightPositions.push([ -8.5, z]);
    lightPositions.push([  8.5, z]);
    lightPositions.push([ 18.5, z]);
  }

  for (const [lx, lz] of lightPositions) {
    const th = localTH(lx, lz);
    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.5, 6);
    const pole = new THREE.Mesh(poleGeo, poleMatC);
    pole.position.set(lx, th + 2.75, lz);
    pole.castShadow = true;
    group.add(pole);
    // Arm extending over the road
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5);
    const arm = new THREE.Mesh(armGeo, poleMatC);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(lx + 0.9, th + 5.5, lz);
    group.add(arm);
    // Lamp head
    const lampGeo = new THREE.SphereGeometry(0.25, 8, 6);
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.set(lx + 1.8, th + 5.5, lz);
    group.add(lamp);
  }

  // ── 6. Road bollards at crossroads corners ────────────────────────────────
  const bollardCorners: [number, number][] = [
    [-9, -9], [9, -9], [-9, 9], [9, 9],
    [-9, -18], [9, -18], [-9, 18], [9, 18],
    [-18, -9], [18, -9], [-18, 9], [18, 9],
  ];
  for (const [bx, bz] of bollardCorners) {
    const th = localTH(bx, bz);
    const bGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.9, 6);
    const bMesh = new THREE.Mesh(bGeo, darkConcrete);
    bMesh.position.set(bx, th + 0.45, bz);
    group.add(bMesh);
  }

  return { group, boxColliders, cylColliders };
}

// ─── Bomb ─────────────────────────────────────────────────────────────────────

/**
 * Builds a classic round bomb mesh: black iron sphere with a short stick fuse
 * on top and a glowing spark tip.
 *
 * The group origin sits at the bottom of the sphere so it rests on the ground.
 *
 * @param scale - uniform scale multiplier (default 1.0). Use ~0.55 for the
 *   hand-held first-person version.
 */
export function buildBombMesh(scale = 1.0): THREE.Group {
  const group = new THREE.Group();

  // ── Main sphere body ──────────────────────────────────────────────────────
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x1a1a1a,
    emissive: new THREE.Color(0x050505),
  });
  const highlightMat = new THREE.MeshLambertMaterial({
    color: 0x3a3a3a,
  });

  const bodyGeo = new THREE.SphereGeometry(0.38, 14, 10);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.38;
  body.castShadow = true;
  group.add(body);

  // Small specular highlight sphere (lighter patch on top-left)
  const highlightGeo = new THREE.SphereGeometry(0.10, 6, 5);
  const highlight = new THREE.Mesh(highlightGeo, highlightMat);
  highlight.position.set(-0.12, 0.60, 0.16);
  group.add(highlight);

  // ── Fuse stick (short brown cylinder) ────────────────────────────────────
  const fuseMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const fuseGeo = new THREE.CylinderGeometry(0.025, 0.030, 0.28, 5);
  const fuse = new THREE.Mesh(fuseGeo, fuseMat);
  fuse.position.set(0.04, 0.80, 0.0);
  fuse.rotation.z = 0.22; // slight lean
  group.add(fuse);

  // ── Spark / ember tip (tiny glowing orange-yellow sphere) ─────────────────
  const sparkMat = new THREE.MeshLambertMaterial({
    color: 0xffcc00,
    emissive: new THREE.Color(0xff6600),
    emissiveIntensity: 1.2,
  });
  const sparkGeo = new THREE.SphereGeometry(0.045, 6, 4);
  const spark = new THREE.Mesh(sparkGeo, sparkMat);
  // Position at the tip of the fuse
  spark.position.set(
    0.04 + Math.sin(0.22) * 0.14,
    0.80 + Math.cos(0.22) * 0.14,
    0.0
  );
  group.add(spark);

  group.scale.setScalar(scale);
  return group;
}

// ─── Mountain with Waterfall and Cave ─────────────────────────────────────────

/**
 * Builds a mountain landmark with a cascading waterfall on the right face and a
 * cave entrance on the front-left face.
 *
 * Local layout (centred at 0,0):
 *   Total footprint ≈ 55 × 55 units; peak at ~63 units height.
 *
 * Returns a THREE.Group plus local-space collider arrays compatible with Game3D.
 */
export function buildMountainWithWaterfallAndCave(_terrain?: CityTerrainOptions): CityResult {
  const group = new THREE.Group();
  const boxColliders: RuinsBoxCollider[] = [];
  const cylColliders: RuinsCylCollider[] = [];

  // ── Materials ──────────────────────────────────────────────────────────────
  const rockMat      = new THREE.MeshLambertMaterial({ color: 0x7a7060 });
  const darkRockMat  = new THREE.MeshLambertMaterial({ color: 0x4a4540 });
  const lightRockMat = new THREE.MeshLambertMaterial({ color: 0x9a8e7a });
  const snowMat      = new THREE.MeshLambertMaterial({ color: 0xf0f0f5 });
  const waterMat     = new THREE.MeshLambertMaterial({ color: 0x4a9cd4, transparent: true, opacity: 0.75 });
  const mistMat      = new THREE.MeshLambertMaterial({ color: 0xa8d8f0, transparent: true, opacity: 0.35 });
  const caveMat      = new THREE.MeshLambertMaterial({ color: 0x100e0d });
  const mossRockMat  = new THREE.MeshLambertMaterial({ color: 0x5a6840 });

  // ── Mountain body (stacked cones for a natural rocky profile) ──────────────

  // Layer 1 — wide base skirt
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(26, 8, 9), rockMat);
  skirt.position.set(0, 4, 0);
  group.add(skirt);

  // Layer 2 — main lower body
  const lower1 = new THREE.Mesh(new THREE.ConeGeometry(19, 14, 8), rockMat);
  lower1.position.set(0, 15, 0);
  group.add(lower1);

  // Layer 3 — mid body (slightly rotated for an irregular rocky silhouette)
  const mid1 = new THREE.Mesh(new THREE.ConeGeometry(13, 14, 7), darkRockMat);
  mid1.position.set(0, 29, 0);
  mid1.rotation.y = 0.4;
  group.add(mid1);

  // Layer 4 — upper body
  const upper1 = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 6), darkRockMat);
  upper1.position.set(0, 41, 0);
  upper1.rotation.y = 0.8;
  group.add(upper1);

  // Layer 5 — peak
  const peakMesh = new THREE.Mesh(new THREE.ConeGeometry(4.5, 10, 5), darkRockMat);
  peakMesh.position.set(0, 52, 0);
  peakMesh.rotation.y = 1.2;
  group.add(peakMesh);

  // Snow cap
  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(4, 6, 7), snowMat);
  snowCap.position.set(0, 60, 0);
  group.add(snowCap);

  // Snow patches on upper faces
  const snowPatch1 = new THREE.Mesh(new THREE.ConeGeometry(2, 3, 5), snowMat);
  snowPatch1.position.set(-3, 53, -2);
  snowPatch1.rotation.y = 0.5;
  group.add(snowPatch1);

  const snowPatch2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.5, 5), snowMat);
  snowPatch2.position.set(2, 50, -3);
  group.add(snowPatch2);

  // ── Rocky ledge outcroppings ───────────────────────────────────────────────
  const ledges: [number, number, number, number][] = [
    [12, 10, 12, 0.3],
    [-13, 8, 10, -0.4],
    [14, 18, -8, 0.6],
    [-10, 22, -12, -0.3],
    [8, 32, 6, 0.2],
  ];
  for (const [lx, ly, lz, ry] of ledges) {
    const ledge = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 0), lightRockMat);
    ledge.position.set(lx, ly, lz);
    ledge.rotation.set(0.3, ry, 0.2);
    group.add(ledge);
  }

  // ── Cave entrance (front-left face, near the base) ────────────────────────

  // Outer arch surround — half-cylinder lying on its side
  const caveArch = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 1.0, 12, 1, false, 0, Math.PI),
    mossRockMat,
  );
  caveArch.rotation.x = Math.PI / 2;
  caveArch.rotation.z = Math.PI / 2;
  caveArch.position.set(-9, 3.5, 16);
  group.add(caveArch);

  // Dark backing disc — gives the illusion of depth
  const caveDark = new THREE.Mesh(new THREE.CircleGeometry(2.8, 12), caveMat);
  caveDark.position.set(-9, 3.5, 16.4);
  group.add(caveDark);

  // Cave floor ledge
  const caveFloor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 3), darkRockMat);
  caveFloor.position.set(-9, 0.25, 15);
  group.add(caveFloor);

  // Mossy rocks framing the cave mouth
  const caveFramePts: [number, number, number][] = [
    [-6, 1.5, 16],
    [-12, 1.5, 16],
    [-9, 1.0, 18],
  ];
  for (const [fx, fy, fz] of caveFramePts) {
    const fr = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 0), mossRockMat);
    fr.position.set(fx, fy, fz);
    group.add(fr);
  }

  // ── Waterfall (right face, cascading from mid-height down to pool) ─────────
  const wfSegments: { x: number; y: number; z: number; h: number; w: number; tiltX: number }[] = [
    { x: 11, y: 38, z: 10, h: 8, w: 2.5, tiltX: -0.50 },
    { x: 12, y: 30, z: 12, h: 7, w: 2.8, tiltX: -0.45 },
    { x: 12, y: 23, z: 14, h: 7, w: 3.0, tiltX: -0.40 },
    { x: 11, y: 16, z: 16, h: 7, w: 3.2, tiltX: -0.40 },
    { x: 10, y:  8, z: 17, h: 8, w: 3.5, tiltX: -0.30 },
  ];
  for (const seg of wfSegments) {
    // Front face
    const wf = new THREE.Mesh(new THREE.PlaneGeometry(seg.w, seg.h), waterMat);
    wf.position.set(seg.x, seg.y, seg.z);
    wf.rotation.x = seg.tiltX;
    wf.rotation.y = -0.3;
    group.add(wf);
    // Back face (double-sided workaround for PlaneGeometry)
    const wfB = new THREE.Mesh(new THREE.PlaneGeometry(seg.w, seg.h), waterMat);
    wfB.position.set(seg.x, seg.y, seg.z);
    wfB.rotation.x = seg.tiltX;
    wfB.rotation.y = -0.3 + Math.PI;
    group.add(wfB);
  }

  // Spray / mist at the base of the waterfall
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mistMat);
  mist.position.set(12, 1.5, 19);
  mist.rotation.x = -Math.PI / 4;
  group.add(mist);
  const mistB = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mistMat);
  mistB.position.set(12, 1.5, 19);
  mistB.rotation.x = Math.PI / 4;
  mistB.rotation.y = Math.PI;
  group.add(mistB);

  // Mountain pool at base of waterfall
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.3, 14), waterMat);
  pool.position.set(11, 0.15, 20);
  group.add(pool);

  // Pool stone rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5, 0.4, 6, 16), darkRockMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(11, 0.3, 20);
  group.add(rim);

  // ── Boulders scattered around the base ────────────────────────────────────
  const boulders: [number, number, number, number, number][] = [
    [ 18, 1.5,  -8, 1.2, 0.7],
    [-18, 1.5, -10, 0.9, 0.7],
    [ 20, 1.2,   5, 0.7, 0.6],
    [-20, 1.2,  -2, 1.0, 0.8],
    [ 15, 1.0, -15, 0.8, 0.6],
    [-15, 1.0,  12, 1.1, 0.9],
    [  5, 1.0,  22, 0.8, 0.6],
    [ -5, 1.0,  22, 0.9, 0.7],
  ];
  for (const [bx, by, bz, bsx, bsy] of boulders) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2.0, 0), rockMat);
    boulder.position.set(bx, by, bz);
    boulder.scale.set(bsx + 0.2, bsy * 0.7, bsx + 0.1);
    boulder.rotation.set(0.4, bx * 0.1, 0.3);
    group.add(boulder);
  }

  // ── Colliders ─────────────────────────────────────────────────────────────
  // Main cylinder — keeps players from walking through the mountain core
  cylColliders.push({ lx: 0, lz: 0, radius: 22, height: 65, walkable: false });
  // Pool perimeter — steers players around the pond
  cylColliders.push({ lx: 11, lz: 20, radius: 5.5, height: 0.5, walkable: false });

  return { group, boxColliders, cylColliders };
}
