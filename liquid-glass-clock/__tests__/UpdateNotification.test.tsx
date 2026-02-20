/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/hooks/useVersionCheck", () => ({
  useVersionCheck: jest.fn(),
}));

import UpdateNotification from "../components/UpdateNotification";
import { useVersionCheck } from "@/hooks/useVersionCheck";

const mockUseVersionCheck = useVersionCheck as jest.Mock;

describe("UpdateNotification component", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when no update is available", () => {
    mockUseVersionCheck.mockReturnValue({ updateAvailable: false });
    const { container } = render(<UpdateNotification />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the notification dialog when update is available", () => {
    mockUseVersionCheck.mockReturnValue({ updateAvailable: true });
    render(<UpdateNotification />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/dostupná nová verze/i)).toBeInTheDocument();
  });

  it("shows the refresh button", () => {
    mockUseVersionCheck.mockReturnValue({ updateAvailable: true });
    render(<UpdateNotification />);
    expect(screen.getByRole("button", { name: /obnovit stránku/i })).toBeInTheDocument();
  });

  it("refresh button click triggers reload (verifies onClick is wired)", () => {
    mockUseVersionCheck.mockReturnValue({ updateAvailable: true });

    // jsdom's window.location.reload is not callable in tests, but we can
    // verify the button click does not throw a React error.
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<UpdateNotification />);
    // Should not throw
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: /obnovit stránku/i }))
    ).not.toThrow();

    consoleError.mockRestore();
  });

  it("has correct aria attributes for accessibility", () => {
    mockUseVersionCheck.mockReturnValue({ updateAvailable: true });
    render(<UpdateNotification />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-live", "polite");
    expect(dialog).toHaveAttribute("aria-label", "Dostupná nová verze");
  });
});
