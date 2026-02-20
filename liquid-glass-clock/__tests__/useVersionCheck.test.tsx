/**
 * @jest-environment jsdom
 */
import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useVersionCheck } from "@/hooks/useVersionCheck";

describe("useVersionCheck hook", () => {
  let fetchMock: jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.useFakeTimers();
    process.env = { ...originalEnv, NEXT_PUBLIC_BUILD_ID: "abc123" };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it("starts with updateAvailable = false", () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: "abc123" }),
    });

    const { result } = renderHook(() => useVersionCheck());
    expect(result.current.updateAvailable).toBe(false);
  });

  it("does not flag update when server version matches current version", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: "abc123" }),
    });

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(result.current.updateAvailable).toBe(false);
  });

  it("flags update when server returns a different version", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: "xyz999" }),
    });

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });
  });

  it("ignores fetch errors gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(result.current.updateAvailable).toBe(false);
  });

  it("ignores non-ok fetch responses", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const { result } = renderHook(() => useVersionCheck());

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(result.current.updateAvailable).toBe(false);
  });

  it("polls on a 60-second interval", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: "abc123" }),
    });

    renderHook(() => useVersionCheck());

    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears interval on unmount", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: "abc123" }),
    });

    const { unmount } = renderHook(() => useVersionCheck());

    unmount();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    // After unmount no further polls should happen
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
