/**
 * @jest-environment jsdom
 */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockMotionValue = (initial: number) => {
  let val = initial;
  return { get: () => val, set: (v: number) => { val = v; }, subscribe: jest.fn(() => jest.fn()) };
};

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", props, children),
  },
  useMotionValue: (initial: number) => mockMotionValue(initial),
  useSpring: (val: unknown) => val,
  useTransform: () => mockMotionValue(0),
}));

// Mock the useMouseParallax hook so 3-D parallax doesn't throw in tests
jest.mock("@/hooks/useMouseParallax", () => ({
  useMouseParallax: () => ({
    normX: { get: () => 0, subscribe: jest.fn(() => jest.fn()) },
    normY: { get: () => 0, subscribe: jest.fn(() => jest.fn()) },
  }),
}));

import LiquidBackground from "../components/LiquidBackground";

describe("LiquidBackground component", () => {
  it("renders without crashing", () => {
    const { container } = render(<LiquidBackground />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders the fixed container with overflow hidden", () => {
    const { container } = render(<LiquidBackground />);
    expect(container.firstChild).toHaveClass("fixed");
    expect(container.firstChild).toHaveClass("overflow-hidden");
  });

  it("renders the noise overlay", () => {
    const { container } = render(<LiquidBackground />);
    const noiseOverlay = container.querySelector(".noise-overlay");
    expect(noiseOverlay).toBeInTheDocument();
  });

  it("renders the volumetric rays container", () => {
    const { container } = render(<LiquidBackground />);
    const raysContainer = container.querySelector(".vol-rays-container");
    expect(raysContainer).toBeInTheDocument();
  });

  it("renders the volumetric rays hub inside the container", () => {
    const { container } = render(<LiquidBackground />);
    const hub = container.querySelector(".vol-rays-hub");
    expect(hub).toBeInTheDocument();
  });

  it("renders 10 individual ray beams", () => {
    const { container } = render(<LiquidBackground />);
    const rays = container.querySelectorAll(".vol-ray");
    expect(rays).toHaveLength(10);
  });

  it("renders volumetric rays before the noise overlay (lower z-index layer)", () => {
    const { container } = render(<LiquidBackground />);
    const raysContainer = container.querySelector(".vol-rays-container");
    const noiseOverlay = container.querySelector(".noise-overlay");
    // Both should be present; rays container should appear before noise in DOM
    expect(raysContainer).toBeInTheDocument();
    expect(noiseOverlay).toBeInTheDocument();
    const all = Array.from(container.querySelectorAll("*"));
    expect(all.indexOf(raysContainer!)).toBeLessThan(all.indexOf(noiseOverlay!));
  });

  it("renders the warm golden ray hub", () => {
    const { container } = render(<LiquidBackground />);
    const warmHub = container.querySelector(".vol-rays-hub-warm");
    expect(warmHub).toBeInTheDocument();
  });

  it("renders 5 warm golden ray beams", () => {
    const { container } = render(<LiquidBackground />);
    const warmRays = container.querySelectorAll(".vol-ray-warm");
    expect(warmRays).toHaveLength(5);
  });

  it("renders the central volumetric light-source glow", () => {
    const { container } = render(<LiquidBackground />);
    const lightSource = container.querySelector(".vol-light-source");
    expect(lightSource).toBeInTheDocument();
  });

  it("renders the light source inside the rays container", () => {
    const { container } = render(<LiquidBackground />);
    const raysContainer = container.querySelector(".vol-rays-container");
    const lightSource = container.querySelector(".vol-light-source");
    expect(raysContainer).toContainElement(lightSource!);
  });
});
