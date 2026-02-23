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
    expect(getByText(/20 ovcí/)).toBeInTheDocument();
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
});
