/**
 * Tests for components/PrinterModal.tsx
 *
 * Covers:
 * - Renders nothing when isOpen=false
 * - Renders the modal when isOpen=true
 * - Close button is visible in idle state
 * - Submit button is disabled when input is empty
 * - Submit button is enabled after typing
 * - Calls onClose when close button clicked
 * - Shows "SPUSTIT TISK" text on submit button
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import PrinterModal from "@/components/PrinterModal";

const defaultProps = {
  isOpen: true,
  playerName: "TestHráč",
  onClose: jest.fn(),
  onItemGenerated: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PrinterModal", () => {
  it("renders nothing when isOpen=false", () => {
    const { container } = render(
      <PrinterModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the modal panel when isOpen=true", () => {
    render(<PrinterModal {...defaultProps} />);
    expect(screen.getByText(/3D TISKÁRNA/i)).toBeInTheDocument();
  });

  it("renders ONLINE status text", () => {
    render(<PrinterModal {...defaultProps} />);
    expect(screen.getByText(/ONLINE/i)).toBeInTheDocument();
  });

  it("shows a close button in idle state", () => {
    render(<PrinterModal {...defaultProps} />);
    expect(screen.getByLabelText("Zavřít")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    render(<PrinterModal {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Zavřít"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("submit button is present with 'SPUSTIT TISK' text", () => {
    render(<PrinterModal {...defaultProps} />);
    expect(screen.getByText(/SPUSTIT TISK/i)).toBeInTheDocument();
  });

  it("submit button is disabled when textarea is empty", () => {
    render(<PrinterModal {...defaultProps} />);
    const button = screen.getByText(/SPUSTIT TISK/i).closest("button");
    expect(button).toBeDisabled();
  });

  it("submit button becomes enabled after typing in textarea", () => {
    render(<PrinterModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/Např:/i);
    fireEvent.change(textarea, { target: { value: "magický meč" } });
    const button = screen.getByText(/SPUSTIT TISK/i).closest("button");
    expect(button).not.toBeDisabled();
  });

  it("shows prompt text for Ctrl+Enter shortcut", () => {
    render(<PrinterModal {...defaultProps} />);
    expect(screen.getByText(/Ctrl\+Enter/i)).toBeInTheDocument();
  });

  it("resets to idle state when reopened", () => {
    const { rerender } = render(<PrinterModal {...defaultProps} isOpen={false} />);
    rerender(<PrinterModal {...defaultProps} isOpen={true} />);
    // Should show idle state UI elements
    expect(screen.getByText(/SPUSTIT TISK/i)).toBeInTheDocument();
  });

  it("shows character limit counter", () => {
    render(<PrinterModal {...defaultProps} />);
    expect(screen.getByText(/0\/200 znaků/)).toBeInTheDocument();
  });

  it("updates character counter as user types", () => {
    render(<PrinterModal {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/Např:/i);
    act(() => {
      fireEvent.change(textarea, { target: { value: "test" } });
    });
    expect(screen.getByText(/4\/200 znaků/)).toBeInTheDocument();
  });
});
