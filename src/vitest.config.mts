import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": HERE },
  },
  test: {
    // 组件测试需要 DOM 与 localStorage
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    // 显式 import describe/it/expect，不用 vitest/globals ——
    // 这样 next build 的 TypeScript 检查不需要额外配置就能过（docs/08 §7.1）
    globals: false,
    testTimeout: 30000,
  },
});
