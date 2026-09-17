/**
 * 组件测试的清理。
 *
 * 因为 vitest 里关掉了 globals（见 vitest.config.mts 的说明），
 * @testing-library/react 的自动 cleanup 不会生效 —— 不显式清理的话，
 * 上一个用例渲染的 DOM 会留到下个用例，导致 getByText 命中多个元素。
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * jsdom 缺的浏览器 API —— 组件测试要用到，但 jsdom 没实现。
 * 放在这里而不是每个用例里，避免漏一个就报 "not a function"。
 */

// ResizeObserver：地图与表格都用它同步容器尺寸
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

// matchMedia：操作提示按 pointer:coarse 换文案、回到顶部看 prefers-reduced-motion
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Pointer Capture：地图拖拽时把指针锁在 SVG 上
if (typeof Element !== "undefined" && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

afterEach(() => {
  cleanup();
});
