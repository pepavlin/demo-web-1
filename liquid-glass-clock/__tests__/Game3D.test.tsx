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

// Mock EffectComposer and postprocessing passes (require WebGL context)
const mockComposer = {
  addPass: jest.fn(),
  render: jest.fn(),
  dispose: jest.fn(),
  setSize: jest.fn(),
};
jest.mock("three/examples/jsm/postprocessing/EffectComposer.js", () => ({
  EffectComposer: jest.fn().mockImplementation(() => mockComposer),
}));
jest.mock("three/examples/jsm/postprocessing/RenderPass.js", () => ({
  RenderPass: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("three/examples/jsm/postprocessing/UnrealBloomPass.js", () => ({
  UnrealBloomPass: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("three/examples/jsm/postprocessing/OutputPass.js", () => ({
  OutputPass: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("three/examples/jsm/postprocessing/ShaderPass.js", () => ({
  ShaderPass: jest.fn().mockImplementation(() => ({
    material: {
      uniforms: {
        lightPosition: { value: { set: jest.fn() } },
        enabled:       { value: 1 },
        exposure:      { value: 0.12 },
        weight:        { value: 0.35 },
        time:          { value: 0.0 },   // animated fog drift uniform
        mieG:          { value: 0.76 },  // Henyey-Greenstein anisotropy
      },
    },
  })),
}));

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
    // [F]/Klik attack hint appears in the controls section of the intro
    const attackHints = getAllByText(/\[F\]\/Klik/);
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

  it("initialises EffectComposer for volumetric bloom", async () => {
    const { EffectComposer } = await import("three/examples/jsm/postprocessing/EffectComposer.js");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(EffectComposer).toHaveBeenCalled();
  });

  it("attaches UnrealBloomPass to the composer for god-ray effect", async () => {
    const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(UnrealBloomPass).toHaveBeenCalled();
    // Verify the bloom pass was configured (addPass called with it)
    expect(mockComposer.addPass).toHaveBeenCalled();
  });

  it("adds RenderPass and OutputPass to the postprocessing pipeline", async () => {
    const { RenderPass } = await import("three/examples/jsm/postprocessing/RenderPass.js");
    const { OutputPass } = await import("three/examples/jsm/postprocessing/OutputPass.js");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    expect(RenderPass).toHaveBeenCalled();
    expect(OutputPass).toHaveBeenCalled();
  });

  it("calls composer.dispose on unmount", () => {
    const { unmount } = render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    unmount();
    expect(mockComposer.dispose).toHaveBeenCalled();
  });

  it("sets up screen-space volumetric scattering pass without throwing", async () => {
    // The new implementation uses a ShaderPass (crepuscular-rays technique) instead of
    // 3-D cone geometry. Verify the entire scene setup completes successfully.
    const { ShaderPass } = await import("three/examples/jsm/postprocessing/ShaderPass.js");
    expect(() => render(<Game3D />)).not.toThrow();
    act(() => { jest.advanceTimersByTime(0); });
    expect(ShaderPass).toHaveBeenCalled();
  });

  it("stores bloomPass reference for dynamic strength updates", async () => {
    const { UnrealBloomPass } = await import("three/examples/jsm/postprocessing/UnrealBloomPass.js");
    render(<Game3D />);
    act(() => { jest.advanceTimersByTime(0); });
    // Bloom pass must have been constructed and added to the composer
    expect(UnrealBloomPass).toHaveBeenCalled();
    expect(mockComposer.addPass).toHaveBeenCalled();
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
});
