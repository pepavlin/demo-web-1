/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement("div", props, children),
  },
}));

import LiquidBackground from "../components/LiquidBackground";

describe("LiquidBackground component", () => {
  it("renders without crashing", () => {
    const { container } = render(<LiquidBackground />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders rising particles after mount", () => {
    const { container } = render(<LiquidBackground />);
    const particles = container.querySelectorAll(".particle");
    expect(particles.length).toBeGreaterThan(0);
  });

  it("renders twinkling stars after mount", () => {
    const { container } = render(<LiquidBackground />);
    const stars = container.querySelectorAll(".particle-twinkle");
    expect(stars.length).toBeGreaterThan(0);
  });

  it("renders shooting stars after mount", () => {
    const { container } = render(<LiquidBackground />);
    const shoots = container.querySelectorAll(".particle-shoot");
    expect(shoots.length).toBeGreaterThan(0);
  });

  it("renders pulse orbs after mount", () => {
    const { container } = render(<LiquidBackground />);
    const orbs = container.querySelectorAll(".particle-orb");
    expect(orbs.length).toBeGreaterThan(0);
  });

  it("renders energy sparks after mount", () => {
    const { container } = render(<LiquidBackground />);
    const sparks = container.querySelectorAll(".particle-spark");
    expect(sparks.length).toBeGreaterThan(0);
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
