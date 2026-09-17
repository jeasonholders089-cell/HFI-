/**
 * 8 类分类体系的单测（docs/11 §6.2 C 的 6 条）。
 *
 * C-1 把 8 个字符串写死在测试里，是故意的：它们同时是**数据契约**
 * （存进库、进 prompt、渲染成大屏标签），改名单必须同步改测试，
 * 于是也就被迫回头改 `docs/10` 与 `AGENTS.md`——四处一起动。
 */
import { describe, expect, it } from "vitest";

import { CATEGORIES, CATEGORY_ENUM, CATEGORY_RULES, categorized } from "../growth-categories";

const EXPECTED = [
  "人文科学",
  "社会科学",
  "商科与管理",
  "自然科学",
  "数学与计算",
  "工程与应用",
  "艺术与设计",
  "健康与公共服务",
];

const withCategories = (...cs: string[]) =>
  JSON.stringify(cs.map((category, i) => ({ category, name: `方向${i}`, nameEn: `D${i}`, reason: "r" })));

describe("CATEGORIES —— 8 个类别字符串的冻结值", () => {
  it("C-1 恰好 8 个、无重复，且与写死的期望数组逐字相等（顺序也算）", () => {
    expect([...CATEGORIES]).toEqual(EXPECTED);
    expect(new Set(CATEGORIES).size).toBe(8);
  });

  it("类别枚举与判定规则从同一份常量派生，不会各写一份", () => {
    expect(CATEGORY_ENUM).toBe(EXPECTED.join("、"));
    expect(CATEGORY_RULES).toContain("不设「跨学科」桶");
    expect(CATEGORY_RULES).toContain("设计（含工业设计、交互设计）→ 艺术与设计");
  });
});

describe("categorized —— 严格校验，旧类别一律不算数", () => {
  it("C-2 新 8 类的任意组合都通过（恰好 3 个方向）", () => {
    expect(categorized(withCategories("人文科学", "商科与管理", "健康与公共服务"))).toBe(true);
    expect(categorized(withCategories("自然科学", "数学与计算", "工程与应用"))).toBe(true);
    expect(categorized(withCategories("艺术与设计", "艺术与设计", "社会科学"))).toBe(true);
  });

  it("C-3 旧 4 类里被改名的那些不再通过", () => {
    // 旧体系是「人文科学 / 社会科学 / 自然科学 / 艺术」。8 类里前三个字面量原样保留，
    // 只有「艺术」改成了「艺术与设计」——所以**只有带「艺术」的旧组合会被判成待分类**。
    expect(categorized(withCategories("人文科学", "社会科学", "艺术"))).toBe(false);
    expect(categorized(withCategories("社会科学", "自然科学", "艺术"))).toBe(false);
  });

  it("C-4 方向数不等于 3 不通过", () => {
    expect(categorized(withCategories("人文科学", "社会科学"))).toBe(false);
    expect(categorized(withCategories("人文科学", "社会科学", "自然科学", "数学与计算"))).toBe(false);
    expect(categorized("[]")).toBe(false);
  });

  it("C-5 类别是 8 类之外的字符串不通过", () => {
    expect(categorized(withCategories("跨学科", "社会科学", "人文科学"))).toBe(false);
    expect(categorized(withCategories("职业", "社会科学", "人文科学"))).toBe(false);
    expect(categorized(withCategories("", "社会科学", "人文科学"))).toBe(false);
  });

  it("C-6 null / 非法 JSON / 空数组 / 非数组都不抛异常", () => {
    for (const bad of [null, "", "{", "[1,2,3]", '"字符串"', "{}"]) {
      expect(() => categorized(bad as string | null)).not.toThrow();
      expect(categorized(bad as string | null), String(bad)).toBe(false);
    }
  });
});
