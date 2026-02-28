import {
  WEATHER_CONFIGS,
  nextWeatherState,
  randomDuration,
  lerpWeatherConfig,
  generateLightningPath,
  type WeatherState,
} from "@/lib/weatherSystem";

// ─── WEATHER_CONFIGS ──────────────────────────────────────────────────────────

describe("WEATHER_CONFIGS", () => {
  const STATES: WeatherState[] = ["sunny", "cloudy", "rainy", "stormy", "clearing"];

  it("defines all five weather states", () => {
    STATES.forEach((s) => {
      expect(WEATHER_CONFIGS[s]).toBeDefined();
    });
  });

  it("has valid duration ranges (min <= max)", () => {
    STATES.forEach((s) => {
      const cfg = WEATHER_CONFIGS[s];
      expect(cfg.minDuration).toBeGreaterThan(0);
      expect(cfg.maxDuration).toBeGreaterThanOrEqual(cfg.minDuration);
    });
  });

  it("has rain intensity in 0–1 range", () => {
    STATES.forEach((s) => {
      const { rainIntensity } = WEATHER_CONFIGS[s];
      expect(rainIntensity).toBeGreaterThanOrEqual(0);
      expect(rainIntensity).toBeLessThanOrEqual(1);
    });
  });

  it("has cloud darkness in 0–1 range", () => {
    STATES.forEach((s) => {
      const { cloudDarkness } = WEATHER_CONFIGS[s];
      expect(cloudDarkness).toBeGreaterThanOrEqual(0);
      expect(cloudDarkness).toBeLessThanOrEqual(1);
    });
  });

  it("sunny state has no rain", () => {
    expect(WEATHER_CONFIGS.sunny.rainIntensity).toBe(0);
  });

  it("stormy state has maximum rain intensity", () => {
    expect(WEATHER_CONFIGS.stormy.rainIntensity).toBe(1.0);
  });

  it("stormy state has lightning (positive interval)", () => {
    expect(WEATHER_CONFIGS.stormy.lightningInterval).toBeGreaterThan(0);
  });

  it("sunny state has no lightning", () => {
    expect(WEATHER_CONFIGS.sunny.lightningInterval).toBe(0);
  });

  it("stormy has highest fog density", () => {
    STATES.filter((s) => s !== "stormy").forEach((s) => {
      expect(WEATHER_CONFIGS.stormy.fogDensity).toBeGreaterThanOrEqual(
        WEATHER_CONFIGS[s].fogDensity
      );
    });
  });

  it("all states have non-empty labels", () => {
    STATES.forEach((s) => {
      expect(WEATHER_CONFIGS[s].label.length).toBeGreaterThan(0);
    });
  });
});

// ─── nextWeatherState ─────────────────────────────────────────────────────────

describe("nextWeatherState", () => {
  const VALID_STATES = new Set<WeatherState>([
    "sunny", "cloudy", "rainy", "stormy", "clearing",
  ]);

  it("always returns a valid state", () => {
    const all: WeatherState[] = ["sunny", "cloudy", "rainy", "stormy", "clearing"];
    all.forEach((s) => {
      const next = nextWeatherState(s);
      expect(VALID_STATES.has(next)).toBe(true);
    });
  });

  it("sunny never transitions directly to stormy or clearing", () => {
    // Run many times to check probabilistic behaviour
    for (let i = 0; i < 200; i++) {
      const next = nextWeatherState("sunny");
      expect(next).not.toBe("stormy");
      expect(next).not.toBe("clearing");
      expect(next).not.toBe("rainy");
    }
  });

  it("stormy never transitions directly to sunny", () => {
    for (let i = 0; i < 200; i++) {
      const next = nextWeatherState("stormy");
      expect(next).not.toBe("sunny");
    }
  });

  it("clearing never transitions to stormy or rainy", () => {
    for (let i = 0; i < 200; i++) {
      const next = nextWeatherState("clearing");
      expect(next).not.toBe("stormy");
      expect(next).not.toBe("rainy");
    }
  });
});

