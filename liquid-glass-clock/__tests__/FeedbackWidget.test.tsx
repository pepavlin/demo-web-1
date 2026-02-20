/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import FeedbackWidget from "../components/FeedbackWidget";

const WEBHOOK_URL = "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";

describe("FeedbackWidget", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the toggle button", () => {
    render(<FeedbackWidget />);
    expect(
      screen.getByRole("button", { name: /otevřít panel nápadů/i })
    ).toBeInTheDocument();
  });

  it("opens the chat panel when the button is clicked", () => {
    render(<FeedbackWidget />);
    const toggleBtn = screen.getByRole("button", { name: /otevřít panel nápadů/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByPlaceholderText(/co by se tu mělo/i)).toBeInTheDocument();
  });

  it("closes the chat panel when toggle button is clicked again", () => {
    render(<FeedbackWidget />);
    const toggleBtn = screen.getByRole("button", { name: /otevřít panel nápadů/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByPlaceholderText(/co by se tu mělo/i)).toBeInTheDocument();

    const closeToggle = screen.getByRole("button", { name: /zavřít panel nápadů/i });
    fireEvent.click(closeToggle);
    expect(screen.queryByPlaceholderText(/co by se tu mělo/i)).not.toBeInTheDocument();
  });

  it("closes the panel with the × header button", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    // Click the header × button (exact aria-label "Zavřít")
    fireEvent.click(screen.getByRole("button", { name: "Zavřít" }));
    expect(screen.queryByPlaceholderText(/co by se tu mělo/i)).not.toBeInTheDocument();
  });

  it("submit button is disabled when textarea is empty", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const submitBtn = screen.getByRole("button", { name: /odeslat nápad/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button becomes enabled when text is entered", () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Přidat tmavý režim" } });
    const submitBtn = screen.getByRole("button", { name: /odeslat nápad/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("sends POST request to webhook URL on submit", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Přidat tmavý režim" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat nápad/i }));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      WEBHOOK_URL,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Přidat tmavý režim" }),
      })
    );
  });

  it("shows success message after successful submission", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.change(screen.getByPlaceholderText(/co by se tu mělo/i), {
      target: { value: "Nový nápad" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat nápad/i }));
    });

    expect(
      screen.getByText(/nápad byl odeslán k implementaci/i)
    ).toBeInTheDocument();
  });

  it("shows error message when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.change(screen.getByPlaceholderText(/co by se tu mělo/i), {
      target: { value: "Nový nápad" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat nápad/i }));
    });

    expect(screen.getByText(/chyba při odesílání/i)).toBeInTheDocument();
  });

  it("shows error message when server returns non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.change(screen.getByPlaceholderText(/co by se tu mělo/i), {
      target: { value: "Nový nápad" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat nápad/i }));
    });

    expect(screen.getByText(/chyba při odesílání/i)).toBeInTheDocument();
  });

  it("submits on Enter key press", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Enter nápad" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT submit on Shift+Enter key press", async () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Shift enter test" } });

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims whitespace-only messages and does not submit", async () => {
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.change(screen.getByPlaceholderText(/co by se tu mělo/i), {
      target: { value: "   " },
    });
    // Button should remain disabled for whitespace-only input
    const submitBtn = screen.getByRole("button", { name: /odeslat nápad/i });
    expect(submitBtn).toBeDisabled();
  });

  it("allows sending another message after clicking 'Odeslat další'", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.change(screen.getByPlaceholderText(/co by se tu mělo/i), {
      target: { value: "Nápad 1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat nápad/i }));
    });

    expect(screen.getByText(/nápad byl odeslán k implementaci/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /odeslat další/i }));

    expect(screen.getByPlaceholderText(/co by se tu mělo/i)).toBeInTheDocument();
  });
});
