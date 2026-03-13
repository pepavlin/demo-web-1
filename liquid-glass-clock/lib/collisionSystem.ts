/**
 * Collision System – 3D Primitive Colliders
 *
 * Provides typed 3D collider primitives (box, cylinder, sphere) and helper
 * functions for collision resolution and walkable-surface detection.
 *
 * Design principles:
 *  - Pure functions; no Three.js dependency – all geometry is described by
 *    plain numbers so the module can be used and tested outside a browser.
 *  - Horizontal (XZ) push-out respects the collider's vertical extent: a
 *    player standing ON TOP of a box is not pushed sideways.
 *  - Walkable-surface detection finds the highest surface the player can
 *    stand on, enabling walking on top of buildings, walls, etc.
 */

// ─── Collider Types ──────────────────────────────────────────────────────────

/**
 * Axis-aligned (or Y-rotated) box collider in world space.
 *
 *  cx, cy, cz  – world-space centre
 *  halfW       – half-extent along the X axis (before rotation)
 *  halfH       – half-extent along the Y axis
 *  halfD       – half-extent along the Z axis (before rotation)
 *  rotY        – rotation around Y axis (radians)
 *  walkable    – true if the player can stand on the top face
 */
export interface BoxCollider3D {
  cx: number;
  cy: number;
  cz: number;
  halfW: number;
  halfH: number;
  halfD: number;
  rotY: number;
  walkable: boolean;
  /** When true, projectiles pass through without being blocked. Default: false (solid). */
  isTrigger?: boolean;
}

/**
 * Vertical cylinder collider in world space.
 *
 *  x, z        – centre of the cylinder at its base
 *  baseY       – Y position of the bottom face
 *  radius      – cylinder radius (already expanded by PLAYER_RADIUS when stored)
 *  height      – full height of the cylinder
 *  walkable    – true if the player can stand on the top face
 */
export interface CylinderCollider3D {
  x: number;
  baseY: number;
  z: number;
  radius: number;
  height: number;
  walkable: boolean;
  /** When true, projectiles pass through without being blocked. Default: false (solid). */
  isTrigger?: boolean;
}

/**
 * Sphere collider in world space (for small objects – rocks, bollards, etc.).
 *
 *  x, y, z – centre
 *  radius  – radius (already expanded by PLAYER_RADIUS when stored)
 */
export interface SphereCollider3D {
  x: number;
  y: number;
  z: number;
  radius: number;
  /** When true, projectiles pass through without being blocked. Default: false (solid). */
  isTrigger?: boolean;
}

// ─── OBB Helpers ─────────────────────────────────────────────────────────────

/**
 * Test whether a point (px, pz) lies inside an inflated OBB in the XZ plane.
 *
 * Returns the local-space coordinates and per-axis penetration depths so the
 * caller can compute a push-out direction without re-doing the transform.
 */
export function testOBBXZ(
  px: number,
  pz: number,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rotY: number,
): {
  inside: boolean;
  lx: number;
  lz: number;
  overlapX: number;
  overlapZ: number;
} {
  const cosR = Math.cos(-rotY);
  const sinR = Math.sin(-rotY);
  const dx = px - cx;
  const dz = pz - cz;
  // Rotate into box-local space
  const lx = dx * cosR - dz * sinR;
  const lz = dx * sinR + dz * cosR;
  const overlapX = halfW - Math.abs(lx);
  const overlapZ = halfD - Math.abs(lz);
  return {
    inside: overlapX > 0 && overlapZ > 0,
    lx,
    lz,
    overlapX,
    overlapZ,
  };
}

// ─── Horizontal Collision Resolution ─────────────────────────────────────────

/**
 * Push the player's XZ position out of a 3D box collider.
 *
 * The push only applies when the player's vertical extent overlaps with the
 * box's vertical extent.  A player standing ON TOP of the box (feet >= box
 * top) or entirely below it is not affected.
 *
 * @param px          Player position X (modified in-place via the returned object)
 * @param py          Player camera/eye Y
 * @param pz          Player position Z (modified in-place)
 * @param playerRadius Horizontal collision radius of the player capsule
 * @param playerHeight Eye-to-feet height offset
 * @param box         The box collider to test against
 * @returns           New { x, z } after push-out (same as input if no collision)
 */
export function resolveBoxCollision3D(
  px: number,
  py: number,
  pz: number,
  playerRadius: number,
  playerHeight: number,
  box: BoxCollider3D,
): { x: number; z: number } {
  const playerFeetY = py - playerHeight;
  const boxTop = box.cy + box.halfH;
  const boxBottom = box.cy - box.halfH;

  // No vertical overlap → no horizontal push
  if (playerFeetY >= boxTop - 0.02 || py <= boxBottom + 0.02) {
    return { x: px, z: pz };
  }

  const inflW = box.halfW + playerRadius;
  const inflD = box.halfD + playerRadius;
  const { inside, lx, lz, overlapX, overlapZ } = testOBBXZ(
    px,
    pz,
    box.cx,
    box.cz,
    inflW,
    inflD,
    box.rotY,
  );

  if (!inside) return { x: px, z: pz };

  // Push along the axis of least penetration
  let pushLx = 0;
  let pushLz = 0;
  if (overlapX < overlapZ) {
    pushLx = overlapX * Math.sign(lx);
  } else {
    pushLz = overlapZ * Math.sign(lz);
  }

  // Transform push back to world space
  const cosRi = Math.cos(box.rotY);
  const sinRi = Math.sin(box.rotY);
  const newLx = lx + pushLx;
  const newLz = lz + pushLz;
  return {
    x: box.cx + newLx * cosRi - newLz * sinRi,
    z: box.cz + newLx * sinRi + newLz * cosRi,
  };
}

