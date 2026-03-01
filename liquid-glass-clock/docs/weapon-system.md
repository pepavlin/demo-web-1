# Weapon System

The game features three distinct weapons selectable before entering the world. Each has a unique combat style, 3D model, and procedurally synthesised audio.

## Weapons

| Key | Weapon | Czech | Type | Damage | Cooldown | Bullet Speed |
|-----|--------|-------|------|--------|----------|--------------|
| [1] | Sword | Meč | Melee only | 55 | 0.45s | — |
| [2] | Bow | Luk | Ranged | 40 | 1.1s | 38 u/s |
| [3] | Crossbow | Kuše | Ranged | 85 | 2.2s | 90 u/s |

## Sword (Meč)

- **Combat style:** Fencing / melee. No projectiles are spawned.
- **Range:** 2.2 world units.
- **3D model:** `buildSwordMesh()` — long blade with emissive glow, golden cross-guard, wrapped grip, pommel sphere.
- **Sound:** `_playSwordSwing()` — sharp bandpass noise swish (2.4 kHz) + metallic sine ring (~920–1040 Hz).
- **Special:** Only the sword can perform melee attacks against catapults (checked in `doAttack` via `weaponCfg.type === "sword"`).

## Bow (Luk)

- **Combat style:** Silent ranged. Fires arrow projectiles at moderate speed.
- **Range:** 80 units (long).
- **3D model:** `buildBowMesh()` — curved limbs in three segments, dark wood grip, bowstring, loaded arrow with fletching.
- **Sound:** `_playBowShot()` — low-frequency bowstring twang (130 Hz + harmonic at 260 Hz) + high-pass noise whoosh (1.8 kHz) representing the arrow in flight.

## Crossbow (Kuše)

- **Combat style:** High-damage ranged. Fires bolt projectiles at high speed with long reload.
- **Range:** 100 units (very long).
- **3D model:** `buildCrossbowMesh()` — wooden stock with butt, metal rail/tiller, horizontal limbs, stirrup, drawn string, trigger guard, loaded bolt with tip.
- **Sound:** `_playCrossbowShot()` — square wave mechanical trigger click (580 Hz) + deep sine thunk (210→70 Hz) + high-pass noise bolt release (3 kHz).

## Architecture

### Type System (`lib/gameTypes.ts`)

```typescript
export type WeaponType = "sword" | "bow" | "crossbow";

export interface WeaponConfig {
  type: WeaponType;
  label: string;       // Czech display name
  damage: number;
  range: number;       // Melee range (0 = melee only) or max range for ranged
  cooldown: number;    // Seconds between attacks
  bulletSpeed: number; // 0 = melee-only; >0 = ranged projectile speed
  color: string;       // CSS accent colour for UI
}
```

### Selection UI (`components/WeaponSelect.tsx`)

- Animated SVG previews for each weapon (idle animation, attack animation)
- Czech descriptions and stat bars per weapon
- Keyboard shortcuts: [1] Sword, [2] Bow, [3] Crossbow, [Enter] confirm

### 3D Models (`lib/meshBuilders.ts`)

| Function | Weapon |
|----------|--------|
| `buildSwordMesh()` | Sword |
| `buildBowMesh()` | Bow |
| `buildCrossbowMesh()` | Crossbow |

### Sound (`lib/soundManager.ts`)

`playAttack(weaponType: string)` dispatches to one of three private synthesis methods based on the weapon type. All sounds are procedurally generated via the Web Audio API.

### Game Loop (`components/Game3D.tsx`)

- **`swapWeaponMesh(type)`** — replaces the camera-parented weapon group when switching.
- **`doAttack()`** — calls `soundManager.playAttack(weaponCfg.type)`, spawns projectile if `bulletSpeed > 0`, checks melee range for immediate hits.
- **Weapon sway** — per-weapon base position constants for idle sway animation.
- **HUD** — weapon slots show emoji (⚔️ 🏹 🎯) with active weapon highlighted.
- **Scroll wheel / [1][2][3]** — cycle or select weapons during gameplay.
