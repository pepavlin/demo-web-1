# Rendering Performance

## Overview

The game uses a Three.js `WebGLRenderer` with several active optimizations to maintain smooth frame rates, especially when large portions of the world are visible (high-altitude / whole-map views).

---

## Renderer Settings

| Setting | Value | Rationale |
|---------|-------|-----------|
| `antialias` | `true` | Native MSAA for smooth edges |
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
