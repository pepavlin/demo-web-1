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
});
