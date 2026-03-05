# Cave, Spider & Treasure System

## Overview

The cave system adds a fixed underground cave to the game world at position `(-95, y, -85)`, populated with spiders, torches for atmospheric lighting, and a treasure chest as the reward.

## Cave Structure

Built by `buildCaveMesh()` in `lib/meshBuilders.ts`.

- **Position**: `CAVE_X = -95`, `CAVE_Z = -85` (southwest from spawn)
- **Orientation**: Entrance faces south (toward player spawn), rotated `Math.PI`
- **Interior depth**: ~22 units along the -Z axis (local space)
- **Interior width**: ~9 units
- **Interior height**: ~5.5 units

### Components
| Part | Description |
|------|-------------|
| Entrance arch | 7 stone box meshes forming a jagged rocky arch |
| Left / Right walls | Stone-textured box geometry |
| Ceiling | Dark box mesh to block light |
| Back wall | Closes the dead-end cave |
| Floor | Stone-coloured flat surface |
| Stalactites | 8 cone meshes hanging from ceiling |
| Stalagmites | 4 cone meshes rising from floor |

## Torches

Built by `buildTorchMesh()` in `lib/meshBuilders.ts`.

6 torches are placed along both walls at 3 depths inside the cave.

Each torch consists of:
- Wooden stick + iron bracket band
- Orange flame sphere (`name = "flame"`)
- Bright core glow sphere
- `THREE.PointLight` (orange, intensity ~1.4, range 12, decay 1.5)

**Flickering**: Each frame `CaveTorchData.flickerTimer` is incremented by `dt * TORCH_FLICKER_SPEED (4.5)`. Three overlapping sine waves modulate the light intensity for natural flicker.

## Treasure Chest

Built by `buildTreasureChestMesh()` in `lib/meshBuilders.ts`.

- **Position**: Deep in cave at local offset `(1.5, 0, -18)` → world space via cave rotation
- **Reward**: `CHEST_REWARD_COINS = 20` gold coins
- **Open radius**: `CHEST_OPEN_RADIUS = 2.5` units (auto-opens when player gets close)
- **Animation**: `lidGroup.rotation.x = -Math.PI * 0.75` (lid swings open)

### Visual Components
- Wooden base + interior (dark)
- 4 iron corner reinforcements
- Horizontal iron bands
- Hinged lid group with rounded arch top
- Gold lock clasp
- Gold coins + blue gem visible inside

## Spiders

### Types (`SPIDER_TYPE_CONFIGS` in `lib/gameTypes.ts`)

| Type | HP | Damage/hit | Speed | Attack Range | Cooldown | Scale |
|------|----|-----------:|------:|-------------:|---------:|------:|
| Small | 20 | 5 | 4.5 | 1.8 | 0.8s | 0.45 |
| Medium | 50 | 12 | 3.2 | 2.2 | 1.0s | 0.8 |
| Large | 100 | 22 | 2.0 | 2.8 | 1.4s | 1.4 |

**Balance philosophy**: Small spiders are fast but fragile. Large spiders are slow but deadly. Player HP is 100 so a large spider hit does significant damage (22 HP per attack), making the cave genuinely dangerous.

### Spawn Counts (desktop / mobile)
- Small: 5 / 2
- Medium: 3 / 1
- Large: 2 / 1

### AI Behavior

Territory: `CAVE_TERRITORY_RADIUS = 35` units from cave centre.

1. **Aggro radius** (`SPIDER_AGGRO_RADIUS = 28`): If player enters this range of the cave, all nearby spiders chase the player.
2. **Chase**: Spider moves toward player at `cfg.speed` units/sec. Faces player. Stays within territory radius.
3. **Attack**: When within `cfg.attackRange`, spider deals `cfg.attackDamage` HP per attack with `cfg.attackCooldown` second delay.
4. **Wander**: When player is out of aggro range, spiders wander slowly (30% of chase speed) within the cave territory.
5. **Leg bob animation**: Subtle sine-wave Y position offset simulates walking motion.

### Spider Mesh (`buildSpiderMesh()`)

- **Abdomen**: Flattened sphere, rear-mounted
- **Cephalothorax**: Smaller sphere, forward-mounted
- **Eyes**: 8 tiny red emissive spheres arranged on face
- **Legs**: 8 legs (4 per side) each with upper + lower segment
- **Chelicerae**: 2 fang cylinders on front
- All scaled by `SpiderTypeConfig.scale` in Game3D.tsx

## Integration in Game3D.tsx

### Refs
```typescript
spiderListRef:      useRef<SpiderData[]>([])
caveTorchesRef:     useRef<CaveTorchData[]>([])
treasureChestRef:   useRef<TreasureChestData | null>(null)
spidersDefeatedRef: useRef(0)
```

### Constants
```typescript
CAVE_X = -95
CAVE_Z = -85
SPIDER_AGGRO_RADIUS = 28
CAVE_TERRITORY_RADIUS = 35
SPIDER_COUNTS: Record<SpiderType, [desktop, mobile]>
CHEST_REWARD_COINS = 20
CHEST_OPEN_RADIUS = 2.5
TORCH_FLICKER_SPEED = 4.5
```

### Animation Loop Sections
1. **Spider AI** — runs before Catapult AI, updates all spider movement and attacks
2. **Torch flickering** — modulates `light.intensity` each frame
3. **Chest interaction** — distance check to auto-open chest when player approaches

### UI Elements
- **Spider HP bar**: Shows nearest spider's HP when within 20 units (dark red color scheme)
- **Spider warning**: "🕷 Pavouk v blízkosti!" top-center notification
- **Chest opened message**: Full-screen golden overlay with "+20 mincí" reward
- **Scoreboard**: Spider kills shown in the stats panel

### Combat Integration
- **Sword**: Hits nearest spider within weapon range
- **Bow/Crossbow**: Bullets damage spiders on contact (radius `BULLET_HIT_RADIUS * 1.1`)
- **Death**: Spider scales down and disappears; `spidersDefeatedRef` incremented
- **Player hit**: Spider attack deals damage, triggers red flash + sound

## Files Modified

| File | Changes |
|------|---------|
| `lib/gameTypes.ts` | Added `SpiderType`, `SpiderTypeConfig`, `SPIDER_TYPE_CONFIGS`, `SpiderData`, `TreasureChestData`, `CaveTorchData`; added `spidersDefeated` to `GameState` |
| `lib/meshBuilders.ts` | Added `buildSpiderMesh()`, `buildCaveMesh()`, `buildTorchMesh()`, `buildTreasureChestMesh()` |
| `components/Game3D.tsx` | Integrated cave spawning, spider AI, torch flicker, chest interaction, HUD updates |
| `__tests__/meshBuilders.test.ts` | Added tests for 4 new mesh builders |
| `__tests__/spiderCave.test.ts` | New test suite for spider types, combat balance, and cave data structures |
