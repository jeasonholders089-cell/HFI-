import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": HERE },
  },
  test: {
    // 默认 node：lib/ 下的纯函数测试不需要 DOM。
    // 需要的组件测试（*.test.tsx）在文件顶部用 `// @vitest-environment jsdom` 单独声明 ——
    // 给每个纯函数测试都建一次 jsdom 会白吃两三百 MB 内存（实测会 OOM）。
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    // 显式 import describe/it/expect，不用 vitest/globals ——
    // 这样 next build 的 TypeScript 检查不需要额外配置就能过（docs/08 §7.1）
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
  },
});
