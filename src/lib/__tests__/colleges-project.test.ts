import { describe, expect, it } from "vitest";

import {
  HOME_VIEW,
  MAP_H,
  MAP_W,
  MIN_VIEW_W,
  baseRadius,
  clampView,
  dotRadius,
  nearestSchool,
  pickThreshold,
  project,
  screenToViewBox,
  zoomAt,
  zoomScale,
} from "../colleges-project";

import fixture from "../../../data/__fixtures__/reference-xy.json";
import { COLLEGES } from "../colleges-data";

describe("project —— 坐标回归（底图正确性的唯一凭据）", () => {
  const ref = fixture as Record<string, { x: number; y: number }>;

  it("113 所逐一比对参考实现，本土残差 < 1 像素", () => {
    let max = 0;
    let worst = "";
    for (const c of COLLEGES) {
      const [x, y] = project(c.lat, c.lng);
      const r = ref[c.en];
      expect(r, `缺少 ${c.en} 的参考坐标`).toBeDefined();
      const d = Math.hypot(x - r.x, y - r.y);
      if (d > max) {
        max = d;
        worst = c.zh;
      }
    }
    // 实测 0.069 像素
    expect(max, `最大残差出现在 ${worst}`).toBeLessThan(1);
  });

  it("参考坐标基准覆盖全部 113 条", () => {
    expect(Object.keys(ref)).toHaveLength(113);
  });

  it("极点与越界经纬度不抛异常，返回有限数值", () => {
    for (const [lat, lng] of [
      [90, 0],
      [-90, 0],
      [0, 0],
      [40, 180],
      [40, -180],
      [40, 540],
    ]) {
      const [x, y] = project(lat, lng);
      expect(Number.isFinite(x), `lat=${lat} lng=${lng}`).toBe(true);
      expect(Number.isFinite(y), `lat=${lat} lng=${lng}`).toBe(true);
    }
  });

  it("投影结果落在视口附近（说明底图坐标系一致）", () => {
    for (const c of COLLEGES) {
      const [x, y] = project(c.lat, c.lng);
      expect(x).toBeGreaterThan(-20);
      expect(x).toBeLessThan(MAP_W + 20);
      expect(y).toBeGreaterThan(-20);
      expect(y).toBeLessThan(MAP_H + 20);
    }
  });
});

describe("点的大小（docs/08 §6.1）", () => {
  it("基础半径按排名分三档", () => {
    expect(baseRadius(1)).toBe(6.5);
    expect(baseRadius(10)).toBe(6.5);
    expect(baseRadius(11)).toBe(5.5);
    expect(baseRadius(30)).toBe(5.5);
    expect(baseRadius(31)).toBe(4.6);
    expect(baseRadius(113)).toBe(4.6);
  });

  it("k=1 时等于基础半径；放大后按 k^0.82 缩小", () => {
    expect(dotRadius(5.5, 1)).toBeCloseTo(5.5, 5);
    // k=2 时 5.5/2^0.82 ≈ 3.12，还没碰到下限
    expect(dotRadius(5.5, 2)).toBeCloseTo(5.5 / 2 ** 0.82, 5);
  });

  it("半径有 2.4 的下限（放大到一定程度就不再缩）", () => {
    expect(dotRadius(5.5, 4)).toBe(2.4); // 5.5/4^0.82 ≈ 1.76，被下限兜住
    expect(dotRadius(4.6, 1000)).toBe(2.4);
  });
});

describe("视口（docs/08 §6.3）", () => {
  it("clampView 把宽度钳到 [110, 975]，高度等比", () => {
    expect(clampView({ x: 0, y: 0, w: 50, h: 0 }).w).toBe(MIN_VIEW_W);
    expect(clampView({ x: 0, y: 0, w: 5000, h: 0 }).w).toBe(MAP_W);
    const r = clampView({ x: 0, y: 0, w: 487.5, h: 0 });
    expect(r.h).toBeCloseTo(MAP_H / 2, 5);
  });

  it("clampView 把位置钳回画布内", () => {
    const r = clampView({ x: -100, y: -100, w: 500, h: 0 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    const r2 = clampView({ x: 900, y: 600, w: 500, h: 0 });
    expect(r2.x).toBe(MAP_W - 500);
    expect(r2.y).toBeCloseTo(MAP_H - (500 * MAP_H) / MAP_W, 5);
  });

  it("zoomAt 让锚点保持不动", () => {
    const before = clampView({ x: 100, y: 100, w: 800, h: 0 });
    const cx = 300;
    const cy = 200;
    const after = zoomAt(before, cx, cy, 2);
    // 锚点在视口里的相对位置不变
    const rx1 = (cx - before.x) / before.w;
    const rx2 = (cx - after.x) / after.w;
    expect(rx2).toBeCloseTo(rx1, 5);
    const ry1 = (cy - before.y) / before.h;
    const ry2 = (cy - after.y) / after.h;
    expect(ry2).toBeCloseTo(ry1, 5);
  });

  it("zoomScale 在复位视口上等于 1", () => {
    expect(zoomScale(HOME_VIEW)).toBe(1);
    expect(zoomScale({ ...HOME_VIEW, w: 487.5 })).toBe(2);
  });

  it("screenToViewBox 是 screenToViewBox 的逆（居中映射）", () => {
    const rect = { left: 10, top: 20, width: 975, height: 610 };
    const vb = { x: 0, y: 0, w: 975, h: 610 };
    expect(screenToViewBox(10, 20, rect, vb)).toEqual([0, 0]);
    expect(screenToViewBox(10 + 975, 20 + 610, rect, vb)).toEqual([975, 610]);
  });
});

describe("最近点拾取（docs/08 §6.2）", () => {
  const pts = [
    { en: "A", x: 100, y: 100 },
    { en: "B", x: 103, y: 100 }, // 与 A 相距 3
    { en: "C", x: 400, y: 400 },
  ];

  it("光标准确落在重叠点之一时命中该点", () => {
    expect(nearestSchool(pts, 103, 100, 15)?.en).toBe("B");
    expect(nearestSchool(pts, 100, 100, 15)?.en).toBe("A");
  });

  it("超出阈值返回 null", () => {
    expect(nearestSchool(pts, 100, 140, 15)).toBeNull(); // 距最近点 40
  });

  it("只在传入的候选里找 —— 被筛掉的点不会被选中", () => {
    const visible = pts.filter((p) => p.en !== "B");
    expect(nearestSchool(visible, 103, 100, 15)?.en).toBe("A");
  });

  it("候选为空时返回 null", () => {
    expect(nearestSchool([], 0, 0, 15)).toBeNull();
  });

  it("阈值下限为 6", () => {
    expect(nearestSchool([{ en: "A", x: 0, y: 0 }], 0, 5, 0)).not.toBeNull();
    expect(nearestSchool([{ en: "A", x: 0, y: 0 }], 0, 7, 0)).toBeNull();
  });

  it("pickThreshold 按渲染宽度换算，且不小于 6", () => {
    expect(pickThreshold({ x: 0, y: 0, w: 975, h: 610 }, 975)).toBe(15);
    expect(pickThreshold({ x: 0, y: 0, w: 975, h: 610 }, 3000)).toBe(6); // 4.875 -> 抬到 6
    expect(pickThreshold({ x: 0, y: 0, w: 487.5, h: 305 }, 975)).toBeCloseTo(7.5, 5);
  });
});
