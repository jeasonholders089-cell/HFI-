import { describe, expect, it } from "vitest";

import { COMPARE_ROWS, bestIndex } from "../colleges-compare";
import { COLLEGES } from "../colleges-data";
import type { College } from "../colleges-data";

const byName = (zh: string): College => {
  const c = COLLEGES.find((x) => x.zh === zh);
  if (!c) throw new Error(`找不到 ${zh}`);
  return c;
};

describe("对比表（docs/08 §6.12）", () => {
  it("23 行固定行，顺序与参考实现一致", () => {
    expect(COMPARE_ROWS).toHaveLength(23);
    expect(COMPARE_ROWS.map((r) => r.key)).toEqual([
      "name", "usn", "qs", "city", "type", "acc", "er", "rr", "lever", "tr", "apps",
      "sat", "gpa", "test", "rounds", "ddl", "tuition", "intl", "idef", "ivw",
      "mf", "tags", "note",
    ]);
  });

  it("只有 8 行参与高亮，且 SAT / GPA 不参与（C2 的防复发断言）", () => {
    const withMode = COMPARE_ROWS.filter((r) => r.mode);
    expect(withMode).toHaveLength(8);
    expect(withMode.map((r) => r.key)).toEqual(["acc", "er", "rr", "lever", "tr", "apps", "tuition", "intl"]);
    expect(COMPARE_ROWS.find((r) => r.key === "sat")?.mode).toBeUndefined();
    expect(COMPARE_ROWS.find((r) => r.key === "gpa")?.mode).toBeUndefined();
  });

  it("取值方向：录取类取最大，申请人数与学费取最小", () => {
    const max = ["acc", "er", "rr", "lever", "tr", "intl"];
    const min = ["apps", "tuition"];
    for (const k of max) expect(COMPARE_ROWS.find((r) => r.key === k)?.mode).toBe("max");
    for (const k of min) expect(COMPARE_ROWS.find((r) => r.key === k)?.mode).toBe("min");
  });
});

describe("bestIndex —— 最优值高亮", () => {
  const rowOf = (key: string) => COMPARE_ROWS.find((r) => r.key === key)!;

  it("两所可比时高亮更优的那一所（录取率取最大）", () => {
    const rice = byName("莱斯大学"); // acc 8.0%
    const cmu = byName("卡耐基梅隆大学");
    const hi = bestIndex([rice, cmu], rowOf("acc"));
    const winner = [rice, cmu][hi];
    const other = [rice, cmu][hi === 0 ? 1 : 0];
    expect(winner.accNum!).toBeGreaterThan(other.accNum!);
  });

  it("申请人数取最小", () => {
    const a = byName("莱斯大学");
    const b = byName("纽约大学");
    const hi = bestIndex([a, b], rowOf("apps"));
    const winner = [a, b][hi];
    const other = [a, b][hi === 0 ? 1 : 0];
    expect(winner.apps!).toBeLessThan(other.apps!);
  });

  it("并列时都不高亮", () => {
    const same = { ...byName("莱斯大学") };
    expect(bestIndex([same, { ...same }], rowOf("acc"))).toBe(-1);
  });

  it("不足两所可比时不高亮", () => {
    expect(bestIndex([byName("莱斯大学")], rowOf("acc"))).toBe(-1);
  });

  it("缺失值不参与比较；只有一所可比时不高亮", () => {
    const a = byName("莱斯大学");
    const b = { ...byName("纽约大学"), accNum: null, acc: null as unknown as string };
    // 只有一所可比（a），按规则不高亮
    expect(bestIndex([a, b], rowOf("acc"))).toBe(-1);

    // 再加一所可比院校，高亮的应该是两者里录取率更高的那所，且不是缺失的那所
    const cmu = byName("卡耐基梅隆大学");
    const hi = bestIndex([b, a, cmu], rowOf("acc"));
    expect(hi).not.toBe(0); // 下标 0 是缺失值，永不命中
    const winner = [b, a, cmu][hi];
    expect(winner.accNum).not.toBeNull();
  });

  it("不参与高亮的行永远返回 -1", () => {
    for (const key of ["sat", "gpa", "usn", "city", "tags", "note"]) {
      expect(bestIndex([byName("莱斯大学"), byName("纽约大学")], rowOf(key))).toBe(-1);
    }
  });

  it("每行的 text() 都能对 113 所渲染且不抛异常", () => {
    for (const row of COMPARE_ROWS) {
      for (const c of COLLEGES) {
        expect(typeof row.text(c), `${row.key} / ${c.zh}`).toBe("string");
      }
    }
  });
});
