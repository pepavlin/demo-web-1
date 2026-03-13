/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ChangelogWidget from "../components/ChangelogWidget";
import { CHANGELOG } from "../lib/changelogData";

describe("ChangelogWidget component", () => {
  it("renders the toggle button", () => {
    render(<ChangelogWidget />);
    expect(
      screen.getByRole("button", { name: /otevřít changelog/i })
    ).toBeInTheDocument();
  });

  it("does not show the panel before toggling", () => {
    render(<ChangelogWidget />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the changelog panel when the button is clicked", () => {
    render(<ChangelogWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít changelog/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows header text inside the panel", () => {
    render(<ChangelogWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít changelog/i }));
    expect(screen.getByText(/co je nového/i)).toBeInTheDocument();
  });

  it("renders all changelog entries", () => {
    render(<ChangelogWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít changelog/i }));
    const entries = screen.getAllByTestId("changelog-entry");
    expect(entries).toHaveLength(CHANGELOG.length);
  });

  it("closes the panel when the close button inside the dialog is clicked", () => {
    render(<ChangelogWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít changelog/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Two "zavřít" buttons exist when open: one inside the panel, one on the toggle.
    // Click the first one (the × inside the dialog header).
    const closeButtons = screen.getAllByRole("button", { name: /zavřít changelog/i });
    fireEvent.click(closeButtons[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toggle button shows X icon and 'zavřít' label when panel is open", () => {
    render(<ChangelogWidget />);
    const toggleBtn = screen.getByRole("button", { name: /otevřít changelog/i });
    fireEvent.click(toggleBtn);
    // Button label changes to close
    expect(
      screen.getAllByRole("button", { name: /zavřít changelog/i }).length
    ).toBeGreaterThan(0);
  });

  it("toggle button has aria-expanded=false initially", () => {
    render(<ChangelogWidget />);
    const btn = screen.getByRole("button", { name: /otevřít changelog/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("toggle button has aria-expanded=true when panel is open", () => {
    render(<ChangelogWidget />);
    const btn = screen.getByRole("button", { name: /otevřít changelog/i });
    fireEvent.click(btn);
    // After open, find the toggle button by its new label
    const openBtn = screen.getAllByRole("button", { name: /zavřít changelog/i });
    // The floating toggle button is one of them (aria-expanded)
    const toggleBtn = openBtn.find((b) => b.hasAttribute("aria-expanded"));
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("renders dates for every entry", () => {
    render(<ChangelogWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít changelog/i }));
    CHANGELOG.forEach((entry) => {
      expect(screen.getByText(entry.date)).toBeInTheDocument();
    });
  });

  it("renders titles for every entry", () => {
    render(<ChangelogWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít changelog/i }));
    CHANGELOG.forEach((entry) => {
      expect(screen.getByText(entry.title)).toBeInTheDocument();
    });
  });
});

describe("CHANGELOG data", () => {
  it("has at least one entry", () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
  });

  it("entries are ordered newest-first (dates descending)", () => {
    for (let i = 0; i < CHANGELOG.length - 1; i++) {
      expect(CHANGELOG[i].date >= CHANGELOG[i + 1].date).toBe(true);
    }
  });

  it("every entry has a non-empty title", () => {
    CHANGELOG.forEach((entry) => {
      expect(entry.title.trim().length).toBeGreaterThan(0);
    });
  });

  it("every entry has at least one item", () => {
    CHANGELOG.forEach((entry) => {
      expect(entry.items.length).toBeGreaterThan(0);
    });
  });
});
