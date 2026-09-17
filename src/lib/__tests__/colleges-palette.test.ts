import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * 配色守卫（docs/08 §5.5）。
 *
 * 起因：技术评审在 v0.1 里提了三个色值（#1F6F5C / #2F6FA8 / #B4553A），
 * 一个都不在产品色板里 —— 等于给产品引了第二套视觉语言。
 * 这条测试把那件事变成可执行的闸：**本页出现的每个字面量色值，都必须来自 globals.css 的色板**。
 *
 * 实现说明：规则的口径是"必须取自色板"，而不是"完全不许出现字面量"。
 * 后者要把所有 Tailwind 任意值改写成 var(...)，可读性损失大；
 * 而成员校验同样能挡住越界色 —— 那才是要防的问题。
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "..");

/** 从 globals.css 的 palette 段里解析出允许的色值。 */
function readPalette(): Set<string> {
  const css = fs.readFileSync(path.join(SRC, "app", "globals.css"), "utf8");
  const start = css.indexOf("palette starts");
  const end = css.indexOf("palette ends");
  if (start < 0 || end < 0) throw new Error("globals.css 里找不到 palette 段");
  const seg = css.slice(start, end);
  const found = new Set<string>();
  for (const m of seg.matchAll(/--palette-\d+:\s*(#[0-9a-fA-F]{6})/g)) {
    found.add(m[1].toLowerCase());
  }
  return found;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) out.push(p);
  }
  return out;
}

describe("配色守卫", () => {
  const palette = readPalette();

  it("色板至少有 30 个色值（防止解析失败导致这条测试形同虚设）", () => {
    expect(palette.size).toBeGreaterThanOrEqual(30);
  });

  it("色板里不含 CMC 的品牌色（橙 / 蓝 / 红）", () => {
    for (const banned of ["#e57930", "#2570a8", "#a31f34", "#c49a5b"]) {
      expect(palette.has(banned), `${banned} 不该出现在色板里`).toBe(false);
    }
  });

  it("选校地图与现场全景的页面和组件只用色板里的色值", () => {
    const files = [
      path.join(SRC, "app", "colleges", "page.tsx"),
      path.join(SRC, "app", "explore", "page.tsx"),
      ...walk(path.join(SRC, "components", "colleges")),
      // 现场全景改版新增的两处：共享底图与梦想院校地图（docs/11 §4.1）
      ...walk(path.join(SRC, "components", "map")),
      ...walk(path.join(SRC, "components", "explore")),
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const m of text.matchAll(/#[0-9a-fA-F]{6}/g)) {
        const v = m[0].toLowerCase();
        if (!palette.has(v)) offenders.push(`${path.relative(SRC, f)} → ${v}`);
      }
    }
    expect(offenders, "这些色值不在 globals.css 的色板里").toEqual([]);
  });

  it("共享导航与地图组件也不越界", () => {
    const files = [path.join(SRC, "components", "site-nav.tsx")];
    for (const f of files) {
      const text = fs.readFileSync(f, "utf8");
      for (const m of text.matchAll(/#[0-9a-fA-F]{6}/g)) {
        expect(palette.has(m[0].toLowerCase()), `${path.basename(f)} → ${m[0]}`).toBe(true);
      }
    }
  });
});
