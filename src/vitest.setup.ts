/**
 * 组件测试的清理。
 *
 * 因为 vitest 里关掉了 globals（见 vitest.config.mts 的说明），
 * @testing-library/react 的自动 cleanup 不会生效 —— 不显式清理的话，
 * 上一个用例渲染的 DOM 会留到下个用例，导致 getByText 命中多个元素。
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
