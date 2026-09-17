import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * 三条跨文件的守卫（docs/08 §7.4 第 9 / 10 条、§7.6 第 7 条）。
 *
 * 这些约束单看代码看不出来，但只要破了一条，验收就不通过 —— 所以写成测试。
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "..", "..");
const ROOT = path.resolve(SRC, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|css)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const COLLEGE_FILES = [
  ...walk(path.join(SRC, "app", "colleges")),
  ...walk(path.join(SRC, "components", "colleges")),
];

function read(p: string): string {
  return fs.readFileSync(p, "utf8");
}

describe("选校地图的跨文件守卫", () => {
  it("页面源码不含第三方导流话术（§7.6 第 7 条）", () => {
    const banned = ["小助手", "顾问", "私信", "定位报告", "CMC", "师说留学"];
    for (const f of COLLEGE_FILES) {
      const s = read(f);
      for (const b of banned) {
        expect(s.includes(b), `${path.basename(f)} 含「${b}」`).toBe(false);
      }
    }
  });

  it("零外部依赖：没有 <img>、没有外链资源、没有远程字体（§7.4 第 9 条）", () => {
    for (const f of COLLEGE_FILES) {
      const s = read(f);
      expect(/<img\b/.test(s), `${path.basename(f)} 用了 <img>`).toBe(false);
      expect(/src=["']https?:\/\//.test(s), `${path.basename(f)} 有外链 src`).toBe(false);
      expect(/href=["']https?:\/\//.test(s), `${path.basename(f)} 有外链 href`).toBe(false);
      expect(/@font-face|fonts\.googleapis/.test(s), `${path.basename(f)} 引了远程字体`).toBe(false);
    }
  });

  it("导出清单：A4 横向打印、只打印 .print-area、且不含冲稳保定位栏（§6.13 D4）", () => {
    const css = read(path.join(SRC, "app", "globals.css"));
    expect(css).toContain("@page{size:A4 landscape");
    expect(css).toContain(".print-area");
    expect(css).toContain("visibility:hidden");

    const exp = read(path.join(SRC, "components", "colleges", "export-shortlist.tsx"));
    // 参考实现那一列是手写的「定位：冲/稳/保」——我们改成「家庭备注」空栏
    for (const b of ["冲", "稳", "保底", "MATCH_LABEL", "matchLabel"]) {
      expect(exp.includes(b), `导出页出现「${b}」`).toBe(false);
    }
    expect(exp).toContain("matchDisclaimer");
    expect(exp).toContain("exp.col.note");
  });

  it("字号三档走 html[data-font]，不是逐组件改样式（§6.14）", () => {
    const css = read(path.join(SRC, "app", "globals.css"));
    expect(css).toContain('html[data-font="lg"]');
    expect(css).toContain('html[data-font="xl"]');
    const page = read(path.join(SRC, "app", "colleges", "page.tsx"));
    expect(page).toContain("documentElement.dataset.font");
  });

  it("两栏比例是 CSS 变量，组件里不写死 62%（§5.5）", () => {
    const css = read(path.join(SRC, "app", "globals.css"));
    expect(css).toContain("--colleges-map-ratio");
    const page = read(path.join(SRC, "app", "colleges", "page.tsx"));
    expect(page).toContain("colleges-split");
    expect(page).not.toContain("62fr");
  });

  it("回到顶部只在滚动超过一屏时出现，且尊重 prefers-reduced-motion（§6.18 G3）", () => {
    const page = read(path.join(SRC, "app", "colleges", "page.tsx"));
    expect(page).toContain("window.scrollY > window.innerHeight");
    expect(page).toContain("prefers-reduced-motion: reduce");
  });

  it("入口侧：/explore 底部有指向选校地图的入口，带 from=explore（§6.17）", () => {
    const explore = read(path.join(SRC, "app", "explore", "page.tsx"));
    expect(explore).toContain("/colleges?from=explore");
  });

  it("四个页面共用同一个导航组件（§7.4 第 6 条）", () => {
    for (const f of ["page.tsx", path.join("colleges", "page.tsx"), path.join("explore", "page.tsx"), path.join("register", "page.tsx")]) {
      const s = read(path.join(SRC, "app", f));
      expect(s.includes("SiteNav"), `${f} 没用共享导航`).toBe(true);
    }
  });

  it("院校数据产物不含 zod（客户端零依赖，§3.5 闸 4）", () => {
    const data = read(path.join(SRC, "lib", "colleges-data.ts"));
    expect(data.includes("from \"zod\"")).toBe(false);
    expect(data.includes("require(\"zod\")")).toBe(false);
  });

  it("页脚与档案口径说明都写了数据版本与更新时间（§7.6 第 8 条一并守）", () => {
    const i18n = read(path.join(SRC, "lib", "colleges-i18n.ts"));
    expect(i18n).toContain("2026-08-11");
    // 仓库里确实有这份数据文件
    expect(fs.existsSync(path.join(ROOT, "data", "colleges.csv"))).toBe(true);
  });
});
