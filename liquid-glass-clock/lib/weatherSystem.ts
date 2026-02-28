// ─── Weather System ────────────────────────────────────────────────────────────
// Manages weather state transitions, rain intensity, lightning events,
// and provides utilities for modifying scene lighting/fog/cloud colours.

export type WeatherState = "sunny" | "cloudy" | "rainy" | "stormy" | "clearing";

export interface WeatherConfig {
  /** Minimum seconds before transitioning to a new state */
  minDuration: number;
  /** Maximum seconds before transitioning to a new state */
  maxDuration: number;
  /** 0–1: how many rain drops are visible (0 = none) */
  rainIntensity: number;
  /** 0–1: cloud opacity / coverage level */
  cloudDarkness: number;
  /** Exponential fog density multiplier (base is 0.006) */
  fogDensity: number;
  /** Multiplier on ambient light intensity (1.0 = normal) */
  ambientMult: number;
  /** Multiplier on directional sun intensity */
  sunMult: number;
  /** Seconds between lightning bolts (0 = no lightning) */
  lightningInterval: number;
  /** Label shown to player (Czech) */
  label: string;
}

export const WEATHER_CONFIGS: Record<WeatherState, WeatherConfig> = {
  sunny: {
    minDuration: 60,
    maxDuration: 120,
    rainIntensity: 0,
    cloudDarkness: 0,
    fogDensity: 0.006,
    ambientMult: 1.0,
    sunMult: 1.0,
    lightningInterval: 0,
    label: "☀️ Jasno",
  },
  cloudy: {
    minDuration: 30,
    maxDuration: 70,
    rainIntensity: 0,
    cloudDarkness: 0.45,
    fogDensity: 0.007,
    ambientMult: 0.75,
    sunMult: 0.55,
    lightningInterval: 0,
    label: "☁️ Zataženo",
  },
  rainy: {
    minDuration: 30,
    maxDuration: 60,
    rainIntensity: 0.55,
    cloudDarkness: 0.75,
    fogDensity: 0.009,
    ambientMult: 0.55,
    sunMult: 0.3,
    lightningInterval: 0,
    label: "🌧️ Déšť",
  },
  stormy: {
    minDuration: 20,
    maxDuration: 45,
    rainIntensity: 1.0,
    cloudDarkness: 1.0,
    fogDensity: 0.012,
    ambientMult: 0.35,
    sunMult: 0.1,
    lightningInterval: 8, // lightning every 5–15 seconds on average
    label: "⛈️ Bouřka",
  },
  clearing: {
    minDuration: 15,
    maxDuration: 30,
    rainIntensity: 0.15,
    cloudDarkness: 0.2,
    fogDensity: 0.007,
    ambientMult: 0.85,
    sunMult: 0.75,
    lightningInterval: 0,
    label: "🌤️ Vyčasuje se",
  },
};

/** Probability table: which state can follow a given state */
const TRANSITIONS: Record<WeatherState, WeatherState[]> = {
  sunny:    ["sunny", "cloudy"],
  cloudy:   ["cloudy", "rainy", "sunny"],
  rainy:    ["rainy", "stormy", "clearing"],
  stormy:   ["stormy", "clearing"],
  clearing: ["sunny", "cloudy"],
};

/** Pick a random next weather state from the transition table */
export function nextWeatherState(current: WeatherState): WeatherState {
  const options = TRANSITIONS[current];
  return options[Math.floor(Math.random() * options.length)];
}

/** Generate a random duration for the given weather state */
export function randomDuration(state: WeatherState): number {
  const cfg = WEATHER_CONFIGS[state];
  return cfg.minDuration + Math.random() * (cfg.maxDuration - cfg.minDuration);
}

/** Linearly interpolate two weather configs by factor t (0–1) */
export function lerpWeatherConfig(a: WeatherConfig, b: WeatherConfig, t: number): WeatherConfig {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    minDuration: lerp(a.minDuration, b.minDuration),
    maxDuration: lerp(a.maxDuration, b.maxDuration),
    rainIntensity: lerp(a.rainIntensity, b.rainIntensity),
    cloudDarkness: lerp(a.cloudDarkness, b.cloudDarkness),
    fogDensity: lerp(a.fogDensity, b.fogDensity),
    ambientMult: lerp(a.ambientMult, b.ambientMult),
    sunMult: lerp(a.sunMult, b.sunMult),
    lightningInterval: lerp(a.lightningInterval, b.lightningInterval),
    label: t < 0.5 ? a.label : b.label,
  };
}

/** Generate random lightning bolt segments as a list of [x,y,z] points */
export function generateLightningPath(
  startX: number,
  startZ: number,
  skyHeight: number,
  groundY: number
): Float32Array {
  // Jagged bolt from sky to ground
  const segments = 12 + Math.floor(Math.random() * 8);
  const positions: number[] = [];

  let x = startX;
  let z = startZ;
  const stepY = (groundY - skyHeight) / segments;

  for (let i = 0; i <= segments; i++) {
    const y = skyHeight + stepY * i;
    positions.push(x, y, z);
    if (i < segments) {
      x += (Math.random() - 0.5) * 18;
      z += (Math.random() - 0.5) * 18;
    }
  }

  return new Float32Array(positions);
}
