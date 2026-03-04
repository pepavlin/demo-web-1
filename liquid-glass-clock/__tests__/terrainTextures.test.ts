import {
  generateTerrainTextureData,
  TerrainTextureType,
} from "@/lib/terrainTextures";

const ALL_TYPES: TerrainTextureType[] = ["grass", "rock", "sand", "snow", "dirt"];

describe("generateTerrainTextureData", () => {
  const SIZE = 64; // small size for fast tests

  describe("output format", () => {
    it("returns a Uint8ClampedArray", () => {
      const data = generateTerrainTextureData("grass", SIZE);
      expect(data).toBeInstanceOf(Uint8ClampedArray);
    });

    it.each(ALL_TYPES)("returns size*size*4 bytes for %s", (type) => {
      const data = generateTerrainTextureData(type, SIZE);
      expect(data.length).toBe(SIZE * SIZE * 4);
    });

    it.each(ALL_TYPES)("all alpha values are 255 for %s", (type) => {
      const data = generateTerrainTextureData(type, SIZE);
      for (let i = 3; i < data.length; i += 4) {
        expect(data[i]).toBe(255);
      }
    });
  });

  describe("pixel value ranges", () => {
    it.each(ALL_TYPES)("all RGB channels are in [0, 255] for %s", (type) => {
      const data = generateTerrainTextureData(type, SIZE);
      for (let i = 0; i < data.length; i += 4) {
        expect(data[i + 0]).toBeGreaterThanOrEqual(0);
        expect(data[i + 0]).toBeLessThanOrEqual(255);
        expect(data[i + 1]).toBeGreaterThanOrEqual(0);
        expect(data[i + 1]).toBeLessThanOrEqual(255);
        expect(data[i + 2]).toBeGreaterThanOrEqual(0);
        expect(data[i + 2]).toBeLessThanOrEqual(255);
      }
    });
  });

  describe("biome colour characteristics", () => {
    const avgChannel = (
      data: Uint8ClampedArray,
      channel: 0 | 1 | 2
    ): number => {
      let sum = 0;
      for (let i = channel; i < data.length; i += 4) sum += data[i];
      return sum / (data.length / 4);
    };

    it("grass texture is dominantly green (G > R, G > B)", () => {
      const data = generateTerrainTextureData("grass", SIZE);
      const r = avgChannel(data, 0);
      const g = avgChannel(data, 1);
      const b = avgChannel(data, 2);
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    });

    it("sand texture is warm (R > B, G > B)", () => {
      const data = generateTerrainTextureData("sand", SIZE);
      const r = avgChannel(data, 0);
      const g = avgChannel(data, 1);
      const b = avgChannel(data, 2);
      expect(r).toBeGreaterThan(b);
      expect(g).toBeGreaterThan(b);
    });

    it("snow texture is bright (avg luminance > 180)", () => {
      const data = generateTerrainTextureData("snow", SIZE);
      const r = avgChannel(data, 0);
      const g = avgChannel(data, 1);
      const b = avgChannel(data, 2);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      expect(lum).toBeGreaterThan(180);
    });

    it("dirt texture is darker than snow (lower average luminance)", () => {
      const dirtData = generateTerrainTextureData("dirt", SIZE);
      const snowData = generateTerrainTextureData("snow", SIZE);
      const dirtLum =
        0.299 * avgChannel(dirtData, 0) +
        0.587 * avgChannel(dirtData, 1) +
        0.114 * avgChannel(dirtData, 2);
      const snowLum =
        0.299 * avgChannel(snowData, 0) +
        0.587 * avgChannel(snowData, 1) +
        0.114 * avgChannel(snowData, 2);
      expect(dirtLum).toBeLessThan(snowLum);
    });

    it("rock texture has visible variation (std dev > 5 on R channel)", () => {
      const data = generateTerrainTextureData("rock", SIZE);
      const values: number[] = [];
      for (let i = 0; i < data.length; i += 4) values.push(data[i]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
      expect(Math.sqrt(variance)).toBeGreaterThan(5);
    });
  });

  describe("determinism", () => {
    it.each(ALL_TYPES)(
      "produces identical output on repeated calls for %s",
      (type) => {
        const a = generateTerrainTextureData(type, SIZE);
        const b = generateTerrainTextureData(type, SIZE);
        expect(a).toEqual(b);
      }
    );
  });

  describe("texture size variants", () => {
    it("works correctly with size 32", () => {
      const data = generateTerrainTextureData("grass", 32);
      expect(data.length).toBe(32 * 32 * 4);
    });

    it("works correctly with size 128", () => {
      const data = generateTerrainTextureData("rock", 128);
      expect(data.length).toBe(128 * 128 * 4);
    });

    it("produces different output for size 32 vs size 64", () => {
      const small = generateTerrainTextureData("grass", 32);
      const large = generateTerrainTextureData("grass", 64);
      // They have different lengths so they can't be equal
      expect(small.length).not.toBe(large.length);
    });
  });

  describe("type isolation", () => {
    it("grass and rock textures have different pixel data at the same size", () => {
      const grass = generateTerrainTextureData("grass", SIZE);
      const rock = generateTerrainTextureData("rock", SIZE);
      let different = false;
      for (let i = 0; i < grass.length; i++) {
        if (grass[i] !== rock[i]) { different = true; break; }
      }
      expect(different).toBe(true);
    });

    it("all five biome types produce distinct pixel data", () => {
      const results = ALL_TYPES.map((t) =>
        Array.from(generateTerrainTextureData(t, SIZE).slice(0, 64))
      );
      const uniqueKeys = new Set(results.map((r) => JSON.stringify(r)));
      expect(uniqueKeys.size).toBe(ALL_TYPES.length);
    });
  });
});
