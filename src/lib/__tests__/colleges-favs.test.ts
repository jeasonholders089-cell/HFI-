import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import { HINT_MIN_FAVS, favHints } from "../colleges-favs";

/**
 * 收藏健康度（docs/08 §6.13 D3）。
 *
 * 这一栏最容易变成噪音，所以两条门槛都要有断言：
 *   - 收藏数 < 6 一律不显示；
 *   - 「缺底盘」只在输入了 SAT 之后才评估（没输入时改为提示输入）。
 */
describe("收藏健康度（D3）", () => {
  it("少于 6 所不显示任何提示", () => {
    const favs = COLLEGES.slice(0, HINT_MIN_FAVS - 1);
    expect(favHints(favs, null)).toEqual([]);
    expect(favHints(favs, 1500)).toEqual([]);
  });

  it("≥ 6 所且未输入 SAT 时提示先输入分数", () => {
    const favs = COLLEGES.slice(0, 8);
    const hints = favHints(favs, null);
    expect(hints.map((h) => h.key)).toContain("need-sat");
    // 没输入分数就无从判断底盘，所以不出现「缺底盘」那条
    expect(hints.map((h) => h.key)).not.toContain("no-baseline");
  });

  it("输入 SAT 后，清单里没有「较稳」档就提示缺底盘", () => {
    // 只挑录取率极低的学校 —— 无论分数多高都不会落到「较稳」
    const hard = COLLEGES.filter((c) => (c.accNum ?? 100) < 8).slice(0, 8);
    expect(hard.length).toBeGreaterThanOrEqual(HINT_MIN_FAVS);
    const hints = favHints(hard, 1600);
    expect(hints.map((h) => h.key)).toContain("no-baseline");
  });

  it("清单里同时有限制性早申与 ED 院校时提示互斥", () => {
    const restrictive = COLLEGES.filter((c) => c.hasREA).slice(0, 3);
    const ed = COLLEGES.filter((c) => c.hasED).slice(0, 3);
    const favs = [...restrictive, ...ed];
    expect(favs.length).toBeGreaterThanOrEqual(HINT_MIN_FAVS);
    expect(favHints(favs, null).map((h) => h.key)).toContain("restrictive");
  });

  it("只有 REA 没有 ED 时不提示互斥（不能误报）", () => {
    const favs = COLLEGES.filter((c) => c.hasREA && !c.hasED).slice(0, 8);
    expect(favs.length).toBeGreaterThanOrEqual(HINT_MIN_FAVS);
    expect(favHints(favs, null).map((h) => h.key)).not.toContain("restrictive");
  });

  it("每条提示都指向一个存在的词条 key", () => {
    const hard = COLLEGES.filter((c) => (c.accNum ?? 100) < 8).slice(0, 8);
    for (const h of favHints([...hard, ...COLLEGES.filter((c) => c.hasREA).slice(0, 1)], 1600)) {
      expect(["hint.noBaseline", "hint.needSat", "hint.restrictive"]).toContain(h.textKey);
    }
  });
});