// ─── randomDuration ───────────────────────────────────────────────────────────

describe("randomDuration", () => {
  const STATES: WeatherState[] = ["sunny", "cloudy", "rainy", "stormy", "clearing"];

  it("always returns a value within the config bounds", () => {
    STATES.forEach((s) => {
      const cfg = WEATHER_CONFIGS[s];
      for (let i = 0; i < 30; i++) {
        const dur = randomDuration(s);
        expect(dur).toBeGreaterThanOrEqual(cfg.minDuration);
        expect(dur).toBeLessThanOrEqual(cfg.maxDuration);
      }
    });
  });
});

// ─── lerpWeatherConfig ────────────────────────────────────────────────────────

describe("lerpWeatherConfig", () => {
  const sunny = WEATHER_CONFIGS.sunny;
  const stormy = WEATHER_CONFIGS.stormy;

  it("returns the first config at t=0", () => {
    const result = lerpWeatherConfig(sunny, stormy, 0);
    expect(result.rainIntensity).toBeCloseTo(sunny.rainIntensity);
    expect(result.fogDensity).toBeCloseTo(sunny.fogDensity);
    expect(result.ambientMult).toBeCloseTo(sunny.ambientMult);
  });

  it("returns the second config at t=1", () => {
    const result = lerpWeatherConfig(sunny, stormy, 1);
    expect(result.rainIntensity).toBeCloseTo(stormy.rainIntensity);
    expect(result.fogDensity).toBeCloseTo(stormy.fogDensity);
    expect(result.ambientMult).toBeCloseTo(stormy.ambientMult);
  });

  it("interpolates midpoint at t=0.5", () => {
    const result = lerpWeatherConfig(sunny, stormy, 0.5);
    expect(result.rainIntensity).toBeCloseTo(
      (sunny.rainIntensity + stormy.rainIntensity) / 2,
      5
    );
    expect(result.fogDensity).toBeCloseTo(
      (sunny.fogDensity + stormy.fogDensity) / 2,
      5
    );
  });

  it("uses second label when t >= 0.5", () => {
    const result = lerpWeatherConfig(sunny, stormy, 0.5);
    expect(result.label).toBe(stormy.label);
  });

  it("uses first label when t < 0.5", () => {
    const result = lerpWeatherConfig(sunny, stormy, 0.49);
    expect(result.label).toBe(sunny.label);
  });
});

// ─── generateLightningPath ────────────────────────────────────────────────────

describe("generateLightningPath", () => {
  it("returns a Float32Array", () => {
    const path = generateLightningPath(0, 0, 100, 0);
    expect(path).toBeInstanceOf(Float32Array);
  });

  it("has length that is a multiple of 3 (xyz triplets)", () => {
    const path = generateLightningPath(10, -5, 80, 2);
    expect(path.length % 3).toBe(0);
  });

  it("has at least 12 segments (>= 13 points, >= 39 floats)", () => {
    for (let i = 0; i < 10; i++) {
      const path = generateLightningPath(0, 0, 100, 0);
      // 12 segments minimum → 13 points → 39 floats
      expect(path.length).toBeGreaterThanOrEqual(39);
    }
  });

  it("first point has the supplied startX and startZ", () => {
    const path = generateLightningPath(42, -17, 100, 0);
    expect(path[0]).toBeCloseTo(42);
    // path[1] is y (skyHeight)
    expect(path[2]).toBeCloseTo(-17);
  });

  it("last point Y is close to groundY", () => {
    const groundY = 5;
    const path = generateLightningPath(0, 0, 100, groundY);
    const lastY = path[path.length - 2]; // index is (n*3+1) for last point
    expect(lastY).toBeCloseTo(groundY, 1);
  });

  it("first point Y equals skyHeight", () => {
    const skyHeight = 95;
    const path = generateLightningPath(0, 0, skyHeight, 0);
    expect(path[1]).toBeCloseTo(skyHeight);
  });
});
