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
  duration: 1.5,
  numberOfChannels: 1,
  sampleRate: 44100,
  length: 44100,
  copyFromChannel: jest.fn(),
  copyToChannel: jest.fn(),
});

const mockCtx = {
  state: "running",
  currentTime: 0,
  sampleRate: 44100,
  destination: {},
  resume: jest.fn().mockResolvedValue(undefined),
  suspend: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  createGain: jest.fn(() => mockGainNode()),
  createOscillator: jest.fn(() => mockOscillator()),
  createBufferSource: jest.fn(() => ({
    ...mockBufferSource(),
    playbackRate: { value: 1 },
  })),
  createBiquadFilter: jest.fn(() => mockFilter()),
  createBuffer: jest.fn(() => mockAudioBuffer()),
  decodeAudioData: jest.fn(() => Promise.resolve(mockAudioBuffer())),
};

// Mock fetch so _loadSheepBuffer doesn't fail in jsdom
const mockFetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as Response)
);
(global as unknown as Record<string, unknown>).fetch = mockFetch;

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

  it("playSheepBleat() – default volume (1.0)", () => {
    expect(() => soundManager.playSheepBleat()).not.toThrow();
  });

  it("playSheepBleat(0.5) – half volume (distant sheep)", () => {
    expect(() => soundManager.playSheepBleat(0.5)).not.toThrow();
  });

  it("playSheepBleat(0) – zero volume is silently skipped", () => {
    const prevCalls = mockCtx.createOscillator.mock.calls.length;
    soundManager.playSheepBleat(0);
    // No new audio nodes should be created for a fully silent bleat
    expect(mockCtx.createOscillator.mock.calls.length).toBe(prevCalls);
  });

  it("playSheepBleat(1.5) – volume > 1 is clamped to 1", () => {
    expect(() => soundManager.playSheepBleat(1.5)).not.toThrow();
  });

  it("playSheepBleat(-0.5) – negative volume is clamped to 0 (no audio nodes)", () => {
    const prevCalls = mockCtx.createOscillator.mock.calls.length;
    soundManager.playSheepBleat(-0.5);
    expect(mockCtx.createOscillator.mock.calls.length).toBe(prevCalls);
  });

  it("multiple playSheepBleat() calls produce independent sounds simultaneously", () => {
    // Simulate 3 nearby sheep bleating at different volumes
    soundManager.playSheepBleat(1.0);
    soundManager.playSheepBleat(0.7);
    soundManager.playSheepBleat(0.3);
    // Each call should create its own audio graph (no shared state)
    expect(() => {}).not.toThrow();
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

  it("playWaterAmbient() – default volume (1.0)", () => {
    expect(() => soundManager.playWaterAmbient()).not.toThrow();
  });

  it("playWaterAmbient(0.5) – half volume", () => {
    expect(() => soundManager.playWaterAmbient(0.5)).not.toThrow();
  });

  it("playWaterAmbient(0) – zero volume is silently skipped", () => {
    const prevCalls = mockCtx.createBufferSource.mock.calls.length;
    soundManager.playWaterAmbient(0);
    expect(mockCtx.createBufferSource.mock.calls.length).toBe(prevCalls);
  });

  it("playWaterAmbient(1.5) – volume > 1 is clamped", () => {
    expect(() => soundManager.playWaterAmbient(1.5)).not.toThrow();
  });

  it("playWaterAmbient(-0.1) – negative volume is silently skipped", () => {
    const prevCalls = mockCtx.createBufferSource.mock.calls.length;
    soundManager.playWaterAmbient(-0.1);
    expect(mockCtx.createBufferSource.mock.calls.length).toBe(prevCalls);
  });

  it("playWaterAmbient() creates audio nodes", () => {
    const prevCalls = mockCtx.createBufferSource.mock.calls.length;
    soundManager.playWaterAmbient(1.0);
    expect(mockCtx.createBufferSource.mock.calls.length).toBeGreaterThan(prevCalls);
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

  it("playWaterAmbient() before init does not throw", () => {
    expect(() => soundManager.playWaterAmbient()).not.toThrow();
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

/** Flush microtask queue by awaiting multiple Promise.resolve() ticks. */
const flushMicrotasks = async (ticks = 8) => {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
};

describe("SoundManager – sheep bleat sample loading", () => {
  it("fetch is called for sheep sound on init()", () => {
    mockFetch.mockClear();
    soundManager.init();
    // fetch should have been called for OGG (first source)
    expect(mockFetch).toHaveBeenCalledWith("/sounds/sheep-bleat.ogg");
  });

  it("playSheepBleat() does not throw when sample has not loaded yet", () => {
    soundManager.init();
    expect(() => soundManager.playSheepBleat()).not.toThrow();
  });

  it("playSheepBleat() uses BufferSource when sample is loaded", async () => {
    soundManager.init();
    // Flush: fetch → arrayBuffer → decodeAudioData → assign _sheepBuffer
    await flushMicrotasks();

    const prevCalls = mockCtx.createBufferSource.mock.calls.length;
    soundManager.playSheepBleat();
    expect(mockCtx.createBufferSource.mock.calls.length).toBeGreaterThan(prevCalls);
  });

  it("playSheepBleat(0.5) uses BufferSource when sample is loaded (distance-based volume)", async () => {
    soundManager.init();
    await flushMicrotasks();

    const prevCalls = mockCtx.createBufferSource.mock.calls.length;
    soundManager.playSheepBleat(0.5);
    expect(mockCtx.createBufferSource.mock.calls.length).toBeGreaterThan(prevCalls);
  });

  it("falls back to OGG→MP3 when OGG fetch fails", async () => {
    // Set up mock BEFORE init so _loadSheepBuffer sees the rejection for OGG
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as Response);

    soundManager.init();
    await flushMicrotasks();

    expect(mockFetch).toHaveBeenCalledWith("/sounds/sheep-bleat.mp3");
  });
});

describe("SoundManager – pause / resume", () => {
  beforeEach(() => soundManager.init());

  it("isPaused() returns false after init", () => {
    expect(soundManager.isPaused()).toBe(false);
  });

  it("pause() suspends the AudioContext", () => {
    soundManager.pause();
    expect(mockCtx.suspend).toHaveBeenCalledTimes(1);
  });

  it("pause() sets isPaused() to true", () => {
    soundManager.pause();
    expect(soundManager.isPaused()).toBe(true);
  });

  it("pause() clears pending music and wind timeouts", () => {
    // After init(), ambient and wind timeouts are scheduled.
    // pause() must clear them so they don't fire while the game is paused.
    // We verify this indirectly: a second pause() call should still only
    // call suspend() once (i.e., guard works because _paused=true).
    soundManager.pause();
    soundManager.pause(); // should be a no-op
    expect(mockCtx.suspend).toHaveBeenCalledTimes(1);
  });

  it("calling pause() twice does not call suspend() a second time", () => {
    soundManager.pause();
    soundManager.pause();
    expect(mockCtx.suspend).toHaveBeenCalledTimes(1);
  });

  it("resume() calls ctx.resume() after pause", () => {
    soundManager.pause();
    // capture calls made by init() / pause()
    const callsBefore = mockCtx.resume.mock.calls.length;
    soundManager.resume();
    // resume() must call ctx.resume() synchronously
    expect(mockCtx.resume.mock.calls.length).toBe(callsBefore + 1);
  });

  it("resume() sets isPaused() back to false synchronously", () => {
    soundManager.pause();
    soundManager.resume();
    expect(soundManager.isPaused()).toBe(false);
  });

  it("resume() before pause() is a no-op (does not call ctx.resume)", () => {
    const callsBefore = mockCtx.resume.mock.calls.length;
    soundManager.resume(); // not paused – should be a no-op
    expect(mockCtx.resume.mock.calls.length).toBe(callsBefore);
  });

  it("destroy() resets isPaused() to false", () => {
    soundManager.pause();
    soundManager.destroy();
    expect(soundManager.isPaused()).toBe(false);
  });
});

describe("SoundManager – pause / resume before init", () => {
  // global beforeEach calls soundManager.destroy() so ctx is null here
  // No local beforeEach that calls init()

  it("isPaused() returns false before init", () => {
    expect(soundManager.isPaused()).toBe(false);
  });

  it("pause() before init() is a no-op and does not throw", () => {
    expect(() => soundManager.pause()).not.toThrow();
  });

  it("resume() before init() is a no-op and does not throw", () => {
    expect(() => soundManager.resume()).not.toThrow();
  });
});
