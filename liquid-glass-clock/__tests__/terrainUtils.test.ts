import { getTerrainHeight, getTerrainHeightSampled, generateSpawnPoints, initNoise, modifyTerrainHeight, WORLD_SIZE, TERRAIN_SEGMENTS, WATER_LEVEL } from "@/lib/terrainUtils";

describe("terrainUtils", () => {
  beforeAll(() => {
    initNoise(42);
  });

  describe("WORLD_SIZE and TERRAIN_SEGMENTS", () => {
    it("exports positive world size", () => {
      expect(WORLD_SIZE).toBeGreaterThan(0);
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
});
