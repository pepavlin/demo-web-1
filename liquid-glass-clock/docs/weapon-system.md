# Weapon System

The game features four distinct weapons selectable before entering the world (or picked up in-world). Each has a unique combat style, 3D model, and procedurally synthesised audio.

## Weapons

| Key | Weapon | Czech | Type | Damage | Cooldown | Bullet Speed | Range |
|-----|--------|-------|------|--------|----------|--------------|-------|
| [1] | Sword | Meč | Melee only | 55 | 0.45s | — | 2.2 u |
| [2] | Bow | Luk | Ranged | 40 | 1.1s | 38 u/s | 80 u |
| [3] | Crossbow | Kuše | Ranged | 85 | 2.2s | 90 u/s | 100 u |
| [4] | Sniper | Odstřelovačka | Ranged + scope | 160 | 2.8s | 220 u/s | 400 u |

## Sword (Meč)

- **Combat style:** Fencing / melee. No projectiles are spawned.
- **Range:** 2.2 world units.
- **3D model:** `buildSwordMesh()` — long blade with emissive glow, golden cross-guard, wrapped grip, pommel sphere.
- **Sound:** `_playSwordSwing()` — sharp bandpass noise swish (2.4 kHz) + metallic sine ring (~920–1040 Hz).
- **Special:** Only the sword can perform melee attacks against catapults (checked in `doAttack` via `weaponCfg.type === "sword"`).

## Bow (Luk)

- **Combat style:** Silent ranged. Fires arrow projectiles at moderate speed.
- **Range:** 80 units (long).
- **3D model:** `buildBowMesh()` — curved limbs in three segments, dark wood grip, bowstring, loaded arrow with fletching. Limb segments `bowUpperSeg2/3` and `bowLowerSeg2/3` store `userData.baseRotZ` / `userData.basePosZ` for the dynamic flex animation.
- **Sound:** `_playBowShot()` — low-frequency bowstring twang (130 Hz + harmonic at 260 Hz) + high-pass noise whoosh (1.8 kHz) representing the arrow in flight.
- **Bow draw animation (3D, first-person):**
  - `bowstring` group moves in +Z (toward archer) proportional to `drawProgress`
  - `bowUpperSeg2/3` and `bowLowerSeg2/3` flex in +Z and rotate around Z to simulate limb bending
  - Mid-segments flex at half the amplitude of tip segments
  - On release/cooldown the animation smoothly relaxes back to rest pose
- **Bow SVG (weapon select UI):** Arrow points LEFT (toward enemy) with arrowhead at x≈30, bow limbs on the right at x≈90 curving rightward — consistent with sword/sniper orientation in weapon cards.

## Crossbow (Kuše)

- **Combat style:** High-damage ranged. Fires bolt projectiles at high speed with long reload.
- **Range:** 100 units (very long).
- **3D model:** `buildCrossbowMesh()` — wooden stock with butt, metal rail/tiller, horizontal limbs, stirrup, drawn string, trigger guard, loaded bolt with tip.
- **Sound:** `_playCrossbowShot()` — square wave mechanical trigger click (580 Hz) + deep sine thunk (210→70 Hz) + high-pass noise bolt release (3 kHz).

## Sniper Rifle (Odstřelovačka)

- **Combat style:** Precision long-range. Single-shot only (no auto-fire). Fastest bullet speed.
- **Range:** 400 units (extreme long).
- **Scope mechanic:** Hold **right mouse button** to zoom in (FOV 75° → 12°) with a full sniper scope overlay (vignette, crosshair, mil-dot reticle). Release to exit scope.
- **3D model:** `buildSniperMesh()` — long barrel with suppressor, wooden stock, cheekrest, optical scope with glowing objective lens, bipod legs, trigger guard, pistol grip.
- **Special:** Single-shot (no auto-fire); weapon model hidden while scoped; movement sway near-zero while aiming.
- **Tower pickup:** At the top of the Sniper Tower (see `sniper-tower.md`), pressing **[E]** equips the sniper regardless of initially selected weapon.

## Architecture

### Type System (`lib/gameTypes.ts`)

