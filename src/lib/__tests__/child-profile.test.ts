import { describe, expect, it } from "vitest";

import { hasProfile, pendingProfileIds } from "../child-profile";

/**
 * 「画像是否已生成」的判定（2026-09-18 抽成共享函数）。
 *
 * 为什么要抽出来并测：首页（今天还有几个孩子没画像）与 `/explore`（三个数字、待分析清单）
 * 用的是同一个概念。两处各写一份迟早漂移——那时会出现"首页说都生成好了、大屏说还有待分析"，
 * 而两个页面看着都正常。**这类不一致最难查**，所以钉住。
 */
const d = (n: number) =>
  JSON.stringify(Array.from({ length: n }, () => ({ category: "人文科学", name: "x", nameEn: "x", reason: "y" })));

describe("hasProfile", () => {
  it("恰好 3 个方向才算有画像", () => {
    expect(hasProfile(d(3))).toBe(true);
    expect(hasProfile(d(2))).toBe(false);
    expect(hasProfile(d(4))).toBe(false);
  });

  it("null / 空 / 非法 JSON → 没有画像，且不抛异常", () => {
    expect(hasProfile(null)).toBe(false);
    expect(hasProfile("")).toBe(false);
    expect(hasProfile("[]")).toBe(false);
    expect(hasProfile("{不是 JSON")).toBe(false);
  });

  it("**只看方向个数，不看类别合不合法**——类别合法性是「已分类」，另一件事", () => {
    // 三个方向、但类别是旧的四类之一：有画像 ✓，不算已分类（由 categorized 判定）
    const old = JSON.stringify([
      { category: "艺术", name: "a", nameEn: "a", reason: "r" },
      { category: "艺术", name: "b", nameEn: "b", reason: "r" },
      { category: "艺术", name: "c", nameEn: "c", reason: "r" },
    ]);
    expect(hasProfile(old)).toBe(true);
  });
});

describe("pendingProfileIds", () => {
  it("挑出还没有画像的 id，已生成的不在列表里", () => {
    const rows = [
      { id: 1, aiDirections: d(3) },
      { id: 2, aiDirections: null },
      { id: 3, aiDirections: d(2) },
      { id: 4, aiDirections: d(3) },
    ];
    expect(pendingProfileIds(rows)).toEqual([2, 3]);
  });

  it("空数组 → 空数组", () => {
    expect(pendingProfileIds([])).toEqual([]);
  });

  it("全都没画像时全进列表（批量导入后的真实状态）", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, aiDirections: null }));
    expect(pendingProfileIds(rows)).toHaveLength(12);
  });
});
