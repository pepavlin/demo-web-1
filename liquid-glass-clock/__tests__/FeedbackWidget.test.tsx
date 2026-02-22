/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import FeedbackWidget, { parseTasks } from "../components/FeedbackWidget";

const WEBHOOK_URL = "https://n8n.pavlin.dev/webhook/demo-web-1-create-issue";

describe("FeedbackWidget", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper: default GET response (no tasks)
  const mockGetEmpty = () =>
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => [] });

  it("renders the toggle button", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    expect(
      screen.getByRole("button", { name: /otevřít panel nápadů/i })
    ).toBeInTheDocument();
  });

  it("opens the chat panel when the button is clicked", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    const toggleBtn = screen.getByRole("button", { name: /otevřít panel nápadů/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByPlaceholderText(/co by se tu mělo/i)).toBeInTheDocument();
  });

  it("closes the chat panel when toggle button is clicked again", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    const toggleBtn = screen.getByRole("button", { name: /otevřít panel nápadů/i });
    fireEvent.click(toggleBtn);
    expect(screen.getByPlaceholderText(/co by se tu mělo/i)).toBeInTheDocument();

    const closeToggle = screen.getByRole("button", { name: /zavřít panel nápadů/i });
    fireEvent.click(closeToggle);
    expect(screen.queryByPlaceholderText(/co by se tu mělo/i)).not.toBeInTheDocument();
  });

  it("closes the panel with the × header button", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.click(screen.getByRole("button", { name: "Zavřít" }));
    expect(screen.queryByPlaceholderText(/co by se tu mělo/i)).not.toBeInTheDocument();
  });

  it("submit button is disabled when textarea is empty", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const submitBtn = screen.getByRole("button", { name: /odeslat nápad/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button becomes enabled when text is entered", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Přidat tmavý režim" } });
    const submitBtn = screen.getByRole("button", { name: /odeslat nápad/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("sends POST request to webhook URL on submit", async () => {
    // First call is GET (task counts), subsequent call is POST
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Přidat tmavý režim" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /odeslat nápad/i }));
    });

    const postCall = fetchMock.mock.calls.find(
      ([, opts]: [string, RequestInit]) => opts?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(postCall[0]).toBe(WEBHOOK_URL);
    expect(postCall[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Přidat tmavý režim" }),
    });
  });

  it("shows success message after successful submission", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200 });

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
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockRejectedValueOnce(new Error("Network error"));

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
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: false, status: 500 });

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
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Enter nápad" } });

    await act(async () => {
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    });

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit]) => opts?.method === "POST"
    );
    expect(postCalls).toHaveLength(1);
  });

  it("does NOT submit on Shift+Enter key press", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    const textarea = screen.getByPlaceholderText(/co by se tu mělo/i);
    fireEvent.change(textarea, { target: { value: "Shift enter test" } });

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    const postCalls = fetchMock.mock.calls.filter(
      ([, opts]: [string, RequestInit]) => opts?.method === "POST"
    );
    expect(postCalls).toHaveLength(0);
  });

  it("trims whitespace-only messages and does not submit", async () => {
    mockGetEmpty();
    render(<FeedbackWidget />);
    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));
    fireEvent.change(screen.getByPlaceholderText(/co by se tu mělo/i), {
      target: { value: "   " },
    });
    const submitBtn = screen.getByRole("button", { name: /odeslat nápad/i });
    expect(submitBtn).toBeDisabled();
  });

  it("allows sending another message after clicking 'Odeslat další'", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, status: 200 });

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

  // ─── Task counts badge ──────────────────────────────────────────────────────

  it("does not show task-counts badge when GET returns empty array", async () => {
    mockGetEmpty();
    await act(async () => {
      render(<FeedbackWidget />);
    });
    expect(screen.queryByTestId("task-counts")).not.toBeInTheDocument();
  });

  it("shows running count when GET returns running tasks", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: "1", status: "running" },
        { id: "2", status: "running" },
      ],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("task-counts")).toBeInTheDocument();
      expect(screen.getByTestId("running-count")).toHaveTextContent("2");
    });
  });

  it("shows queued count when GET returns queued tasks", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: "1", status: "queued" },
        { id: "2", status: "queued" },
        { id: "3", status: "queued" },
      ],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("task-counts")).toBeInTheDocument();
      expect(screen.getByTestId("queued-count")).toHaveTextContent("3");
    });
  });

  it("shows both running and queued counts when mixed tasks returned", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: "1", status: "running" },
        { id: "2", status: "queued" },
        { id: "3", status: "queued" },
        { id: "4", status: "done" },
      ],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("running-count")).toHaveTextContent("1");
      expect(screen.getByTestId("queued-count")).toHaveTextContent("2");
    });
  });

  it("handles GET returning tasks wrapped in object with tasks key", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        tasks: [
          { id: "1", status: "running" },
          { id: "2", status: "queued" },
        ],
      }),
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("running-count")).toHaveTextContent("1");
      expect(screen.getByTestId("queued-count")).toHaveTextContent("1");
    });
  });

  it("does not show badge when GET fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<FeedbackWidget />);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("task-counts")).not.toBeInTheDocument();
    });
  });

  it("does not show badge when GET returns non-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("task-counts")).not.toBeInTheDocument();
    });
  });

  it("makes GET request to the same WEBHOOK_URL", async () => {
    mockGetEmpty();

    await act(async () => {
      render(<FeedbackWidget />);
    });

    const getCall = fetchMock.mock.calls.find(
      ([, opts]: [string, RequestInit | undefined]) =>
        !opts || opts.method === "GET" || opts.method === undefined
    );
    expect(getCall).toBeDefined();
    expect(getCall[0]).toBe(WEBHOOK_URL);
  });

  it("re-polls after interval elapses", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    // Initial fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the 30s polling interval
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ─── Task list inside open panel ───────────────────────────────────────────

  it("does not show task-list inside panel when no tasks", async () => {
    mockGetEmpty();

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    expect(screen.queryByTestId("task-list")).not.toBeInTheDocument();
  });

  it("shows task-list inside panel when panel is open and tasks exist", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", status: "running", message: "Přidat tmavý režim" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByTestId("task-list")).toBeInTheDocument();
    });
  });

  it("does not show task-list when panel is closed even if tasks exist", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", status: "running", message: "Něco" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    // Panel is closed by default — task-list should not be in the DOM
    await waitFor(() => {
      expect(screen.queryByTestId("task-list")).not.toBeInTheDocument();
    });
  });

  it("displays running task message in the task list", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", status: "running", message: "Přidat tmavý režim" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByTestId("running-tasks")).toBeInTheDocument();
      expect(screen.getByText("Přidat tmavý režim")).toBeInTheDocument();
    });
  });

  it("displays task title as fallback when message field is absent", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", status: "running", title: "Fix navigation" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByText("Fix navigation")).toBeInTheDocument();
    });
  });

  it("displays fallback label when task has no message or title", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", status: "running" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByText(/implementace #1/i)).toBeInTheDocument();
    });
  });

  it("displays queued task message in the task list", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "1", status: "queued", message: "Opravit navigaci" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByTestId("queued-tasks")).toBeInTheDocument();
      expect(screen.getByText("Opravit navigaci")).toBeInTheDocument();
    });
  });

  it("displays fallback label for queued task without message", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "2", status: "queued" }],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByText(/ve frontě #1/i)).toBeInTheDocument();
    });
  });

  it("shows both running-tasks and queued-tasks sections when mixed", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: "1", status: "running", message: "Running task A" },
        { id: "2", status: "queued", message: "Queued task B" },
      ],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      expect(screen.getByTestId("running-tasks")).toBeInTheDocument();
      expect(screen.getByTestId("queued-tasks")).toBeInTheDocument();
      expect(screen.getByText("Running task A")).toBeInTheDocument();
      expect(screen.getByText("Queued task B")).toBeInTheDocument();
    });
  });

  it("renders multiple task-item entries for multiple tasks", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: "1", status: "running", message: "Task 1" },
        { id: "2", status: "running", message: "Task 2" },
        { id: "3", status: "queued", message: "Task 3" },
      ],
    });

    await act(async () => {
      render(<FeedbackWidget />);
    });

    fireEvent.click(screen.getByRole("button", { name: /otevřít panel nápadů/i }));

    await waitFor(() => {
      const items = screen.getAllByTestId("task-item");
      expect(items).toHaveLength(3);
    });
  });

  // ─── parseTasks unit tests ──────────────────────────────────────────────────

  describe("parseTasks", () => {
    it("returns empty array for empty array input", () => {
      expect(parseTasks([])).toEqual([]);
    });

    it("returns tasks from a root array", () => {
      const input = [{ id: "1", status: "running", message: "Do something" }];
      expect(parseTasks(input)).toEqual(input);
    });

    it("extracts tasks from { tasks: [...] } object", () => {
      const task = { id: "1", status: "queued" };
      expect(parseTasks({ tasks: [task] })).toEqual([task]);
    });

    it("extracts tasks from { data: [...] } object", () => {
      const task = { id: "2", status: "running" };
      expect(parseTasks({ data: [task] })).toEqual([task]);
    });

    it("extracts tasks from { items: [...] } object", () => {
      const task = { id: "3", status: "running" };
      expect(parseTasks({ items: [task] })).toEqual([task]);
    });

    it("filters out null/non-object entries", () => {
      const result = parseTasks([null, { id: "1", status: "running" }, "string", 42]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "1", status: "running" });
    });

    it("returns empty array for null input", () => {
      expect(parseTasks(null)).toEqual([]);
    });

    it("returns empty array for a plain string input", () => {
      expect(parseTasks("unexpected")).toEqual([]);
    });
  });
});