```typescript
export type WeaponType = "sword" | "bow" | "crossbow" | "sniper";

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
- Keyboard shortcuts: [1] Sword, [2] Bow, [3] Crossbow, [4] Sniper, [Enter] confirm

### 3D Models (`lib/meshBuilders.ts`)

| Function | Weapon |
|----------|--------|
| `buildSwordMesh()` | Sword |
| `buildBowMesh()` | Bow |
| `buildCrossbowMesh()` | Crossbow |
| `buildSniperMesh()` | Sniper Rifle |

### Sound (`lib/soundManager.ts`)

`playAttack(weaponType: string)` dispatches to one of the private synthesis methods based on the weapon type. All sounds are procedurally generated via the Web Audio API.

### Game Loop (`components/Game3D.tsx`)

- **`swapWeaponMesh(type)`** — removes the old mesh from its current parent (camera or hand anchor), builds a new mesh, and calls `attachWeaponToAnchor` for the current mode.
- **`attachWeaponToAnchor(mode)`** — the single function responsible for weapon parent/transform. In FP mode: `camera.add(weapon)` with WEAPON_FP_CONFIG transform. In TP mode: `handR.add(weapon)` with WEAPON_TP_CONFIG transform.
- **`doAttack()`** — calls `soundManager.playAttack(weaponCfg.type)`, spawns projectile if `bulletSpeed > 0`, checks melee range for immediate hits. **Blocked** when possessing a sheep, on a boat, on the rocket, or inside the space station.
- **Weapon sway** — FP-only bob/sway animation updated each frame. In TP the weapon rides the arm animation naturally (weapon is a child of handR which is a child of armR).
- **Scope logic** — right-click mousedown sets `isScopedRef`, hides weapon mesh, smoothly interpolates camera FOV to `SNIPER_SCOPE_FOV` (12°). Release restores `DEFAULT_FOV` (75°). **Scope is blocked in third-person mode.**
- **HUD** — weapon slots show emoji (⚔️ 🏹 🎯 🔭) with active weapon highlighted.
- **Scroll wheel / [1][2][3][4]** — cycle or select weapons during gameplay.
- **Auto-fire exclusion** — sniper is excluded from the auto-fire loop (single-shot only, like bow).

### Weapon Anchor System

The weapon mesh is re-parented between two anchors depending on the active camera mode:

| Mode | Parent anchor | Transform source |
|------|--------------|-----------------|
| First-person | `camera` | `WEAPON_FP_CONFIG[type]` |
| Third-person | `handR` (child of `armR` on local player body) | `WEAPON_TP_CONFIG[type]` |

**Key files and objects:**
- `WEAPON_FP_CONFIG` — canonical FP transforms (pos, rot, scale) per weapon type
- `WEAPON_TP_CONFIG` — canonical TP transforms per weapon type (scale < 1, z offset positive to extend forward from hand)
- `applyWeaponTransform(mesh, type, mode)` — module-level helper; applies the correct config
- `attachWeaponToAnchor(mode)` — React callback; detaches from old parent, calls `applyWeaponTransform`, attaches to new parent
- `tpWeaponAnchorRef` — ref to the `handR` `Object3D` (retrieved via `playerBody.getObjectByName("handR")`)
- `handR` is added inside `buildRemotePlayerMesh()` as a named child of `armR` at `y = -0.21` (arm tip)

**Adding a new weapon type:**
1. Add the type to `WeaponType` in `lib/gameTypes.ts`
2. Add an entry to `WEAPON_FP_CONFIG` and `WEAPON_TP_CONFIG` in `Game3D.tsx`
3. Add a mesh builder function and register it in `swapWeaponMesh` / `attachWeaponToAnchor`
4. No changes needed to the anchor system itself

**Bullet spawn position:**
In third-person, `doAttack()` spawns bullets from `playerBodyPosRef + eye-height offset` (not the camera position) to avoid bullets originating from behind the character.

**Sword melee range:**
In third-person, the hit-detection origin is `playerBodyPosRef` (not `cam.position`) so sword range is measured from the character's body, not the orbiting camera.

### State guards

`doAttack()` exits early (no sound, no cooldown, no projectile) if any of these states are active:

| State | Reason |
|-------|--------|
| `possessedSheepRef.current !== null` | Player is controlling a sheep body — no human weapons available |
| `onBoatRef.current` | Steering the boat — combat disabled |
| `onRocketRef.current` | Inside rocket cabin — combat disabled |
| `inSpaceStationRef.current` | Inside space station — combat disabled |
