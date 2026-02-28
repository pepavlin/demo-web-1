# Weather System

The weather system adds dynamic, time-based weather to the 3D game world including rain, clouds, and thunderstorms with lightning.

## Architecture

### `lib/weatherSystem.ts`
Core logic module (framework-agnostic):

- **`WeatherState`** – union type: `"sunny" | "cloudy" | "rainy" | "stormy" | "clearing"`
- **`WeatherConfig`** – per-state parameters (duration range, rain intensity, cloud darkness, fog density, light multipliers, lightning interval, display label)
- **`WEATHER_CONFIGS`** – configuration object keyed by `WeatherState`
- **`nextWeatherState(current)`** – picks a valid next state from the transition table
- **`randomDuration(state)`** – returns a random duration within the configured min/max
- **`lerpWeatherConfig(a, b, t)`** – linearly interpolates between two configs for smooth transitions
- **`generateLightningPath(startX, startZ, skyHeight, groundY)`** – generates a jagged `Float32Array` of XYZ points for a lightning bolt mesh

### State Machine

```
sunny ──────┐
   │        └──► cloudy ──► sunny
   │                │
   │                ├──► rainy ──► clearing ──► sunny
   │                │         │              └──► cloudy
   │                │         └──► stormy ──► clearing
   │                └──► sunny
   └──────────────────────────────────────────► (loops)
```

Each state has a configured minimum and maximum duration (seconds). When the timer expires, `nextWeatherState` picks the next state randomly from valid successors.

### Integration in `Game3D.tsx`

**Refs added:**
| Ref | Purpose |
|-----|---------|
| `rainRef` | Three.js `Points` object with 4,500 rain drop particles |
| `lightningBoltRef` | Three.js `Line` object rebuilt each lightning strike |
| `weatherStateRef` | Current active `WeatherState` |
| `weatherPrevStateRef` | Previous state for blending |
| `weatherBlendRef` | Transition blend factor (0→1) |
| `weatherTimerRef` | Countdown to next state transition |
| `lightningTimerRef` | Countdown to next lightning strike |
| `lightningFlashRef` | Current flash opacity (0–1, decays per frame) |

**State added:**
- `lightningFlash` – React state (0–1) driving the DOM flash overlay opacity
- `weatherLabel` – Czech weather label displayed in the HUD

**Per-frame animation loop updates (inside `Game3D.tsx`):**
1. Decrement `weatherTimerRef`; on expiry call `nextWeatherState` and start blending
2. Lerp `weatherBlendRef` toward 1 at `WEATHER_TRANSITION_SPEED = 0.35/s`
3. Compute blended `wCfg = lerpWeatherConfig(prev, current, blend)`
4. Apply `wCfg.ambientMult` × `getAmbientIntensity(dayFraction)` → ambient light
5. Apply `wCfg.sunMult` × `getSunIntensity(dayFraction)` → directional sun
6. Apply `wCfg.fogDensity` → `scene.fog` (unless underwater)
7. Lerp cloud mesh colours toward dark grey based on `wCfg.cloudDarkness`
8. Dim/hide sun disc and corona based on `wCfg.cloudDarkness`
9. Tint sky toward `#616166` proportional to `cloudDarkness × 0.7`
10. Animate rain particles (fall, wrap at bottom, follow camera)
11. During stormy weather: tick `lightningTimerRef`; on expiry rebuild bolt geometry, spike `lightningFlashRef`, schedule thunder sound via `soundManager.playThunder()` (delayed 1–4 s)
12. Decay `lightningFlashRef`; while active, boost ambient dramatically for flash effect

## Audio

Thunder is synthesised procedurally in `soundManager.playThunder()`:
- **Sharp crack**: short (0.18 s) bandpass-filtered noise burst at ~180 Hz, amplitude 0.55
- **Deep rumble**: long (4.5–6.5 s) low-pass noise at 90–140 Hz, amplitude 0.32, exponential decay

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `RAIN_DROP_COUNT` | 4500 | Number of rain particle points |
| `RAIN_SPEED` | 55 units/s | Fall velocity |
| `RAIN_SPREAD` | 280 | Horizontal radius centred on camera |
| `RAIN_HEIGHT_RANGE` | 90 | Vertical spawn range above camera |
| `LIGHTNING_FLASH_DURATION` | 0.18 s | Flash opacity decay time |
| `WEATHER_TRANSITION_SPEED` | 0.35/s | Blend lerp rate |

## Tests

`__tests__/weatherSystem.test.ts` covers 26 cases:
- All state configs are well-formed (ranges, intensities, labels)
- Transition table invariants (e.g. sunny never goes directly to stormy)
- `randomDuration` stays within bounds
- `lerpWeatherConfig` edge cases at t=0 and t=1 and midpoint
- `generateLightningPath` shape, size, and endpoint correctness
