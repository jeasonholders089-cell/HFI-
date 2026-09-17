import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MAP_H, MAP_W } from "../colleges-project";
import { STATE_LABELS } from "../us-map-labels";
import { NEIGHBOR_LAND, STATE_PATHS, US_INSETS } from "../us-map-paths";

/**
 * 底图三层的数据契约（`docs/08` §4.2，2026-09-17 补）。
 *
 * 这三条对应的用户反馈：
 *   ① 美国以外的区域是空的 → 现在有邻国陆地；
 *   ② 阿拉斯加完全没画     → 现在有插图区，而且**必须完整落在画布内**
 *      （参考实现里阿拉斯加左边被裁掉了，我们没有照抄这个缺陷）；
 *   ③ 陆地与海洋糊成一块   → 现在是三层：海洋矩形 → 邻国陆地 → 美国（带投影）。
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function boxOf(d: string, t?: { s: number; tx: number; ty: number }): Box {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = Number(nums[i]) * (t?.s ?? 1) + (t?.tx ?? 0);
    const y = Number(nums[i + 1]) * (t?.s ?? 1) + (t?.ty ?? 0);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/** 解析产物里的 `translate(tx,ty) scale(s)` —— 只支持这一种写法，够用且能抓住手改。 */
function parseTransform(s: string): { s: number; tx: number; ty: number } {
  const t = /translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(s);
  const sc = /scale\(\s*(-?[\d.]+)\s*\)/.exec(s);
  return { s: sc ? Number(sc[1]) : 1, tx: t ? Number(t[1]) : 0, ty: t ? Number(t[2]) : 0 };
}

describe("邻国陆地（NEIGHBOR_LAND）", () => {
  it("四块：加拿大 / 墨西哥 / 巴哈马 / 古巴，顺序固定", () => {
    expect(NEIGHBOR_LAND.map((n) => n.id)).toEqual(["canada", "mexico", "bahamas", "cuba"]);
  });

  it("每条都是像样的路径（不是空串、不是几个点）", () => {
    for (const n of NEIGHBOR_LAND) {
      expect(n.d.startsWith("M"), `${n.id} 不以 M 开头`).toBe(true);
      expect(n.d.length, `${n.id} 路径太短`).toBeGreaterThan(100);
    }
  });

  it("加拿大压在画布上方、墨西哥伸到画布下方 —— 它们是「比画布大」的地块，由容器裁切", () => {
    const canada = boxOf(NEIGHBOR_LAND.find((n) => n.id === "canada")!.d);
    const mexico = boxOf(NEIGHBOR_LAND.find((n) => n.id === "mexico")!.d);
    expect(canada.minY).toBeLessThan(-100);
    expect(mexico.maxY).toBeGreaterThan(MAP_H);
  });

  it("邻国陆地不覆盖美国的本土范围（否则会把美国盖住）", () => {
    // 例：加拿大的南边界不应越过美加边境（y ≈ 221）太多
    const canada = boxOf(NEIGHBOR_LAND.find((n) => n.id === "canada")!.d);
    expect(canada.maxY).toBeLessThan(300);
  });
});

describe("阿拉斯加 / 夏威夷插图（US_INSETS）", () => {
  it("两个，州代码是 AK / HI，各带一条 transform", () => {
    expect(US_INSETS.map((i) => i.st)).toEqual(["AK", "HI"]);
    for (const i of US_INSETS) {
      expect(i.d.startsWith("M")).toBe(true);
      expect(i.transform.length).toBeGreaterThan(0);
    }
  });

  it("变换后**完整落在画布内**（参考实现里阿拉斯加左边被裁掉了，我们修掉了这一点）", () => {
    for (const i of US_INSETS) {
      const b = boxOf(i.d, parseTransform(i.transform));
      expect(b.minX, `${i.st} 左边超出`).toBeGreaterThanOrEqual(0);
      expect(b.minY, `${i.st} 上边超出`).toBeGreaterThanOrEqual(0);
      expect(b.maxX, `${i.st} 右边超出`).toBeLessThanOrEqual(MAP_W);
      expect(b.maxY, `${i.st} 下边超出`).toBeLessThanOrEqual(MAP_H);
    }
  });

  it("两个插图区互不相交（重叠就分不清哪个是哪个）", () => {
    const [a, h] = US_INSETS.map((i) => boxOf(i.d, parseTransform(i.transform)));
    const overlap = a.minX < h.maxX && h.minX < a.maxX && a.minY < h.maxY && h.minY < a.maxY;
    expect(overlap).toBe(false);
  });

  it("插图落在左下角，且州名标签落在这两个插图区内", () => {
    for (const i of US_INSETS) {
      const b = boxOf(i.d, parseTransform(i.transform));
      expect(b.maxX, `${i.st} 不该跑到画布右半边`).toBeLessThan(MAP_W / 2);
      expect(b.minY, `${i.st} 不该跑到画布上半边`).toBeGreaterThan(MAP_H / 2);

      const label = STATE_LABELS.find((s) => s.a === i.st);
      expect(label, `缺 ${i.st} 的州名标签`).toBeDefined();
      expect(label!.x).toBeGreaterThanOrEqual(b.minX);
      expect(label!.x).toBeLessThanOrEqual(b.maxX);
      expect(label!.y).toBeGreaterThanOrEqual(b.minY);
      expect(label!.y).toBeLessThanOrEqual(b.maxY);
    }
  });
});

describe("数据来源与不变量", () => {
  it("data/us-land.json 里有六条路径，来源可追溯", () => {
    const f = JSON.parse(fs.readFileSync(path.join(REPO, "data", "us-land.json"), "utf8")) as {
      source: string;
      paths: { id: string }[];
    };
    expect(f.paths.map((p) => p.id)).toEqual(["canada", "mexico", "alaska", "hawaii", "cuba", "bahamas"]);
    expect(f.source).toContain("CMC");
  });

  it("49 条州界没被动过（投影回归的前提）", () => {
    expect(STATE_PATHS).toHaveLength(49);
    expect(STATE_PATHS.some((s) => s.st === "AK" || s.st === "HI")).toBe(false);
  });
});
