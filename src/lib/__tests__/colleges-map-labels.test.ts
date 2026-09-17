import { describe, expect, it } from "vitest";

import { MAP_H, MAP_W } from "../colleges-project";
import { CITY_LABELS, GEO_LABELS, STATE_LABELS } from "../us-map-labels";

/**
 * 底图三份标注数据的完整性（docs/08 §6.4）。
 *
 * 这些数字是参考实现的事实值，改动会让底图与文档不一致，所以钉死。
 */
describe("底图标注数据（§6.4）", () => {
  it("州名标注 48 条 —— 缺的正好是 DE / RI / DC", () => {
    expect(STATE_LABELS).toHaveLength(48);
    const codes = STATE_LABELS.map((s) => s.a);
    for (const missing of ["DE", "RI", "DC"]) expect(codes).not.toContain(missing);
    for (const present of ["CA", "NY", "TX", "AK", "HI"]) expect(codes).toContain(present);
    expect(new Set(codes).size).toBe(48);
  });

  it("州名字号只有 4 档（6.8 / 8 / 9.5 / 11）", () => {
    const sizes = [...new Set(STATE_LABELS.map((s) => s.f))].sort((a, b) => a - b);
    expect(sizes).toEqual([6.8, 8, 9.5, 11]);
  });

  it("主要城市 16 个，无重复", () => {
    expect(CITY_LABELS).toHaveLength(16);
    expect(new Set(CITY_LABELS.map((c) => c.en)).size).toBe(16);
    for (const c of CITY_LABELS) {
      expect(c.zh.length).toBeGreaterThan(0);
      expect(c.en.length).toBeGreaterThan(0);
    }
  });

  it("海陆标注 5 个，其中 2 个是陆地邻国", () => {
    expect(GEO_LABELS).toHaveLength(5);
    expect(GEO_LABELS.filter((g) => g.land)).toHaveLength(2);
    expect(GEO_LABELS.map((g) => g.en)).toEqual([
      "C A N A D A",
      "M E X I C O",
      "ATLANTIC",
      "PACIFIC",
      "GULF OF MEXICO",
    ]);
  });

  it("所有标注的坐标都落在画布内（否则会被视口裁掉）", () => {
    const all = [
      ...STATE_LABELS.map((s) => ({ x: s.x, y: s.y })),
      ...CITY_LABELS.map((c) => ({ x: c.x, y: c.y })),
      ...GEO_LABELS.map((g) => ({ x: g.x, y: g.y })),
    ];
    for (const p of all) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(MAP_W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(MAP_H);
    }
  });
});
