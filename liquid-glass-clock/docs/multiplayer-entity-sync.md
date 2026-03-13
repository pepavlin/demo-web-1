# Multiplayer Entity Sync System

## Overview

The entity sync system provides universal multiplayer synchronisation for any game entity (NPCs, interactive objects, projectiles).  It is built around a **host-authoritative** model: the first connected player (the "host") runs the simulation and periodically broadcasts entity states to all other clients.

---

## Architecture

### Host-client model

| Client role | Responsibility |
|-------------|---------------|
| **Host** (first player) | Runs NPC AI + physics simulation.  Serialises entity states and broadcasts them at configurable rates. |
| **Non-host** (all others) | Receives entity state batches and applies them.  Skips local AI/movement loops for synced entities but still runs animations. |

When the host disconnects the server promotes the next player in join-order and broadcasts `host:changed`.

### Component overview

```
server.mjs
  ├─ tracks hostId (first connected player)
  ├─ relays entity:batch   (host → all others)
  └─ relays entity:event   (host → all others, for discrete events)

hooks/useMultiplayer.ts
  ├─ sendEntityBatch(batch)  – emits entity:batch (host only)
  ├─ sendEntityEvent(event)  – emits entity:event (host only)
  ├─ onEntityBatch callback  – received by non-hosts
  ├─ onEntityEvent callback  – received by all
  └─ onHostChanged callback  – called when server assigns new host

lib/entitySyncManager.ts
  ├─ EntitySyncManager class
  │    register(id, SyncOptions)   – register an entity for sync
  │    unregister(id)              – remove entity from sync
  │    setIsHost(bool)             – switch host/non-host mode
  │    collectAndSend(sender, now) – host: collect + emit pending batch
  │    applyBatch(batch)           – non-host: apply received states
  │    onEvent(type, handler)      – subscribe to discrete events
  │    applyEvent(event)           – dispatch received events
  └─ SyncOptions interface        – per-entity sync configuration

components/Game3D.tsx
  ├─ entitySyncManagerRef         – singleton manager
  ├─ isHostRef                    – current host status
  ├─ Sheep AI loop: host-only     – skipped on non-host
  ├─ Fox AI loop: host-only       – skipped on non-host
  ├─ Rocket state events          – broadcast on state transitions
  └─ collectAndSend() each frame  – sends pending batches (host only)
```

---

## SyncOptions interface

```typescript
interface SyncOptions {
  /** Toggle sync on/off per entity.  false = fully local, never sent. */
  syncEnabled: boolean;

  /** Target broadcast rate in Hz (default 10).  Lower = less bandwidth. */
  syncRate?: number;

  /** Serialise the entity state to a flat numeric record (host only). */
  serialize: () => Record<string, number>;

  /** Apply a received state snapshot to the entity (non-host only). */
  apply: (state: Record<string, number>) => void;
}
```

---

## Adding a new syncable entity

```typescript
// 1. Register (e.g. in scene setup after the entity is created)
entitySyncManagerRef.current.register(`my_entity_${idx}`, {
  syncEnabled: true,  // set false to make it local-only
  syncRate: 10,       // 10 Hz
  serialize: () => ({
    x: entity.mesh.position.x,
    z: entity.mesh.position.z,
    // ... any numeric state
  }),
  apply: (s) => {
    entity.mesh.position.x = s.x;
    entity.mesh.position.z = s.z;
    // ... restore state
  },
});

// 2. Wrap AI/movement in isHostRef check:
if (isHostRef.current) {
  // run full AI + movement
} else {
  // derive animation params from synchronized state flags only
}

// 3. Unregister when entity is removed:
entitySyncManagerRef.current.unregister(`my_entity_${idx}`);
```

---

## Discrete entity events

For one-time events (e.g. entity death, state machine transitions) that must not be missed:

```typescript
// Send (host)
sendEntityEventRef.current?.({
  id: 'rocket',
  type: 'rocket_state',
  payload: { state: 'launching' },
});

// Receive (all clients via EntitySyncManager)
entitySyncManagerRef.current.onEvent('rocket_state', (id, payload) => {
  // apply the state change
});
```

---

## Synced entities

| Entity | Sync type | Rate | Serialised fields |
|--------|-----------|------|-------------------|
| Sheep | Batch | 10 Hz | x, z, angle, isFleeing, isGrazing, isBurning, burnTimer |
| Fox | Batch | 10 Hz | x, z, rotationY |
| Rocket | Batch + Events | 5 Hz (batch) + immediate (events) | x, y, z, launchProgress; state, countdown (events) |

---

## Bandwidth estimate

With 200 sheep + 12 foxes + 1 rocket at 10/10/5 Hz:

- Sheep: 200 × 7 floats × 4 bytes × 10 Hz ≈ **56 KB/s**
- Fox: 12 × 3 floats × 4 bytes × 10 Hz ≈ **1.4 KB/s**
- Rocket: 1 × 4 floats × 4 bytes × 5 Hz ≈ **80 B/s**

Total outbound from host: ~**57 KB/s** — well within typical broadband limits.

---

## Files changed

| File | Change |
|------|--------|
| `lib/entitySyncManager.ts` | New — core sync manager class |
| `lib/gameTypes.ts` | Re-exports sync types |
| `server.mjs` | Host tracking, entity:batch/event relay |
| `hooks/useMultiplayer.ts` | Entity sync callbacks + send functions |
| `components/Game3D.tsx` | Manager integration, host/non-host AI split |
| `__tests__/entitySyncManager.test.ts` | New — 31 unit tests |
| `__tests__/useMultiplayer.test.tsx` | Updated + 8 new entity sync tests |
