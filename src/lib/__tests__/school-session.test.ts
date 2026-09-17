import { describe, expect, it } from "vitest";

import {
  beijingDate,
  beijingDayRange,
  isValidDateKey,
  parseSessionParam,
  sessionDatesOf,
} from "../school-session";

/**
 * 场次（docs/10 §3.7 / docs/11 七、M7）：一天一场，按**北京时间**算日界。
 *
 * 这一组里最值钱的是"早上 8 点"那条：托管库跑 UTC，中国早上 8 点的活动在库里
 * 还是前一天 24 点。用数据库的 current_date 会把整场算到昨天去，大屏开场就是空的。
 */
describe("北京时间日界（M7）", () => {
  it("UTC 的深夜属于北京时间的第二天（早上活动的关键边界）", () => {
    // 北京时间 2026-09-18 08:00 === UTC 2026-09-18 00:00
    expect(beijingDate(new Date("2026-09-18T00:00:00Z"))).toBe("2026-09-18");
    // 北京时间 2026-09-18 07:00 === UTC 2026-09-17 23:00 —— 用 UTC 会算成 17 日
    expect(beijingDate(new Date("2026-09-17T23:00:00Z"))).toBe("2026-09-18");
    // 北京时间 2026-09-18 23:59 === UTC 2026-09-18 15:59
    expect(beijingDate(new Date("2026-09-18T15:59:00Z"))).toBe("2026-09-18");
    // 北京时间 2026-09-19 00:01 === UTC 2026-09-18 16:01
    expect(beijingDate(new Date("2026-09-18T16:01:00Z"))).toBe("2026-09-19");
  });

  it("某一天的范围是左闭右开，跨的正好是北京时间的一整天", () => {
    const { start, end } = beijingDayRange("2026-09-18");
    expect(start.toISOString()).toBe("2026-09-17T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-18T16:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
  });

  it("日界对得上：范围里的每一刻都算作那一天，边界那一刻算下一天", () => {
    const { start, end } = beijingDayRange("2026-09-18");
    expect(beijingDate(start)).toBe("2026-09-18");
    expect(beijingDate(new Date(end.getTime() - 1))).toBe("2026-09-18");
    expect(beijingDate(end)).toBe("2026-09-19");
  });
});

describe("日期键校验", () => {
  it("只认真实存在的 YYYY-MM-DD", () => {
    expect(isValidDateKey("2026-09-18")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false); // 会被 Date 规范化成 3 月 2 日
    expect(isValidDateKey("2026-2-8")).toBe(false);
    expect(isValidDateKey("today")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
  });
});

describe("查询参数解析（大屏默认 = 今天）", () => {
  const now = new Date("2026-09-18T03:00:00Z"); // 北京时间 11:00

  it("不带参数 / 非法参数 → 今天", () => {
    expect(parseSessionParam(null, now)).toEqual({ kind: "day", date: "2026-09-18" });
    expect(parseSessionParam("", now)).toEqual({ kind: "day", date: "2026-09-18" });
    expect(parseSessionParam("昨天", now)).toEqual({ kind: "day", date: "2026-09-18" });
    expect(parseSessionParam("2026-13-01", now)).toEqual({ kind: "day", date: "2026-09-18" });
  });

  it("指定日期 → 那个场次", () => {
    expect(parseSessionParam("2026-09-10", now)).toEqual({ kind: "day", date: "2026-09-10" });
  });

  it("all → 全部场次（复盘用，等于改版前的口径）", () => {
    expect(parseSessionParam("all", now)).toEqual({ kind: "all" });
    expect(parseSessionParam(" all ", now)).toEqual({ kind: "all" });
  });
});

describe("场次列表", () => {
  it("去重、按日期倒序（最近的在最前）", () => {
    const times = [
      new Date("2026-09-17T02:00:00Z"), // 北京 9/17 10:00
      new Date("2026-09-18T02:00:00Z"), // 北京 9/18 10:00
      new Date("2026-09-18T06:00:00Z"), // 北京 9/18 14:00（同一天）
      new Date("2026-09-16T20:00:00Z"), // 北京 9/17 04:00（也是 9/17）
    ];
    expect(sessionDatesOf(times)).toEqual(["2026-09-18", "2026-09-17"]);
  });

  it("空输入 → 空数组；超过上限时截断到最近的那些", () => {
    expect(sessionDatesOf([])).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => new Date(Date.UTC(2026, 7, 1 + i, 2)));
    const out = sessionDatesOf(many, 5);
    expect(out).toHaveLength(5);
    expect(out[0] > out[4]).toBe(true);
  });
});
