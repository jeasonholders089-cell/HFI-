/**
 * 梦想院校人次聚合与排序（docs/11 §6.2 B 的 8 条）。
 *
 * 这一组的重点是两件事：
 *   1. **人次口径**：同一个孩子同一所学校只计 1 次（`斯坦福、斯坦福大学` 是一次）；
 *   2. **未命中的不许消失**：地图、名单、图下那句「另有 N 人次未收录坐标」同源，
 *      所以未命中的也必须出现在返回值里（`matched:false`、坐标为 null）。
 */
import { describe, expect, it } from "vitest";

import { aggregateDreamSchools, buildDreamSchools, coordTableSize } from "../dream-schools";

const kids = (...dreamSchool: string[]) => dreamSchool.map((s) => ({ dreamSchool: s }));

describe("aggregateDreamSchools —— 人次口径", () => {
  it("B-1 一个孩子填同一所学校两次（斯坦福、斯坦福大学）只计 1 人次", () => {
    const counts = aggregateDreamSchools(kids("斯坦福、斯坦福大学"));
    expect([...counts.entries()]).toEqual([["斯坦福大学", 1]]);
  });

  it("B-2 三个孩子填同一所计 3 人次", () => {
    const counts = aggregateDreamSchools(kids("罗德岛设计学院", "RISD", "Rhode Island School of Design"));
    expect(counts.get("罗德岛设计学院")).toBe(3);
  });

  it("B-3 一个孩子填两所，两所各 +1，各不相干", () => {
    const counts = aggregateDreamSchools(kids("斯坦福大学、麻省理工学院"));
    expect(counts.get("斯坦福大学")).toBe(1);
    expect(counts.get("麻省理工学院")).toBe(1);
  });

  it("B-4 空数组 / 全空字符串不抛异常", () => {
    expect(buildDreamSchools([])).toEqual([]);
    expect(buildDreamSchools(kids("", "   "))).toEqual([]);
    expect(buildDreamSchools([{ dreamSchool: null }])).toEqual([]);
  });
});

describe("buildDreamSchools —— 定位、返回与排序", () => {
  it("B-5 未命中的学校也返回，且带 matched:false 与空坐标", () => {
    const out = buildDreamSchools(kids("霍格沃茨、斯坦福大学"));
    expect(out).toHaveLength(2);
    const ghost = out.find((s) => s.name === "霍格沃茨");
    expect(ghost).toBeDefined();
    expect(ghost?.matched).toBe(false);
    expect(ghost?.lat).toBeNull();
    expect(ghost?.lng).toBeNull();
    expect(ghost?.st).toBeNull();
    const stanford = out.find((s) => s.name === "斯坦福大学");
    expect(stanford?.matched).toBe(true);
    expect(typeof stanford?.lat).toBe("number");
    expect(stanford?.st).toBe("CA");
  });

  it("B-6 人次总数守恒：所有 count 之和 = 逐条记录各自去重后的学校数之和", () => {
    const input = kids(
      "斯坦福大学、斯坦福、麻省理工学院",
      "霍格沃茨",
      "罗德岛设计学院、RISD",
      "",
    );
    const expected = input.reduce((sum, c) => sum + aggregateDreamSchools([c]).size, 0);
    const total = buildDreamSchools(input).reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(expected);
    expect(total).toBe(4);
  });

  it("B-7 人次降序、同人次按名字升序，且两次调用结果一致", () => {
    const input = kids("斯坦福大学", "斯坦福大学", "麻省理工学院", "麻省理工学院", "耶鲁大学", "布朗大学");
    const a = buildDreamSchools(input);
    const b = buildDreamSchools(input);
    expect(a).toEqual(b);
    expect(a.map((s) => s.count)).toEqual([2, 2, 1, 1]);
    // 同人次（2）的两所按名字升序
    const two = a.filter((s) => s.count === 2).map((s) => s.name);
    expect([...two].sort()).toEqual(two);
  });

  it("B-8 命中别名表时用规范中文名，否则用机构英文名", () => {
    const out = buildDreamSchools(kids("Rhode Island School of Design", "Hampshire College"));
    expect(out.map((s) => s.name).sort()).toEqual(["Hampshire College", "罗德岛设计学院"]);
  });

  it("坐标表已装进产物（2468 所）", () => {
    expect(coordTableSize()).toBe(2468);
  });

  it("别名归一：两种写法在拆词阶段就合并成一所", () => {
    const out = buildDreamSchools(kids("加州艺术学院 CalArts", "加州艺术学院（CalArts）"));
    const calarts = out.find((s) => s.name === "加州艺术学院（CalArts）");
    expect(calarts?.count).toBe(2);
    expect(calarts?.matched).toBe(true);
  });

  it("两条不同的原始写法定位到同一所时，人次相加、坐标以命中的那条为准", () => {
    const out = buildDreamSchools(kids("University of Washington Seattle", "University of Washington-Seattle Campus"));
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("University of Washington-Seattle Campus");
    expect(out[0].count).toBe(2);
    expect(out[0].matched).toBe(true);
    expect(out[0].st).toBe("WA");
  });
});
