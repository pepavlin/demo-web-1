# Physics System

## Overview

The physics system (`lib/physicsSystem.ts`) is a lightweight, pure-TypeScript rigid-body simulation engine that provides gravity, slope-sliding, bouncing, and a sleep optimisation for arbitrary game objects.

It is designed to be:
- **Framework-agnostic** — zero Three.js dependency; all geometry is plain `Vec3` objects
- **Testable** — easily unit-tested with a mock terrain sampler
- **Extensible** — any game object can be given a `PhysicsBody` with two lines of code

## Architecture

```
PhysicsWorld
  ├── Map<id, PhysicsBody>
  ├── TerrainSampler (injected)
  └── update(dt) → steps all active bodies
```

### `PhysicsWorld`

Central container.  Create one per game scene and call `update(dt)` each animation frame.

```ts
import { PhysicsWorld } from "@/lib/physicsSystem";

const world = new PhysicsWorld(getTerrainHeightSampled);
```

**API**

| Method | Description |
|--------|-------------|
| `addBody(opts)` | Register a body; returns a `PhysicsBody` instance |
| `removeBody(id)` | Remove a body (e.g. after collection/despawn) |
| `getBody(id)` | Retrieve a body by id |
| `update(dt)` | Advance the simulation (call once per frame) |
| `clear()` | Remove all bodies (call on scene teardown) |
| `bodyCount` | Number of currently tracked bodies |

### `PhysicsBody`

A single simulated rigid body.  Internal state is mutated each step.

| Property | Type | Description |
|----------|------|-------------|
| `position` | `Vec3` | Current world-space position (mutated each step) |
| `velocity` | `Vec3` | Current velocity (mutated each step) |
| `isOnGround` | `boolean` | True when resting on terrain |
| `isSleeping` | `boolean` | True when below velocity threshold for `SLEEP_TIME_THRESHOLD` seconds |

**`applyImpulse(ix, iy, iz)`** — Wake a sleeping body and add a velocity impulse.

## Physics Model

### Integration

Semi-implicit Euler (velocity first, then position).  `dt` is clamped to 50 ms to prevent tunnel-through on frame spikes.

### Gravity

```
PHYSICS_GRAVITY = −25 (world units / s²)
```

Applied every frame when the body is in the air.

### Terrain Collision

The terrain height at `(x, z)` is sampled via the injected `TerrainSampler` function.  A body whose `position.y` drops to `terrainY + radius` triggers ground collision:

1. Body snaps to `terrainY + radius`
2. Vertical velocity is negated and multiplied by `restitution` (bounce)
3. Below `MIN_BOUNCE_VELOCITY (1.2 m/s)` — no bounce, velocity zeroed

### Slope Sliding

The terrain normal is estimated via finite differences (4 samples, ε = 0.4 units).  On the ground:

1. Gravity is decomposed into **normal** and **tangent** components relative to the terrain plane
2. The tangent component is applied as a slide acceleration (body rolls downhill)
3. Kinetic friction opposes horizontal velocity: `frictionDecel = friction × g × |N.y| × dt`
   - On steep slopes `|N.y|` is small → less friction → objects slide freely
   - On flat ground `|N.y| ≈ 1` → full friction

### Air Drag

A configurable `linearDamping` coefficient is applied each frame:
```
v *= (1 − linearDamping)^dt
```
On-ground damping uses the full coefficient; in-air damping uses 30% of it.

### Sleep System

A body that has been below `SLEEP_LINEAR_THRESHOLD (0.08 m/s)` on the ground for `SLEEP_TIME_THRESHOLD (0.6 s)` transitions to sleeping and is skipped in subsequent frames.  `onSleep()` is called once on entry.  `applyImpulse()` wakes the body.

### Callbacks

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onUpdate` | `(pos, vel, dt) => void` | Called every simulation step; sync Three.js mesh here |
| `onSleep` | `() => void` | Called once when the body transitions to sleep |

## Game Integration

### Initialisation (`Game3D.tsx`)

```ts
physicsWorldRef.current = new PhysicsWorld(getTerrainHeightSampled);
```

Called once in the main `useEffect`, right after terrain noise initialisation.

### Game Loop

```ts
// Inside the animation loop (after tree/AI updates):
if (physicsWorldRef.current) {
  physicsWorldRef.current.update(dt);
}
```

### Cleanup

```ts
if (physicsWorldRef.current) {
  physicsWorldRef.current.clear();
  physicsWorldRef.current = null;
}
```

Called in the `useEffect` cleanup function.

## Currently Supported Objects

### Wood Logs (from chopped trees)

Each log spawned by `treeDataRef` tree-fall code registers a `PhysicsBody`:

- **Radius:** 0.22
- **Restitution:** 0.18 (small bounce)
- **Friction:** 0.55
- **Linear damping:** 0.06
- **Initial velocity:** scattered outward from tree base with upward component

The `onUpdate` callback syncs the Three.js mesh position and accumulates a rolling rotation angle based on horizontal speed.  `onSleep` snaps the log to a flat resting orientation.

### Airdrop Crates

Supply crates from the airdrop system get a `PhysicsBody` with:

- **Radius:** 0.65 (half-height of the box)
- **Linear damping:** 0.92 (simulates parachute drag — crate descends at roughly constant velocity)
- **Restitution:** 0.05 (near-no-bounce on landing)
- **Friction:** 0.7

After landing the crate can slide on slopes (e.g. steep hillsides) until it comes to rest.  Position tracking (`ad.x`, `ad.z`) is updated via `onUpdate` so proximity detection and auto-open always use the final resting position.

## Extending to New Objects

```ts
const world = physicsWorldRef.current;
if (world) {
  world.addBody({
    id: `barrel-${Date.now()}`,
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    radius: 0.4,
    restitution: 0.3,
    friction: 0.45,
    onUpdate: (pos, vel, dt) => {
      barrelMesh.position.set(pos.x, pos.y, pos.z);
      barrelRollAngle += Math.sqrt(vel.x**2 + vel.z**2) * dt / 0.4;
      barrelMesh.rotation.z = barrelRollAngle;
    },
    onSleep: () => {
      // Optionally snap rotation, disable shadows, emit sound, …
    },
  });
}
```

When the barrel is collected or destroyed:

```ts
world.removeBody(barrelBodyId);
```

## Files

| File | Purpose |
|------|---------|
| `lib/physicsSystem.ts` | Core physics engine |
| `__tests__/physicsSystem.test.ts` | 27 unit tests |
| `components/Game3D.tsx` | Integration (physicsWorldRef, wood logs, airdrop crates) |
| `lib/gameTypes.ts` | `AirdropData.physicsBodyId` field |
