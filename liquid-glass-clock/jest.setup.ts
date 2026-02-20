import "@testing-library/jest-dom";

// ResizeObserver is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// requestAnimationFrame / cancelAnimationFrame are not available in jsdom
if (typeof global.requestAnimationFrame === "undefined") {
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return setTimeout(() => cb(Date.now()), 16) as unknown as number;
  };
}
if (typeof global.cancelAnimationFrame === "undefined") {
  global.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
