# Rendering Performance

## Overview

The game uses a Three.js `WebGLRenderer` with several active optimizations to maintain smooth frame rates, especially when large portions of the world are visible (high-altitude / whole-map views).

---

## Renderer Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| `antialias` | `true` (desktop) / `false` (mobile) | MSAA disabled on mobile for fill-rate saving |
| `powerPreference` | `"high-performance"` | Hints browser to use discrete GPU on dual-GPU laptops |
| `pixelRatio` | `min(devicePixelRatio, 2)` | Cap at 2× to limit fill-rate cost |
| `shadowMap.type` | `PCFSoftShadowMap` | Soft shadows |
| `shadowMap.mapSize` | `1024×1024` | Balance between quality and GPU cost |
| `toneMapping` | `ACESFilmicToneMapping` | Cinematic HDR tone mapping |

---

## Shadow Camera

The `DirectionalLight` (sun) shadow frustum is **centred on the player**, not the entire world.

| Property | Value | Notes |
|----------|-------|-------|
| Frustum half-width | ±120 world units | 240×240 coverage vs the old 500×500 |
| `mapSize` | 1024×1024 | 4× faster than 2048×2048 |
| Target tracking | every frame | `sun.target.position` set to camera XZ each frame |

**Performance impact:** shadow render area is ~23% of the old value, and the shadow map is 25% the resolution → overall shadow cost is approximately **6× lower**.

When the player moves, shadows move with them, always covering the immediate surrounding area.

---

## Terrain LOD — Altitude Scaling

See [terrain-system.md](./terrain-system.md#altitude-aware-lod-scaling) for the full description.

**Key behaviour:** `updateTerrainLOD(camX, camZ, camY)` applies an altitude multiplier when the camera is above 30 world units, scaling both LOD thresholds by up to 3×.  At altitude ≥ 90 the entire map switches to LOD 2 (~1/16 triangles).

---

## Adaptive Pixel Ratio

Every 90 rendered frames (~1.5 s at 60 fps) the actual frame rate is measured.

| Measured FPS | Action |
|-------------|--------|
| < 40 fps | Reduce `pixelRatio` by 0.5 (min 1.0) |
| > 55 fps | Increase `pixelRatio` by 0.5 (max `min(devicePixelRatio, 2)`) |

This provides automatic quality scaling: when many chunks are visible (whole-map view, high altitude) the renderer automatically drops to a lower fill rate to stay smooth.

---

## Per-Frame Garbage Collection Avoidance

JavaScript GC pauses are a common source of stutter. The following module-level constants are **pre-allocated once** and reused every frame:

| Object | Purpose |
|--------|---------|
| `_renderStormGrey` | Sky storm tinting |
| `_renderSkyTemp` | Sky color blend destination |
| `_renderCloudWhite / _renderCloudStorm / _renderCloudTemp` | Cloud color lerp |
| `_renderSunDir` | Normalized sun direction (disc, corona, water) |

Before this optimization, 2–4 `new THREE.Color()` and `position.clone()` objects were allocated **every frame**, creating GC pressure.

---

## Cloud Color Update Throttling

Cloud mesh colors are updated by traversing the scene hierarchy of every cloud mesh object.  This is skipped when weather is stable:

```
if (weatherBlendRef.current < 0.999 || frameCount % 60 === 0) {
  // traverse cloud meshes and update color
}
```

When weather is not transitioning, the expensive `mesh.traverse()` loop runs only once per second (at 60 fps), rather than 60 times.

---

## Flora LOD

Flora (trees, bushes) use a two-stage LOD system:

1. **3D mesh** shown when XZ distance < `LOD_SPRITE_DIST` (70 units desktop / 40 mobile)
2. **Billboard sprite** shown between sprite distance and `LOD_FLORA_VIS` (220 / 110)
3. **Hidden** beyond visibility radius

Wind sway is updated every other frame (`frameCount % 2 === 0`) within 80 units of the camera.

---

## HUD & Minimap Throttling

| Update | Interval |
|--------|---------|
| Minimap canvas | Every 3rd frame (~20 fps) |
| React HUD state | Every 6th frame (~10 fps) |
| Terrain LOD | Every 30th frame (~2 fps) |
| Bioluminescent plants | Every 3rd frame |

---

## Shadow Caster Reduction

Removing small or numerous entities from the shadow pass reduces the number of meshes
drawn into the shadow map each frame.

| Entity | Policy | Reason |
|--------|--------|--------|
| Sheep (200 desktop) | `castShadow = false` | ~1600 mesh parts otherwise fill the shadow pass |
| Foxes (12 desktop) | `castShadow = false` | Same rationale |
| Rocks (90 desktop) | `castShadow = false` + `matrixAutoUpdate = false` | Small, static, no visible shadow |
| Trees / buildings | `castShadow = true` | Major scene elements, shadows expected |

**matrixAutoUpdate = false** is set on rock meshes after placement: rocks never move,
so Three.js need not recompute their world matrix every frame (saves ~90+ matrix
multiplications per frame).

---

## Entity AI Staggering

Sheep and foxes in the **LOD distance range (65–200 units)** skip behavioral AI on
odd-numbered frames (`frameCount % 2 !== 0`).  Their mesh positions continue to update
every frame via cached velocity, so movement stays smooth.  Only the decision logic
(wander target, flee checks) runs at half rate — imperceptible for distant entities.

---

## CSS Performance (Lobby / UI)

### backdrop-filter Blur Reduction

`backdrop-filter: blur()` resamples every pixel behind the element every frame the
background moves.  Blur cost scales with **radius²**, so 40 px was 6.25× more expensive
than 16 px for equivalent visual effect.

| Class | Old | New |
|-------|-----|-----|
| `.liquid-glass` | `blur(40px) saturate(180%)` | `blur(16px) saturate(150%)` |
| `.liquid-glass-inner` | `blur(20px)` | `blur(12px)` |
| `.digit-glass` | `blur(30px) saturate(200%)` | `blur(16px) saturate(160%)` |

### canvas-hue-cycle Removed

`filter: hue-rotate()` on a WebGL `<canvas>` element bypasses hardware-accelerated
compositing.  The browser must read back the entire GPU framebuffer to the CPU, apply
the software filter, and re-upload every frame — effectively disabling the GPU fast-path
for the canvas compositor layer.  The animation has been removed.

### Volumetric Rays Optimization

| Property | Old | New |
|----------|-----|-----|
| `.vol-ray` blur | `18px` | `10px` |
| `.vol-ray-warm` blur | `20px` | `11px` |
| `.vol-rays-container` | — | `contain: layout style paint` |
| `.vol-rays-hub` / `.vol-rays-hub-warm` | — | `will-change: transform` |

`will-change: transform` promotes the rotating ray hubs to dedicated GPU compositor
layers, ensuring their CSS rotation runs entirely on the GPU without triggering paint
invalidations in the rest of the page.

### GeometricParticles 30 fps Cap

The particle canvas (lobby only) now renders at a maximum of **30 fps** instead of
matching the display refresh rate.  Background decoration does not need 60 fps
smoothness; halving the frame rate halves all canvas CPU and GPU cost for this element.
