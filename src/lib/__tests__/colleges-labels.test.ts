import { describe, expect, it } from "vitest";

import {
  LABEL_OFFSETS,
  SPREAD_K,
  layoutLabels,
  spreadPoints,
  type Pt,
} from "../colleges-labels";
import { nearestSchool } from "../colleges-project";

/** 一对几乎重合的点 —— 用来验证散开与拾取的分工。 */
const overlapping: Pt[] = [
  { en: "A", x: 100, y: 100 },
  { en: "B", x: 100.5, y: 100.4 },
];

describe("点位散开（§6.5）", () => {
  it(`k < ${SPREAD_K} 不散开（全局视图允许重叠）`, () => {
    const out = spreadPoints(overlapping, 1, 975, 800);
    expect(out).toEqual(overlapping);
  });

  it("k ≥ 2.5 时把重合的点推开", () => {
    const out = spreadPoints(overlapping, 3, 325, 800);
    const d = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
    expect(d).toBeGreaterThan(0);
    // 目标间距 12 屏幕像素 → 12 * (325/800) ≈ 4.875 视口单位
    expect(d).toBeGreaterThanOrEqual(4.8);
  });

  it("位移不超过 24 屏幕像素的上限", () => {
    const cluster: Pt[] = Array.from({ length: 12 }, (_, i) => ({ en: `P${i}`, x: 200 + i * 0.05, y: 200 }));
    const out = spreadPoints(cluster, 4, 244, 800);
    const cap = 24 * (244 / 800);
    for (let i = 0; i < cluster.length; i++) {
      const d = Math.hypot(out[i].x - cluster[i].x, out[i].y - cluster[i].y);
      expect(d).toBeLessThanOrEqual(cap + 1e-9);
    }
  });

  it("散开后拾取仍按原始坐标（§6.5 的关键坑）", () => {
    const before = nearestSchool(overlapping, 100.2, 100.2, 6);
    expect(before).not.toBeNull();
    // 渲染坐标被推开了，但拾取用的是原始坐标 —— 结果必须还是那一个点
    const rendered = spreadPoints(overlapping, 3, 325, 800);
    expect(rendered[0].x).not.toBe(overlapping[0].x);
    const after = nearestSchool(overlapping, 100.2, 100.2, 6);
    expect(after?.en).toBe(before?.en);
  });

  it("不改变点的数量与 en 顺序", () => {
    const out = spreadPoints(overlapping, 3, 325, 800);
    expect(out.map((p) => p.en)).toEqual(["A", "B"]);
  });
});

describe("院校名的碰撞避让（§6.4）", () => {
  const bounds = { x: 0, y: 0, w: 975, h: 610 };

  it("五处偏移位全部冲突时丢弃该标签，而不是叠上去", () => {
    const pts = Array.from({ length: 9 }, (_, i) => ({
      en: `P${i}`,
      x: 300,
      y: 300,
      rank: i + 1,
      text: "很长的校名文字",
    }));
    const out = layoutLabels(pts, 8, bounds, 6, 4);
    expect(out.length).toBeLessThan(pts.length);
    expect(out.length).toBeGreaterThan(0);
  });

  it("排名高的先占位（rank 升序处理）", () => {
    const pts = [
      { en: "late", x: 400, y: 300, rank: 90, text: "甲甲甲甲" },
      { en: "first", x: 400, y: 300, rank: 1, text: "乙乙乙乙" },
    ];
    const out = layoutLabels(pts, 8, bounds, 6, 4);
    expect(out[0].en).toBe("first");
  });

  it("视口外的点不参与布局（外扩 10 单位）", () => {
    const pts = [
      { en: "in", x: 500, y: 300, rank: 1, text: "在框内" },
      { en: "out", x: 2000, y: 300, rank: 2, text: "在框外" },
    ];
    const out = layoutLabels(pts, 8, bounds, 6, 4);
    expect(out.map((l) => l.en)).toEqual(["in"]);
  });

  it("五个偏移位是文档里定的那五个", () => {
    expect([...LABEL_OFFSETS]).toEqual([0, -1.15, 1.15, -2.3, 2.3]);
  });

  it("limit 生效（与「视口内超过 60 所整体不显示」配合）", () => {
    const pts = Array.from({ length: 20 }, (_, i) => ({
      en: `P${i}`,
      x: 100 + i * 40,
      y: 300,
      rank: i + 1,
      text: "校名",
    }));
    expect(layoutLabels(pts, 8, bounds, 6, 4, 5).length).toBe(5);
  });
});
