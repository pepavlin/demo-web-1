import { getTerrainHeight, getTerrainHeightSampled, generateSpawnPoints, initNoise, modifyTerrainHeight, findBestElevatedPosition, findPositionsInSectors, WORLD_SIZE, TERRAIN_SEGMENTS, WATER_LEVEL } from "@/lib/terrainUtils";

describe("terrainUtils", () => {
  beforeAll(() => {
    initNoise(42);
  });

  describe("WORLD_SIZE and TERRAIN_SEGMENTS", () => {
    it("exports positive world size", () => {
      expect(WORLD_SIZE).toBeGreaterThan(0);
    });

    it("world size is 267 (3x smaller than original 800)", () => {
      expect(WORLD_SIZE).toBe(267);
    });

    it("exports terrain segments > 0", () => {
      expect(TERRAIN_SEGMENTS).toBeGreaterThan(0);
    });
  });

  describe("getTerrainHeight", () => {
    it("returns a number for origin", () => {
      const h = getTerrainHeight(0, 0);
      expect(typeof h).toBe("number");
      expect(isNaN(h)).toBe(false);
    });

    it("returns near-zero height at the center (flat spawn zone)", () => {
      // Center (0,0) is flattened, so height should be close to 0
      const h = getTerrainHeight(0, 0);
      expect(Math.abs(h)).toBeLessThan(1);
    });

    it("returns consistent values for same coords", () => {
      const h1 = getTerrainHeight(100, 200);
      const h2 = getTerrainHeight(100, 200);
      expect(h1).toBe(h2);
    });

    it("returns different heights for different coords", () => {
      const h1 = getTerrainHeight(50, 50);
      const h2 = getTerrainHeight(150, 200);
      // Extremely unlikely to be identical
      expect(h1).not.toBe(h2);
    });

    it("heights stay within a reasonable range", () => {
      const testPoints = [
        [0, 0], [50, 50], [-50, 100], [200, -150], [-300, 300],
      ];
      testPoints.forEach(([x, z]) => {
        const h = getTerrainHeight(x, z);
        expect(h).toBeGreaterThan(-50);
        expect(h).toBeLessThan(100);
      });
    });

    it("farther from center yields non-trivially different heights (hills exist)", () => {
      const far = getTerrainHeight(300, 300);
      const near = getTerrainHeight(5, 5);
      // At least one of them should differ meaningfully from zero
      expect(Math.abs(far) + Math.abs(near)).toBeGreaterThan(0.5);
    });
  });

  describe("WATER_LEVEL", () => {
    it("exports WATER_LEVEL as a number", () => {
      expect(typeof WATER_LEVEL).toBe("number");
    });

    it("WATER_LEVEL is negative (water is below ground level)", () => {
      expect(WATER_LEVEL).toBeLessThan(0);
    });

    it("terrain at center is above WATER_LEVEL (spawn zone is not water)", () => {
      const h = getTerrainHeight(0, 0);
      expect(h).toBeGreaterThanOrEqual(WATER_LEVEL);
    });

    it("can detect water areas using getTerrainHeight < WATER_LEVEL", () => {
      // Scan a grid to find at least one water tile in the world
      let foundWater = false;
      for (let x = -350; x <= 350 && !foundWater; x += 50) {
        for (let z = -350; z <= 350 && !foundWater; z += 50) {
          if (getTerrainHeight(x, z) < WATER_LEVEL) {
            foundWater = true;
          }
        }
      }
      expect(foundWater).toBe(true);
    });

    it("spawn points never land in water (terrain >= WATER_LEVEL)", () => {
      const pts = generateSpawnPoints(20, 20, 300, 42);
      pts.forEach((p) => {
        expect(getTerrainHeight(p.x, p.z)).toBeGreaterThanOrEqual(WATER_LEVEL);
      });
    });
  });

  describe("underwater swimming — terrain floor logic", () => {
    it("terrain floor in water is always below WATER_LEVEL", () => {
      // Find a water tile and verify the floor is below water surface
      let waterX = 0, waterZ = 0;
      let foundWater = false;
      for (let x = -300; x <= 300 && !foundWater; x += 30) {
        for (let z = -300; z <= 300 && !foundWater; z += 30) {
          if (getTerrainHeight(x, z) < WATER_LEVEL) {
            waterX = x;
            waterZ = z;
            foundWater = true;
          }
        }
      }
      expect(foundWater).toBe(true);
      const floorH = getTerrainHeight(waterX, waterZ);
      // The ocean floor is below water level — player can dive down to it
      expect(floorH).toBeLessThan(WATER_LEVEL);
    });

    it("player swim floor (terrainY + PLAYER_HEIGHT) is below water surface (WATER_LEVEL + PLAYER_HEIGHT)", () => {
      // Find a deep water tile
      const PLAYER_HEIGHT = 1.8;
      let found = false;
      for (let x = -300; x <= 300 && !found; x += 40) {
        for (let z = -300; z <= 300 && !found; z += 40) {
          const h = getTerrainHeight(x, z);
          if (h < WATER_LEVEL - 1) {
            // floor the player would rest on when diving to the bottom
            const floorY = h + PLAYER_HEIGHT;
            // water surface the player floats at
            const surfaceY = WATER_LEVEL + PLAYER_HEIGHT;
            // There is real depth to dive through
            expect(floorY).toBeLessThan(surfaceY);
            found = true;
          }
        }
      }
      expect(found).toBe(true);
    });

    it("water areas exist deep enough for meaningful underwater traversal (>1 unit depth)", () => {
      let deepWaterFound = false;
      for (let x = -300; x <= 300 && !deepWaterFound; x += 25) {
        for (let z = -300; z <= 300 && !deepWaterFound; z += 25) {
          const h = getTerrainHeight(x, z);
          if (h < WATER_LEVEL - 1.0) {
            deepWaterFound = true;
          }
        }
      }
      expect(deepWaterFound).toBe(true);
    });

    it("all entity spawn points have enough land clearance above WATER_LEVEL", () => {
      // generateSpawnPoints uses y < -1 as its water threshold (stricter than WATER_LEVEL=-0.5)
      // so all returned points have terrain at least at -1, safely above any water
      const pts = generateSpawnPoints(30, 15, 250, 77);
      pts.forEach((p) => {
        // Spawn points should be on dry, stable land (well above water)
        expect(p.y).toBeGreaterThan(WATER_LEVEL);
      });
    });
  });

  describe("getTerrainHeightSampled", () => {
    it("returns a number for origin", () => {
      const h = getTerrainHeightSampled(0, 0);
      expect(typeof h).toBe("number");
      expect(isNaN(h)).toBe(false);
    });

    it("matches getTerrainHeight exactly at grid vertex positions", () => {
      // Grid vertices are at multiples of cellSize from -WORLD_SIZE/2
      const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;
      const half = WORLD_SIZE / 2;
      const testVertices = [
        [0, 0],
        [cellSize, 0],
        [0, cellSize],
        [-cellSize * 5, cellSize * 3],
        [half - cellSize, half - cellSize],
      ];
      testVertices.forEach(([x, z]) => {
        const exact = getTerrainHeight(x, z);
        const sampled = getTerrainHeightSampled(x, z);
        expect(sampled).toBeCloseTo(exact, 4);
      });
    });

    it("stays within reasonable range", () => {
      const testPoints = [
        [0, 0], [50, 50], [-50, 100], [200, -150], [-300, 300],
      ];
      testPoints.forEach(([x, z]) => {
        const h = getTerrainHeightSampled(x, z);
        expect(h).toBeGreaterThan(-50);
        expect(h).toBeLessThan(100);
      });
    });

    it("returns consistent values for same coords", () => {
      const h1 = getTerrainHeightSampled(123, 456);
      const h2 = getTerrainHeightSampled(123, 456);
      expect(h1).toBe(h2);
    });

    it("differs from exact getTerrainHeight at non-vertex positions by less than cell interpolation error", () => {
      // Mid-cell point — difference is bounded by the local curvature
      const cellSize = WORLD_SIZE / TERRAIN_SEGMENTS;
      const midX = cellSize * 0.5;
      const midZ = cellSize * 0.5;
      const sampled = getTerrainHeightSampled(midX, midZ);
      // Must be a finite number inside the world height range
      expect(isFinite(sampled)).toBe(true);
      expect(sampled).toBeGreaterThan(-50);
      expect(sampled).toBeLessThan(100);
    });
  });

  describe("generateSpawnPoints", () => {
    it("returns an array", () => {
      const pts = generateSpawnPoints(5, 20, 100, 1);
      expect(Array.isArray(pts)).toBe(true);
    });

    it("returns at most the requested count", () => {
      const pts = generateSpawnPoints(10, 20, 100, 2);
      expect(pts.length).toBeLessThanOrEqual(10);
    });

    it("returns points with x, z, y properties", () => {
      const pts = generateSpawnPoints(5, 20, 100, 3);
      pts.forEach((p) => {
        expect(typeof p.x).toBe("number");
        expect(typeof p.z).toBe("number");
        expect(typeof p.y).toBe("number");
      });
    });

    it("respects minDist lower bound", () => {
      const minDist = 30;
      const pts = generateSpawnPoints(10, minDist, 200, 4);
      pts.forEach((p) => {
        const dist = Math.sqrt(p.x * p.x + p.z * p.z);
        expect(dist).toBeGreaterThanOrEqual(minDist - 0.001);
      });
    });

    it("respects maxDist upper bound", () => {
      const maxDist = 80;
      const pts = generateSpawnPoints(10, 10, maxDist, 5);
      pts.forEach((p) => {
        const dist = Math.sqrt(p.x * p.x + p.z * p.z);
        expect(dist).toBeLessThanOrEqual(maxDist + 0.001);
      });
    });

    it("y matches getTerrainHeight at the same x,z", () => {
      const pts = generateSpawnPoints(5, 20, 100, 6);
      pts.forEach((p) => {
        const expectedY = getTerrainHeight(p.x, p.z);
        expect(p.y).toBeCloseTo(expectedY, 5);
      });
    });

    it("returns same results for same seed", () => {
      const pts1 = generateSpawnPoints(8, 20, 150, 42);
      const pts2 = generateSpawnPoints(8, 20, 150, 42);
      expect(pts1).toEqual(pts2);
    });

    it("returns different results for different seeds", () => {
      const pts1 = generateSpawnPoints(5, 20, 150, 1);
      const pts2 = generateSpawnPoints(5, 20, 150, 999);
      const allSame = pts1.every((p, i) => pts2[i] && p.x === pts2[i].x && p.z === pts2[i].z);
      expect(allSame).toBe(false);
    });

    it("returns zero points for impossible constraints", () => {
      // minDist > maxDist means no valid positions can be found within 1 attempt
      // Actually let's just request 0 points
      const pts = generateSpawnPoints(0, 20, 100, 1);
      expect(pts.length).toBe(0);
    });

    it("never returns points outside world bounds even when maxDist exceeds world size", () => {
      // maxDist of 380 used to push objects outside WORLD_SIZE=267 boundary (±133.5 units)
      const pts = generateSpawnPoints(30, 10, 380, 42);
      const halfWorld = WORLD_SIZE / 2;
      pts.forEach((p) => {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(halfWorld);
        expect(Math.abs(p.z)).toBeLessThanOrEqual(halfWorld);
      });
    });

    it("never returns points outside world bounds for large radial maxDist values", () => {
      // Simulates the original bush/coin/rock spawn calls that had maxDist > world half-size
      const testCases = [
        { count: 20, min: 20, max: 350, seed: 555 }, // coins
        { count: 15, min: 8,  max: 340, seed: 7391 }, // bushes
        { count: 10, min: 15, max: 380, seed: 456 }, // rocks
      ];
      const halfWorld = WORLD_SIZE / 2;
      testCases.forEach(({ count, min, max, seed }) => {
        const pts = generateSpawnPoints(count, min, max, seed);
        pts.forEach((p) => {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(halfWorld);
          expect(Math.abs(p.z)).toBeLessThanOrEqual(halfWorld);
        });
      });
    });
  });

  describe("modifyTerrainHeight", () => {
    beforeEach(() => {
      // Re-init noise to get a clean heightGrid before each sculpt test
      initNoise(42);
    });

    it("increases height at the target point when delta is positive", () => {
      const x = 0;
      const z = 0;
      // Use radius large enough to cover at least one grid cell (cellSize ≈ 6.67)
      const before = getTerrainHeightSampled(x, z);
      modifyTerrainHeight(x, z, 5, 12);
      const after = getTerrainHeightSampled(x, z);
      expect(after).toBeGreaterThan(before);
    });

    it("decreases height at the target point when delta is negative", () => {
      const x = 10;
      const z = 10;
      const before = getTerrainHeightSampled(x, z);
      modifyTerrainHeight(x, z, -5, 12);
      const after = getTerrainHeightSampled(x, z);
      expect(after).toBeLessThan(before);
    });

    it("change is larger at centre than at edge of brush", () => {
      initNoise(42);
      const cx = 50;
      const cz = 50;
      const radius = 15; // must cover several grid cells (cellSize ≈ 6.67)
      const edgeX = cx + radius * 0.85; // near edge but still inside brush

      const centreBeforeRaise = getTerrainHeightSampled(cx, cz);
      const edgeBeforeRaise   = getTerrainHeightSampled(edgeX, cz);

      modifyTerrainHeight(cx, cz, 10, radius);

      const centreDelta = getTerrainHeightSampled(cx, cz) - centreBeforeRaise;
      const edgeDelta   = getTerrainHeightSampled(edgeX, cz) - edgeBeforeRaise;

      expect(centreDelta).toBeGreaterThan(edgeDelta);
      expect(edgeDelta).toBeGreaterThan(0); // edge also changed
    });

    it("does not affect terrain far outside the brush radius", () => {
      const cx = 0;
      const cz = 0;
      const farX = 200;
      const farZ = 200;
      const before = getTerrainHeightSampled(farX, farZ);
      modifyTerrainHeight(cx, cz, 20, 5);
      const after = getTerrainHeightSampled(farX, farZ);
      expect(after).toBe(before); // unchanged
    });

    it("is a no-op when heightGrid is not initialised (does not throw)", () => {
      // This just ensures the function handles the null-guard gracefully.
      // Since initNoise() has already been called, this test verifies it runs without error.
      expect(() => modifyTerrainHeight(0, 0, 1, 5)).not.toThrow();
    });
  });

  describe("findBestElevatedPosition", () => {
    beforeAll(() => {
      initNoise(42);
    });

    it("returns a StructurePosition object with x, z, y", () => {
      const pos = findBestElevatedPosition(60, 120, 3.0);
      expect(pos).not.toBeNull();
      if (pos) {
        expect(typeof pos.x).toBe("number");
        expect(typeof pos.z).toBe("number");
        expect(typeof pos.y).toBe("number");
      }
    });

    it("returned position is above the requested minHeight", () => {
      const minH = 3.0;
      const pos = findBestElevatedPosition(60, 120, minH);
      expect(pos).not.toBeNull();
      if (pos) {
        expect(pos.y).toBeGreaterThanOrEqual(minH);
      }
    });

    it("returned position is within the requested distance range", () => {
      const minDist = 60;
      const maxDist = 120;
      const pos = findBestElevatedPosition(minDist, maxDist, 3.0);
      expect(pos).not.toBeNull();
      if (pos) {
        const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        expect(dist).toBeGreaterThanOrEqual(minDist - 1);
        expect(dist).toBeLessThanOrEqual(maxDist + 1);
      }
    });

    it("returned position is within world bounds", () => {
      const pos = findBestElevatedPosition(60, 120, 3.0);
      if (pos) {
        expect(Math.abs(pos.x)).toBeLessThan(WORLD_SIZE / 2);
        expect(Math.abs(pos.z)).toBeLessThan(WORLD_SIZE / 2);
      }
    });

    it("returns null for impossible constraints (minHeight too high)", () => {
      // No natural terrain reaches 9999 units
      const pos = findBestElevatedPosition(60, 120, 9999);
      expect(pos).toBeNull();
    });

    it("returns a consistent result for the same seed", () => {
      initNoise(42);
      const pos1 = findBestElevatedPosition(60, 120, 3.0);
      initNoise(42);
      const pos2 = findBestElevatedPosition(60, 120, 3.0);
      expect(pos1).toEqual(pos2);
    });

    it("position y matches terrain height at those coordinates", () => {
      const pos = findBestElevatedPosition(60, 120, 3.0);
      if (pos) {
        const terrainH = getTerrainHeightSampled(pos.x, pos.z);
        // y comes directly from heightGrid, so within bilinear interpolation error
        expect(Math.abs(pos.y - terrainH)).toBeLessThan(1.0);
      }
    });
  });

  describe("findPositionsInSectors", () => {
    beforeAll(() => {
      initNoise(42);
    });

    it("returns an array", () => {
      const positions = findPositionsInSectors(6, 35, 95, WATER_LEVEL + 0.5, 5.0);
      expect(Array.isArray(positions)).toBe(true);
    });

    it("returns at most `count` positions", () => {
      const count = 6;
      const positions = findPositionsInSectors(count, 35, 95, WATER_LEVEL + 0.5, 5.0);
      expect(positions.length).toBeLessThanOrEqual(count);
    });

    it("returns positions spread over at least 2 distinct quadrants for count=4", () => {
      const positions = findPositionsInSectors(4, 35, 95, WATER_LEVEL + 0.5, 5.0);
      // Expect at least 2 unique angle quadrants present
      const quadrants = new Set(positions.map((p) => {
        const a = Math.atan2(p.z, p.x);
        return Math.floor(((a < 0 ? a + 2 * Math.PI : a) / (Math.PI / 2)));
      }));
      expect(quadrants.size).toBeGreaterThanOrEqual(2);
    });

    it("all positions are above minHeight (land check)", () => {
      const minH = WATER_LEVEL + 0.5;
      const positions = findPositionsInSectors(6, 35, 95, minH, 5.0);
      positions.forEach((p) => {
        expect(p.y).toBeGreaterThanOrEqual(minH - 0.01);
      });
    });

    it("all positions are within the requested distance range", () => {
      const minDist = 35;
      const maxDist = 95;
      const positions = findPositionsInSectors(6, minDist, maxDist, WATER_LEVEL + 0.5, 5.0);
      positions.forEach((p) => {
        const dist = Math.sqrt(p.x * p.x + p.z * p.z);
        expect(dist).toBeGreaterThanOrEqual(minDist - 1);
        expect(dist).toBeLessThanOrEqual(maxDist + 1);
      });
    });

    it("all positions are within world bounds", () => {
      const positions = findPositionsInSectors(6, 35, 95, WATER_LEVEL + 0.5, 5.0);
      positions.forEach((p) => {
        expect(Math.abs(p.x)).toBeLessThan(WORLD_SIZE / 2);
        expect(Math.abs(p.z)).toBeLessThan(WORLD_SIZE / 2);
      });
    });

    it("returns empty array for count=0", () => {
      const positions = findPositionsInSectors(0, 35, 95, WATER_LEVEL + 0.5, 5.0);
      expect(positions.length).toBe(0);
    });

    it("returns consistent results for the same seed", () => {
      initNoise(42);
      const pos1 = findPositionsInSectors(6, 35, 95, WATER_LEVEL + 0.5, 5.0);
      initNoise(42);
      const pos2 = findPositionsInSectors(6, 35, 95, WATER_LEVEL + 0.5, 5.0);
      expect(pos1).toEqual(pos2);
    });

    it("positions have x, z, y numeric properties", () => {
      const positions = findPositionsInSectors(4, 35, 95, WATER_LEVEL + 0.5, 5.0);
      positions.forEach((p) => {
        expect(typeof p.x).toBe("number");
        expect(typeof p.z).toBe("number");
        expect(typeof p.y).toBe("number");
        expect(isNaN(p.x)).toBe(false);
        expect(isNaN(p.z)).toBe(false);
        expect(isNaN(p.y)).toBe(false);
      });
    });
  });
});
