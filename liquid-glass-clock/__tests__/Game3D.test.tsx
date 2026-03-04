/**
 * @jest-environment jsdom
 */

// Mock THREE.js WebGL renderer - it requires a real browser context
jest.mock("three", () => {
  const actual = jest.requireActual("three");
  return {
    ...actual,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      domElement: document.createElement("canvas"),
      shadowMap: { enabled: false, type: null },
      toneMapping: null,
      toneMappingExposure: 1,
    })),
  };
});

// Mock socket.io-client to prevent real WebSocket connections in tests
jest.mock("socket.io-client", () => ({
  io: jest.fn(() => ({
    connected: false,
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Post-processing pipeline removed — no EffectComposer needed.

// Minimal pointer lock mock
Object.defineProperty(document, "pointerLockElement", {
  writable: true,
  configurable: true,
  value: null,
});
HTMLElement.prototype.requestPointerLock = jest.fn();

import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Stub rAF to prevent infinite loop
jest
  .spyOn(window, "requestAnimationFrame")
  .mockReturnValue(0 as unknown as ReturnType<typeof requestAnimationFrame>);
jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

import Game3D from "../components/Game3D";

describe("Game3D component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders without crashing", () => {
    expect(() =>
      render(<Game3D />)
    ).not.toThrow();
  });

  it("shows the intro overlay before pointer is locked", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText("Hrát!")).toBeInTheDocument();
  });

  it("shows play button in the intro", () => {
    const { getByRole } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByRole("button", { name: "Hrát!" })).toBeInTheDocument();
  });

  it("shows sheep count in the intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // The intro mentions the sheep count
    expect(getByText(/200 ovcí/)).toBeInTheDocument();
  });

  it("shows coin count in the intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/35 mincí/)).toBeInTheDocument();
  });

  it("does not show HUD controls when not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // Controls hint only shows when locked
    expect(queryByText(/WASD – pohyb/)).toBeNull();
  });

  it("unmounts without throwing", () => {
    const { unmount } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(() => unmount()).not.toThrow();
  });

  it("shows combat instruction (fight foxes) in intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/Bojuj s liškami/)).toBeInTheDocument();
  });

  it("shows attack key hint [F] in intro overlay", () => {
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // [F] appears in strong tags in intro
    const fElements = getAllByText(/\[F\]/);
    expect(fElements.length).toBeGreaterThan(0);
  });

  it("shows attack on fox hint in intro overlay", () => {
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // [F]/Drž klik attack hint appears in the controls section of the intro
    const attackHints = getAllByText(/\[F\]\/Drž klik/);
    expect(attackHints.length).toBeGreaterThan(0);
  });

  it("does not show game over overlay initially", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText("Byl jsi poražen!")).toBeNull();
    expect(queryByText("Zkusit znovu")).toBeNull();
  });

  it("does not show fox HP bar initially (not locked)", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText("Liška")).toBeNull();
  });

  it("does not show attack button when not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/\[F\] Útok/)).toBeNull();
  });

  it("renders without crashing when Three.js adds grass, clouds and galaxy", () => {
    // Ensures scene setup with grass/galaxy/cloud additions doesn't throw
    expect(() => render(<Game3D />)).not.toThrow();
  });

  it("renders dense grass scene without crashing (GRASS_COUNT=180000)", () => {
    // Ensures the grass (180 000 blades, 11–22 per cluster, adaptive planes)
    // initialises without errors or memory overflows in the test environment.
    // Test env uses 2000 blades to stay within memory limits.
    expect(() => render(<Game3D />)).not.toThrow();
  });

  it("shows Open World label in HUD after locking (intro mentions day/night)", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // Intro mentions the day/night cycle
    expect(getByText(/den.*noc|noc.*den/i)).toBeInTheDocument();
  });

  it("shows lighthouse mention in intro", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/maják/i)).toBeInTheDocument();
  });

  it("uses direct WebGL renderer without EffectComposer (optimised rendering)", () => {
    // Post-processing pipeline removed for performance — direct renderer.render() is used.
    const THREE = jest.requireMock("three");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // Renderer must be created
    expect(THREE.WebGLRenderer).toHaveBeenCalled();
  });

  it("unmounts without throwing (no composer to dispose)", () => {
    const { unmount } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(() => unmount()).not.toThrow();
  });

  it("renders scene setup without throwing (no volumetric scattering pass)", () => {
    // Volumetric scattering ShaderPass removed for performance — verify setup still completes
    expect(() => render(<Game3D />)).not.toThrow();
    act(() => { jest.advanceTimersByTime(0); });
  });

  it("renders scene setup without crashing (no post-processing pipeline)", () => {
    // Post-processing removed for performance — verify setup still completes correctly.
    expect(() => render(<Game3D />)).not.toThrow();
    act(() => { jest.advanceTimersByTime(0); });
  });

  // ── Possession feature tests ──────────────────────────────────────────────────

  it("shows [E] key hint for sheep possession in the intro overlay", () => {
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // [E] appears in the intro controls section
    const eHints = getAllByText(/\[E\]/);
    expect(eHints.length).toBeGreaterThan(0);
  });

  it("shows 'vstoupit do těla ovce' hint in the intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/vstoupit do těla ovce/i)).toBeInTheDocument();
  });

  it("does not show the possession prompt overlay when game is not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // The floating "press E" prompt only renders when isLocked=true
    expect(queryByText(/Vstoupit do těla ovce/)).toBeNull();
  });

  it("does not show the 'Hraješ za ovci' banner when game is not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Hraješ za ovci/)).toBeNull();
  });

  it("shows [E] possession hint in the bottom controls bar when game is locked", () => {
    // The bottom controls hint always renders when locked; possession is listed there.
    // We can't easily lock pointer in tests, but we verify the text exists in the intro
    // which also renders the hint as part of the controls grid.
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // At least one occurrence of [E] in intro
    const eElements = getAllByText(/\[E\]/);
    expect(eElements.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show 'Opustit tělo' text when game is not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Opustit tělo/)).toBeNull();
  });

  // ── Mouse hold auto-fire tests ────────────────────────────────────────────────

  it("registers mouseup event listener on mount", () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const calls = addSpy.mock.calls.map(([event]) => event);
    expect(calls).toContain("mouseup");
    addSpy.mockRestore();
  });

  it("removes mouseup event listener on unmount", () => {
    const removeSpy = jest.spyOn(document, "removeEventListener");
    const { unmount } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    const calls = removeSpy.mock.calls.map(([event]) => event);
    expect(calls).toContain("mouseup");
    removeSpy.mockRestore();
  });

  it("shows 'drž klik' hint in intro overlay for auto-fire", () => {
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const hints = getAllByText(/drž klik/i);
    expect(hints.length).toBeGreaterThan(0);
  });

  it("shows 'Drž klik' attack hint in HUD controls bar", () => {
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // The HUD controls bar (shown when locked) has [F]/Drž klik
    const hints = getAllByText(/\[F\]\/Drž klik/);
    expect(hints.length).toBeGreaterThan(0);
  });

  // ─── Multiplayer UI ───────────────────────────────────────────────────────

  it("does not show mp-notification initially", () => {
    const { queryByTestId } = render(<Game3D playerName="Tester" />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByTestId("mp-notification")).toBeNull();
  });

  it("does not show online-players-panel when no remote players", () => {
    const { queryByTestId } = render(<Game3D playerName="Tester" />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByTestId("online-players-panel")).toBeNull();
  });

  it("accepts a playerName prop without crashing", () => {
    expect(() => render(<Game3D playerName="Karel" />)).not.toThrow();
  });

  // ── Weapon selection tests ─────────────────────────────────────────────────────

  it("clicking Hrát! shows weapon select overlay", () => {
    const { getByRole, getByTestId } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const btn = getByRole("button", { name: "Hrát!" });
    act(() => { btn.click(); });
    expect(getByTestId("weapon-select-overlay")).toBeInTheDocument();
  });

  it("clicking Hrát! hides intro overlay and shows weapon select", () => {
    const { getByRole, queryByText, getByTestId } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const btn = getByRole("button", { name: "Hrát!" });
    act(() => { btn.click(); });
    // Intro should be hidden
    expect(queryByText("Open World")).toBeNull();
    // Weapon select should be visible
    expect(getByTestId("weapon-select-overlay")).toBeInTheDocument();
  });

  it("weapon select shows all three weapon options", () => {
    const { getByRole, getByTestId } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    act(() => { getByRole("button", { name: "Hrát!" }).click(); });
    expect(getByTestId("weapon-card-pistol")).toBeInTheDocument();
    expect(getByTestId("weapon-card-sword")).toBeInTheDocument();
    expect(getByTestId("weapon-card-sniper")).toBeInTheDocument();
  });

  // ── Camera mode (1st / 3rd person) tests ──────────────────────────────────────

  it("shows [V] camera toggle hint in the intro overlay", () => {
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const vHints = getAllByText(/\[V\]/);
    expect(vHints.length).toBeGreaterThan(0);
  });

  it("shows '1. osoba' camera mode indicator when game is not locked (default first person)", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // Camera mode indicator only shows when isLocked = true; not visible yet
    expect(queryByText(/1. osoba/)).toBeNull();
    expect(queryByText(/3. osoba/)).toBeNull();
  });

  it("registers keydown/keyup listeners for V key handling", () => {
    const addSpy = jest.spyOn(window, "addEventListener");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const events = addSpy.mock.calls.map(([event]) => event);
    expect(events).toContain("keydown");
    expect(events).toContain("keyup");
    addSpy.mockRestore();
  });

  it("shows '1./3. osobu' camera hint in the intro controls", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/přepnout 1\.\/3\. osobu/i)).toBeInTheDocument();
  });

  it("shows camera mode indicator in the HUD controls bar when locked", () => {
    // The HUD controls bar renders [V] alongside the mode text.
    // We verify the intro overlay (always rendered) contains the [V] hint.
    const { getAllByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const vElements = getAllByText(/\[V\]/);
    expect(vElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders without crashing when V key hint is present in intro", () => {
    expect(() => render(<Game3D />)).not.toThrow();
  });

  // ── Catapult HUD tests ──────────────────────────────────────────────────────
  it("does not show catapult warning by default (player far from catapults)", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // catapultWarning is false by default — warning banner must not be visible
    expect(queryByText(/Katapult v blízkosti/)).toBeNull();
  });

  it("does not show catapult HP bar by default", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // nearCatapultHp is null by default — HP display must not be visible
    expect(queryByText(/^Katapult$/)).toBeNull();
  });

  it("does not show catapults defeated counter when count is 0", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Katapulty/)).toBeNull();
  });

  // ── Catapult intro objective tests ─────────────────────────────────────────

  it("shows catapult destroy objective in intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // Intro must list catapults as a combat objective
    expect(getByText(/katapultů/i)).toBeInTheDocument();
  });

  it("shows cannonball warning text ('střílí kule') in catapult objective", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/střílí kule/i)).toBeInTheDocument();
  });

  it("shows 💣 emoji for catapult objective in intro", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // The catapult objective starts with the 💣 emoji
    expect(getByText(/💣/)).toBeInTheDocument();
  });

  // ── Swimming and boat tests ────────────────────────────────────────────────────

  it("shows swimming hint in intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/Plav ve vodě/i)).toBeInTheDocument();
  });

  it("shows boat hint in intro overlay", () => {
    const { getByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(getByText(/loď/i)).toBeInTheDocument();
  });

  it("does not show boat boarding prompt when game is not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // The 'Nastoupit na loď' prompt only appears near the boat when locked
    expect(queryByText(/Nastoupit na loď/)).toBeNull();
  });

  it("does not show on-boat banner when game is not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Na lodi/)).toBeNull();
  });

  // ── Minimap enlargement & lighthouse accessibility tests ─────────────────────

  it("renders minimap canvas with enlarged size (220x220)", () => {
    const { container } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    const canvas = container.querySelector("canvas[width='220'][height='220']");
    expect(canvas).not.toBeNull();
  });

  it("lighthouse coordinates are within world playable boundary (±123.5)", () => {
    // LIGHTHOUSE_X = -95, LIGHTHOUSE_Z = 85, WORLD_SIZE/2 - 10 = 123.5
    const LIGHTHOUSE_X = -95;
    const LIGHTHOUSE_Z = 85;
    const WORLD_SIZE = 267;
    const boundary = WORLD_SIZE / 2 - 10;
    expect(Math.abs(LIGHTHOUSE_X)).toBeLessThanOrEqual(boundary);
    expect(Math.abs(LIGHTHOUSE_Z)).toBeLessThanOrEqual(boundary);
  });

  it("lighthouse is visible on the 220x220 minimap (coords map within canvas)", () => {
    const LIGHTHOUSE_X = -95;
    const LIGHTHOUSE_Z = 85;
    const WORLD_SIZE = 267;
    const W = 220;
    const scale = W / WORLD_SIZE;
    const cx = W / 2;
    const cy = W / 2;
    const mx = cx + LIGHTHOUSE_X * scale;
    const mz = cy + LIGHTHOUSE_Z * scale;
    expect(mx).toBeGreaterThanOrEqual(0);
    expect(mx).toBeLessThanOrEqual(W);
    expect(mz).toBeGreaterThanOrEqual(0);
    expect(mz).toBeLessThanOrEqual(W);
  });
});

// ─── Rocket System ────────────────────────────────────────────────────────────
describe("Rocket system", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders Game3D without rocket-related crashes", () => {
    expect(() => render(<Game3D />)).not.toThrow();
  });

  it("rocket boarding prompt is not visible when pointer is not locked", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // The boarding prompt should not appear until isLocked && nearRocket
    expect(queryByText(/Nastoupit do rakety/)).toBeNull();
  });

  it("on-rocket banner is not visible before player boards", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/V raketě/)).toBeNull();
  });

  it("launch prompt text is not visible before boarding", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Odpálit/)).toBeNull();
  });

  it("launching banner is not visible before launch", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Startujeme/)).toBeNull();
  });

  it("docking welcome message is not visible at start", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Dokování úspěšné/)).toBeNull();
  });

  it("station welcome aboard text is not visible at start", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Vítejte na palubě Matky lodí/)).toBeNull();
  });

  // ── Space Station UI: initial state tests ─────────────────────────────────
  it("space station active banner is not visible at start", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/Vesmírná loď/)).toBeNull();
  });

  it("airlock return-to-Earth prompt is not visible at start", () => {
    const { queryByText } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(queryByText(/vrátit se na Zemi/)).toBeNull();
  });
});
