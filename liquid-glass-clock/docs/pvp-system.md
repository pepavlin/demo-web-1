# PvP Combat System

## Overview

The PvP (Player vs Player) combat system allows players to deal damage to each other using any equipped weapon. Both projectile (ranged) and melee attacks can hit remote players.

## Architecture

### Server (`server.mjs`)

The server is authoritative for player HP:

- Each player starts with `hp: 100`
- `joinTime: Date.now()` is set on join and respawn for spawn protection
- **`player:hit` event**: Receives `{ targetId, damage, weaponType }` from the attacker's client
  - Validates target exists and is alive
  - Enforces spawn protection (3 seconds)
  - Clamps damage to prevent exploits (1–200)
  - Applies damage, emits `player:damaged` to target
  - Broadcasts `player:hp_update` to all clients
  - On kill: emits `player:killed_by` to target, `player:got_kill` to attacker
  - Auto-respawns target after 5 seconds via `player:respawn`
- **`player:update` broadcast**: Includes `hp` field so all clients can show health bars

### Hook (`hooks/useMultiplayer.ts`)

New callbacks and functions:

| Name | Type | Description |
|------|------|-------------|
| `sendHit(targetId, damage, weaponType)` | function | Emits `player:hit` to server |
| `onPlayerDamaged(damage, attackerName)` | callback | Called when local player takes PvP damage |
| `onPlayerKilledBy(killerName)` | callback | Called when local player is killed by another player |
| `onGotKill(victimName)` | callback | Called when local player kills another player |
| `onPlayerHpUpdate(id, hp)` | callback | Called when any remote player's HP changes |
| `onRespawn()` | callback | Called when server grants local player respawn |

### Client (`components/Game3D.tsx`)

#### Outgoing hit detection (attacker-authoritative)

**Projectile collision** (`REMOTE_PLAYER_HIT_RADIUS = 0.75`):
- After each projectile updates, checks distance against all remote player body centers
- Body center = mesh position + 0.5 units up (feet are at y=0, center at ~y=0.5)
- On hit: calls `sendHit`, flashes remote mesh red, shows damage number, removes bullet

**Melee collision**:
- After sword/axe swing, finds closest remote player within weapon range
- On hit: calls `sendHit`, flashes remote mesh red, shows damage number

#### Incoming damage handling

- `handlePlayerDamaged`: reduces local `playerHpRef`, triggers red hit flash, plays hurt sound, shows notification. Triggers game over + sets `killedBy` if HP reaches 0.
- `handleRespawn`: restores HP to 100, clears game over state

#### Remote player HP display

- `remotePlayersRef` entries include `hp` and `hitFlashTimer` fields
- HP is synced via `player:update` broadcasts (20 Hz) and `player:hp_update` events
- `playerLabels` state includes `hp` value for each visible remote player
- Health bars rendered above player name labels (green > 50%, yellow > 25%, red ≤ 25%)

#### Game over screen

Shows `"Zastřelil tě hráč [name]!"` when killed by a player (stored in `killedBy` state), instead of the generic enemy message.

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `REMOTE_PLAYER_HIT_RADIUS` | 0.75 | Sphere radius for bullet/arrow PvP collision |
| `SPAWN_PROTECTION_MS` | 3000 | Spawn protection duration (ms) |
| `RESPAWN_DELAY_MS` | 5000 | Auto-respawn delay after death (ms) |
| `MAX_HIT_DAMAGE` | 200 | Server-side damage cap per hit |
| `PLAYER_MAX_HP` | 100 | Standard player max HP |

## Weapon Damage Values (for reference)

| Weapon | Damage |
|--------|--------|
| Sword | 55 |
| Axe | 45 |
| Bow | 40 (×0.5–1.0 by draw power) |
| Crossbow | 85 |
| Machine Gun | 18 |
| Sniper | 160 |

## Security Notes

- Hit detection is attacker-authoritative (client-side collision, server applies damage)
- Server validates: target exists, not spawn-protected, not already dead
- Server clamps damage to prevent large exploit values
- Spawn protection (3 s) prevents spawn killing
