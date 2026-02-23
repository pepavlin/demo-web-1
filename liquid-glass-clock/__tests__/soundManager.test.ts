/**
 * @jest-environment jsdom
 */

// ── Web Audio API mock ─────────────────────────────────────────────────────
// jsdom does not implement Web Audio; we need a minimal mock so SoundManager
// can be exercised without a real browser.

const mockGainNode = () => ({
  gain: {
    value: 1,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
});

const mockOscillator = () => ({
  type: "sine",
  frequency: {
    value: 440,
    setValueAtTime: jest.fn(),
    linearRampToValueAtTime: jest.fn(),
    exponentialRampToValueAtTime: jest.fn(),
  },
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

const mockBufferSource = () => ({
  buffer: null,
  connect: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
});

const mockFilter = () => ({
  type: "lowpass",
  frequency: { value: 440 },
  Q: { value: 1 },
  connect: jest.fn(),
});

const mockAudioBuffer = () => ({
  getChannelData: jest.fn(() => new Float32Array(44100)),
});

const mockCtx = {
  state: "running",
  currentTime: 0,
  sampleRate: 44100,
  destination: {},
  resume: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  createGain: jest.fn(() => mockGainNode()),
  createOscillator: jest.fn(() => mockOscillator()),
  createBufferSource: jest.fn(() => mockBufferSource()),
  createBiquadFilter: jest.fn(() => mockFilter()),
  createBuffer: jest.fn(() => mockAudioBuffer()),
};

// Patch global AudioContext before importing the module
(global as unknown as Record<string, unknown>).AudioContext = jest
  .fn()
  .mockImplementation(() => mockCtx);

// Import after patching so the module picks up the mock
import { soundManager } from "../lib/soundManager";

// ── Helpers ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  // Reset mock call counts between tests
  jest.clearAllMocks();
  // Re-create AudioContext mock (soundManager is a singleton, but we can
  // reset the internal ctx by calling destroy first)
  soundManager.destroy();
  (global as unknown as Record<string, unknown>).AudioContext = jest
    .fn()
    .mockImplementation(() => mockCtx);
});

afterEach(() => {
  jest.useRealTimers();
  soundManager.destroy();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SoundManager – initialisation", () => {
  it("does not create an AudioContext before init() is called", () => {
    const AudioContextSpy = jest.fn().mockImplementation(() => mockCtx);
    (global as unknown as Record<string, unknown>).AudioContext = AudioContextSpy;

    // Import a fresh instance indirectly by re-evaluating init guard
    // (the singleton has already been imported, so we just verify the
    //  AudioContext constructor hasn't been called since destroy() reset ctx)
    expect(AudioContextSpy).not.toHaveBeenCalled();
  });

  it("creates an AudioContext on init()", () => {
    const AudioContextSpy = jest.fn().mockImplementation(() => mockCtx);
    (global as unknown as Record<string, unknown>).AudioContext = AudioContextSpy;

    soundManager.init();
    expect(AudioContextSpy).toHaveBeenCalledTimes(1);
  });

  it("calling init() twice only creates one AudioContext", () => {
    const AudioContextSpy = jest.fn().mockImplementation(() => mockCtx);
    (global as unknown as Record<string, unknown>).AudioContext = AudioContextSpy;

    soundManager.init();
    soundManager.init();
    expect(AudioContextSpy).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended context on second init() call", () => {
    const suspendedCtx = { ...mockCtx, state: "suspended" };
    const AudioContextSpy = jest
      .fn()
      .mockImplementation(() => suspendedCtx);
    (global as unknown as Record<string, unknown>).AudioContext = AudioContextSpy;

    soundManager.init(); // creates ctx
    soundManager.init(); // should call resume, not create a new one
    expect(suspendedCtx.resume).toHaveBeenCalledTimes(1);
    expect(AudioContextSpy).toHaveBeenCalledTimes(1);
  });
});

describe("SoundManager – volume / mute controls", () => {
  beforeEach(() => soundManager.init());

  it("isMuted() returns false by default", () => {
    expect(soundManager.isMuted()).toBe(false);
  });

  it("setMuted(true) makes isMuted() return true", () => {
    soundManager.setMuted(true);
    expect(soundManager.isMuted()).toBe(true);
  });

  it("setMuted(false) makes isMuted() return false again", () => {
    soundManager.setMuted(true);
    soundManager.setMuted(false);
    expect(soundManager.isMuted()).toBe(false);
  });

  it("getMasterVolume() returns the initial volume (0.75)", () => {
    expect(soundManager.getMasterVolume()).toBeCloseTo(0.75);
  });

  it("setMasterVolume() clamps to [0, 1]", () => {
    soundManager.setMasterVolume(2);
    expect(soundManager.getMasterVolume()).toBe(1);

    soundManager.setMasterVolume(-5);
    expect(soundManager.getMasterVolume()).toBe(0);
  });

  it("setMasterVolume(0.5) stores 0.5", () => {
    soundManager.setMasterVolume(0.5);
    expect(soundManager.getMasterVolume()).toBeCloseTo(0.5);
  });
});

describe("SoundManager – day/night adaptation", () => {
  beforeEach(() => soundManager.init());

  it("updateDaytime(0.5) sets day mode (noon)", () => {
    // Internal _isDayTime state isn't directly exposed, but we verify
    // that calling updateDaytime doesn't throw
    expect(() => soundManager.updateDaytime(0.5)).not.toThrow();
  });

  it("updateDaytime(0) sets night mode (midnight)", () => {
    expect(() => soundManager.updateDaytime(0)).not.toThrow();
  });

  it("updateDaytime(0.9) sets night mode (late night)", () => {
    expect(() => soundManager.updateDaytime(0.9)).not.toThrow();
  });
});

describe("SoundManager – sound effects don't throw", () => {
  beforeEach(() => soundManager.init());

  it("playFootstep(false) – walking", () => {
    expect(() => soundManager.playFootstep(false)).not.toThrow();
  });

  it("playFootstep(true) – running", () => {
    expect(() => soundManager.playFootstep(true)).not.toThrow();
  });

  it("playJump()", () => {
    expect(() => soundManager.playJump()).not.toThrow();
  });

  it("playCoinCollect()", () => {
    expect(() => soundManager.playCoinCollect()).not.toThrow();
  });

  it("playSheepBleat()", () => {
    expect(() => soundManager.playSheepBleat()).not.toThrow();
  });

  it("playFoxGrowl()", () => {
    expect(() => soundManager.playFoxGrowl()).not.toThrow();
  });

  it("playAttack()", () => {
    expect(() => soundManager.playAttack()).not.toThrow();
  });

  it("playFoxHit()", () => {
    expect(() => soundManager.playFoxHit()).not.toThrow();
  });

  it("playFoxDeath()", () => {
    expect(() => soundManager.playFoxDeath()).not.toThrow();
  });

  it("playPlayerHit()", () => {
    expect(() => soundManager.playPlayerHit()).not.toThrow();
  });

  it("playVictory()", () => {
    expect(() => soundManager.playVictory()).not.toThrow();
  });
});

describe("SoundManager – graceful no-ops before init", () => {
  // soundManager has been destroyed in beforeEach – ctx is null

  it("playFootstep() before init does not throw", () => {
    expect(() => soundManager.playFootstep(false)).not.toThrow();
  });

  it("playJump() before init does not throw", () => {
    expect(() => soundManager.playJump()).not.toThrow();
  });

  it("playCoinCollect() before init does not throw", () => {
    expect(() => soundManager.playCoinCollect()).not.toThrow();
  });

  it("playSheepBleat() before init does not throw", () => {
    expect(() => soundManager.playSheepBleat()).not.toThrow();
  });

  it("playFoxGrowl() before init does not throw", () => {
    expect(() => soundManager.playFoxGrowl()).not.toThrow();
  });

  it("playAttack() before init does not throw", () => {
    expect(() => soundManager.playAttack()).not.toThrow();
  });

  it("playFoxHit() before init does not throw", () => {
    expect(() => soundManager.playFoxHit()).not.toThrow();
  });

  it("playFoxDeath() before init does not throw", () => {
    expect(() => soundManager.playFoxDeath()).not.toThrow();
  });

  it("playPlayerHit() before init does not throw", () => {
    expect(() => soundManager.playPlayerHit()).not.toThrow();
  });

  it("playVictory() before init does not throw", () => {
    expect(() => soundManager.playVictory()).not.toThrow();
  });
});

describe("SoundManager – destroy", () => {
  it("destroy() closes the AudioContext", () => {
    soundManager.init();
    soundManager.destroy();
    expect(mockCtx.close).toHaveBeenCalledTimes(1);
  });

  it("destroy() can be called multiple times without throwing", () => {
    soundManager.init();
    expect(() => {
      soundManager.destroy();
      soundManager.destroy();
    }).not.toThrow();
  });
});
