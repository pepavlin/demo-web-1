# Project Rules

## Workspace Rules

- Always `cd` into the repository directory (`demo-web-1/liquid-glass-clock`) before doing any work.
- NEVER run `git init`. The repository is already set up.
- Make all file changes inside the repository directory.
- Commit changes with `git commit` inside the repository. Do NOT push.
- Every temp docs created during work go into `/tmp` folder, which is kept in `.gitignore`.

## Task Focus

**All tasks that come into this project relate primarily to the 3D scene and 3D world inside `Game3D.tsx`, not the landing page or UI chrome.**

When implementing new features, always think in terms of:
- The Three.js 3D world (terrain, sky, water, entities)
- Interactive 3D objects (vehicles, animals, buildings, items)
- Game mechanics (physics, combat, exploration, vehicles)
- Scene systems (weather, day/night, lighting, fog)

Do NOT focus on:
- The landing/welcome page (`app/page.tsx` clock/time display)
- Generic UI theming or layout not tied to the 3D world
- Features unrelated to the 3D scene experience

## Code Architecture

- Keep all 3D entity types in `lib/gameTypes.ts`
- Keep all 3D mesh builders in `lib/meshBuilders.ts`
- Keep all scene logic in `components/Game3D.tsx`
- Keep system logic (weather, terrain, harbor, building, etc.) in `lib/` modules
- Document every major system in a dedicated file in `docs/`
- All code changes must be covered with tests in `__tests__/`

## Quality Rules

- Always run build and verify it passes before finalizing
- Always update `docs/` when adding or significantly changing a system
- Prioritize scalable, universal, and consistent architecture
- Invest time in design — avoid rushing to just fulfill the task
- Keep `README.md` up to date when adding user-visible features

## 3D World Systems Inventory

| System | Files |
|--------|-------|
| Terrain | `lib/terrainUtils.ts`, `lib/terrainTextures.ts` |
| Weather | `lib/weatherSystem.ts` |
| Harbor / Sailboats | `lib/harborSystem.ts` |
| Buildings / Sculpting | `lib/buildingSystem.ts`, `lib/buildingTypes.ts` |
| Sound | `lib/soundManager.ts` |
| Mesh Builders | `lib/meshBuilders.ts` |
| Game Types | `lib/gameTypes.ts` |
| Main Scene | `components/Game3D.tsx` |
| Multiplayer | `hooks/useMultiplayer.ts` |
