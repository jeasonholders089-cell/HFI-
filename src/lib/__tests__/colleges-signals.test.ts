import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import { SIGNAL_LIMIT, dataSignals, visibleSignals } from "../colleges-signals";

describe("第 15 节数据信号（docs/08 §6.19）", () => {
  it("113 所全部有内容 —— 这一节不是少数学校才有", () => {
    const withSignals = COLLEGES.filter((c) => dataSignals(c).length > 0);
    expect(withSignals).toHaveLength(113);
  });

  it("每条最多 6 条，且实测上限就是 6（所以等于不截断）", () => {
    const counts = COLLEGES.map((c) => dataSignals(c).length);
    expect(Math.max(...counts)).toBe(6);
    for (const c of COLLEGES) expect(visibleSignals(c).length).toBeLessThanOrEqual(SIGNAL_LIMIT);
  });

  it("命中条数分布与方案记录一致（1–6 条：5/35/48/17/7/1 所）", () => {
    const dist = [0, 0, 0, 0, 0, 0, 0];
    for (const c of COLLEGES) dist[dataSignals(c).length]++;
    expect(dist.slice(1)).toEqual([5, 35, 48, 17, 7, 1]);
  });

  it("只有 8 所会被截断（命中 > 4 条）", () => {
    expect(COLLEGES.filter((c) => dataSignals(c).length > 4)).toHaveLength(8);
  });

  it("保持条件顺序，不做按重要度重排", () => {
    // 波士顿大学命中「早申杠杆」，它应该排在最前（① 是第一个条件）
    const bu = COLLEGES.find((c) => c.zh === "波士顿大学");
    expect(bu).toBeDefined();
    expect(dataSignals(bu!)[0].key).toMatch(/^lever-/);
  });

  it("文案里不出现第三方导流话术（评审 M2）", () => {
    const banned = ["小助手", "顾问", "私信", "定位报告", "点评", "会员"];
    for (const c of COLLEGES) {
      for (const s of dataSignals(c)) {
        for (const b of banned) {
          expect(s.text.includes(b), `${c.zh} 的信号里出现了「${b}」：${s.text}`).toBe(false);
        }
      }
    }
  });

  it("早申杠杆那条用的是 er÷rr（C1 的防复发断言）", () => {
    const rice = COLLEGES.find((c) => c.en === "Rice University");
    expect(rice).toBeDefined();
    // Rice: er 16.8% / rr 7.1% => 2.366 -> 显示 2.4 倍
    const lever = dataSignals(rice!).find((s) => s.key.startsWith("lever-"));
    expect(lever?.text).toContain("2.4 倍");
  });

  it("单轮申请（全 RD）的学校命中「单轮无早申」", () => {
    const single = COLLEGES.find((c) => c.singleRound);
    expect(single).toBeDefined();
    expect(dataSignals(single!).some((s) => s.key === "single-round")).toBe(true);
  });

  it("Test-Blind 学校命中「完全不看标化」", () => {
    const blind = COLLEGES.find((c) => c.test === "blind");
    expect(blind).toBeDefined();
    expect(dataSignals(blind!).some((s) => s.key === "test-blind")).toBe(true);
  });
});
