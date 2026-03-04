# Terrain System

## Overview

The terrain is a procedurally generated 267×267-unit heightmap rendered with a custom GLSL `ShaderMaterial`. It combines large-scale biome colour zoning, multi-scale noise variation, and (as of March 2026) per-biome surface textures applied via **triplanar projection**.

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `lib/terrainUtils.ts` | Height generation (noise, biome sampling, height grid) |
| `lib/terrainTextures.ts` | Procedural canvas texture generation for biomes |
| `components/Game3D.tsx` | Three.js scene setup: terrain mesh, `ShaderMaterial`, grass, water |
| `__tests__/terrainTextures.test.ts` | Unit tests for texture generator |

### Constants (`terrainUtils.ts`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `WORLD_SIZE` | 267 | Side length of the terrain in world units |
| `TERRAIN_SEGMENTS` | 120 | Vertex resolution per axis of the PlaneGeometry |
| `WATER_LEVEL` | -0.5 | Y threshold below which terrain is considered water |

---

## Terrain Mesh

A `THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)` is created, rotated −90° on X, then each vertex Y position is set by `getTerrainHeight(x, z)`.  Vertex normals are recomputed after deformation.

---

## Terrain Shader

The terrain uses `THREE.ShaderMaterial` with a fully custom vertex + fragment shader, so no MeshStandard/Phong lighting model is used.

### Uniforms

| Uniform | Type | Purpose |
|---------|------|---------|
| `uSunDir` | `vec3` | Normalised sun direction |
| `uSunColor` | `vec3` | Sun tint (warm yellow-white) |
| `uSunIntensity` | `float` | 0–1 intensity multiplier |
| `uAmbientColor` | `vec3` | Sky ambient fill colour |
| `uTexGrass` | `sampler2D` | Procedural grass surface texture |
| `uTexRock` | `sampler2D` | Procedural rock/stone surface texture |
| `uTexSand` | `sampler2D` | Procedural sand surface texture |
| `uTexSnow` | `sampler2D` | Procedural snow surface texture |
| `uTexDirt` | `sampler2D` | Procedural dirt/soil surface texture |
| `uTexScale` | `float` | Tiling frequency (default `1/8` → 8-unit tile) |
| `uTexStrength` | `float` | Texture blend strength 0–1 (default 0.40) |

### Fragment Shader Stages

1. **Multi-scale FBM noise** – `macro` (~40 u), `meso` (~10 u), `micro` (~2 u), `crack` patterns.
2. **Biome classification** – height-wobbled by macro/meso noise to produce organic borders.  Biomes: deep water → shallow water → sand → dry grass → bright grass → mid/dark grass → rock → snow.
3. **Slope rock overlay** – `smoothstep(0.38, 0.65, slope)` on the dot(normal, up) to push cliffs towards rock colour.
4. **Triplanar texture sampling** – each biome texture is sampled in three planes (XZ, XY, ZY) and blended by the surface normal to avoid stretching on vertical cliffs.  Weights for each biome are tracked during the biome pass and normalised before sampling.  A coarse second sample (4× lower frequency) is mixed in at 35 % for depth.
5. **Texture detail factor** – `col *= 1 + strength*(luminance(detail) - 0.5)*2`.  This is a multiplicative approach that preserves the average biome brightness while adding ±contrast.
6. **Micro-shading** – `col *= 0.90 + micro * 0.18` for subtle per-pixel brightness jitter.
7. **Lambert lighting** – `col * (ambient + sun * diffuse * intensity)`.

---

## Procedural Textures (`lib/terrainTextures.ts`)

### `generateTerrainTextureData(type, size)`

Pure function (no DOM dependency) that returns a `Uint8ClampedArray` of `size×size×4` RGBA pixels.

**Algorithm**:
1. Seeded LCG RNG initialised per biome type → deterministic, no external randomness.
2. 2D value noise grid (bilinear-interpolated) sampled at 8 frequency bands.
3. Fractal Brownian Motion (4 octaves) stacked at three spatial frequencies.
4. Per-biome pixel formula:

| Biome | Key visual feature |
|-------|--------------------|
| `grass` | Bright green, blade-like high-freq detail |
| `rock` | Gray-brown with crack-dark lines |
| `sand` | Warm beige with sin-wave ripple |
| `snow` | Bright white, blue crystal sparkle |
| `dirt` | Dark loamy brown, earthy grain |

### `createTerrainTexture(type, size)` (browser only)

Wraps the above in a `THREE.CanvasTexture` with `RepeatWrapping` and mipmap generation.

---

## Grass Layer

Grass is a separate `THREE.Points` geometry with per-blade procedural colour (5 archetypes: straw, rust, olive, bright green, lush dark green, blue-green).  It has its own `ShaderMaterial` with wind animation, subsurface scattering, and camera-based LOD fade.  Not part of the terrain shader.

---

## Runtime Updates

Each animation frame updates terrain shader uniforms to match the day/night cycle:

```ts
terrainMatRef.current.uniforms.uSunDir.value.copy(sunPos).normalize();
terrainMatRef.current.uniforms.uSunIntensity.value = getSunIntensity(dayFraction);
// ambient colour shifts between day-blue and night-purple
```

---

## Testing

`__tests__/terrainTextures.test.ts` covers:
- Output format (type, length, alpha)
- All channels in [0, 255]
- Biome colour characteristics (green dominant for grass, bright for snow, etc.)
- Determinism (same seed → same pixels)
- Multiple texture sizes
- All five biome types produce distinct data