/**
 * Push the player's XZ position out of a 3D cylinder collider.
 *
 * Only applies when the player's vertical extent overlaps the cylinder.
 */
export function resolveCylinderCollision3D(
  px: number,
  py: number,
  pz: number,
  playerRadius: number,
  playerHeight: number,
  cyl: CylinderCollider3D,
): { x: number; z: number } {
  const playerFeetY = py - playerHeight;
  const cylTop = cyl.baseY + cyl.height;

  // No vertical overlap → no horizontal push
  if (playerFeetY >= cylTop - 0.02 || py <= cyl.baseY + 0.02) {
    return { x: px, z: pz };
  }

  const tdx = px - cyl.x;
  const tdz = pz - cyl.z;
  const tdist = Math.sqrt(tdx * tdx + tdz * tdz);
  // Note: cyl.radius already includes PLAYER_RADIUS (convention kept from original code)
  if (tdist >= cyl.radius || tdist < 0.001) return { x: px, z: pz };

  const nx = tdx / tdist;
  const nz = tdz / tdist;
  return {
    x: cyl.x + nx * cyl.radius,
    z: cyl.z + nz * cyl.radius,
  };
}

/**
 * Push the player's XZ position out of a sphere collider.
 *
 * Only applies when the player is at overlapping height.
 */
export function resolveSphereCollision3D(
  px: number,
  py: number,
  pz: number,
  playerRadius: number,
  playerHeight: number,
  sphere: SphereCollider3D,
): { x: number; z: number } {
  const playerFeetY = py - playerHeight;
  // Rough vertical check: player overlaps sphere's Y range
  if (playerFeetY >= sphere.y + sphere.radius || py <= sphere.y - sphere.radius) {
    return { x: px, z: pz };
  }

  const tdx = px - sphere.x;
  const tdz = pz - sphere.z;
  const tdist = Math.sqrt(tdx * tdx + tdz * tdz);
  const minDist = sphere.radius + playerRadius;
  if (tdist >= minDist || tdist < 0.001) return { x: px, z: pz };

  const nx = tdx / tdist;
  const nz = tdz / tdist;
  return {
    x: sphere.x + nx * minDist,
    z: sphere.z + nz * minDist,
  };
}

// ─── Walkable Surface Detection ───────────────────────────────────────────────

/**
 * Returns the Y position the player's camera must be at to stand on the
 * highest walkable surface directly under the player at (px, pz).
 *
 * Returns -Infinity when no walkable collider is found at this XZ position
 * (caller should then fall back to terrain height).
 *
 * @param px            Player X
 * @param pz            Player Z
 * @param playerY       Player camera Y (used to check player is above surface)
 * @param playerHeight  Eye-to-feet height offset
 * @param playerRadius  Horizontal footprint radius used for XZ overlap check
 * @param boxes         Array of registered 3D box colliders
 * @param cyls          Array of registered 3D cylinder colliders
 */
export function getWalkableSurfaceY(
  px: number,
  pz: number,
  playerY: number,
  playerHeight: number,
  playerRadius: number,
  boxes: BoxCollider3D[],
  cyls: CylinderCollider3D[],
): number {
  const playerFeetY = playerY - playerHeight;
  let maxSurfaceY = -Infinity;

  for (const box of boxes) {
    if (!box.walkable) continue;
    const topY = box.cy + box.halfH;
    // Player's feet must be at or above the box top (standing on it)
    if (playerFeetY < topY - 0.1) continue;

    // Slightly expanded footprint for edge-standing
    const { inside } = testOBBXZ(px, pz, box.cx, box.cz, box.halfW + playerRadius * 0.5, box.halfD + playerRadius * 0.5, box.rotY);
    if (inside) {
      const cameraOnTop = topY + playerHeight;
      if (cameraOnTop > maxSurfaceY) maxSurfaceY = cameraOnTop;
    }
  }

  for (const cyl of cyls) {
    if (!cyl.walkable) continue;
    const topY = cyl.baseY + cyl.height;
    if (playerFeetY < topY - 0.1) continue;

    const dx = px - cyl.x;
    const dz = pz - cyl.z;
    // cyl.radius already includes PLAYER_RADIUS; use that for the footprint
    if (dx * dx + dz * dz <= cyl.radius * cyl.radius) {
      const cameraOnTop = topY + playerHeight;
      if (cameraOnTop > maxSurfaceY) maxSurfaceY = cameraOnTop;
    }
  }

  return maxSurfaceY;
}
