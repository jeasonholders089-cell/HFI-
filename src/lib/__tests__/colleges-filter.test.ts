import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import {
  EMPTY_FILTERS,
  INSIGHT_DEFS,
  ROUND_OPTIONS,
  filterColleges,
  hasActiveFilters,
  matchesQuery,
  searchSuggestions,
  type FilterState,
} from "../colleges-filter";

const base = (over: Partial<FilterState> = {}): FilterState => ({
  filters: { ...EMPTY_FILTERS },
  insight: null,
  favOnly: false,
  favs: new Set<string>(),
  userSat: null,
  ...over,
});

describe("洞察榜（docs/08 §6.10）", () => {
  it("五个标签的命中数是 26 / 17 / 42 / 23 / 9（C1 的防复发断言）", () => {
    const counts = INSIGHT_DEFS.map((d) => COLLEGES.filter(d.hit).length);
    expect(counts).toEqual([26, 17, 42, 23, 9]);
  });

  it("「早申倍数高」用的是 er÷rr，不是 er÷acc", () => {
    const ed = INSIGHT_DEFS.find((d) => d.key === "ed")!;
    const byRR = COLLEGES.filter((c) => c.lever != null && c.lever >= 2.5).length;
    const byAcc = COLLEGES.filter((c) => {
      const e = c.erNum;
      const a = c.accNum;
      return e != null && a != null && a > 0 && e / a >= 2.5;
    }).length;
    expect(byRR).toBe(26);
    expect(byAcc).toBe(14); // 用错公式会得到 14
    expect(COLLEGES.filter(ed.hit).length).toBe(byRR);
  });

  it("洞察榜是单选：激活一个就只按那一个筛", () => {
    const only = filterColleges(COLLEGES, base({ insight: "blind" }));
    expect(only).toHaveLength(9);
    expect(only.every((c) => c.test === "blind")).toBe(true);
  });
});

describe("批次筛选（docs/08 §6.6，4 项方案）", () => {
  it("选项就是 4 项，不是 7 项", () => {
    expect(ROUND_OPTIONS.map((o) => o.value)).toEqual(["EA", "ED1", "ED2", "REA"]);
  });

  it("「有 EA」同时命中含 EA 与含 EAR 的院校", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, round: "EA" } }));
    expect(r).toHaveLength(44);
    expect(r.some((c) => c.roundsArr.includes("EAR"))).toBe(true);
    expect(r.some((c) => c.roundsArr.includes("EA"))).toBe(true);
  });

  it("「限制性早申」同时命中 REA 与 EAR", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, round: "REA" } }));
    expect(r).toHaveLength(7);
  });

  it("芝加哥（ED0 + EA + ED1）在 4 项方案下找得到", () => {
    const chi = COLLEGES.find((c) => c.zh === "芝加哥大学")!;
    expect(chi.roundsArr).toContain("ED0");
    expect(ROUND_OPTIONS.some((o) => o.hit(chi))).toBe(true);
  });
});

describe("搜索（docs/08 §6.7）", () => {
  const mit = COLLEGES.find((c) => c.en === "Massachusetts Institute of Technology")!;
  const smith = COLLEGES.find((c) => c.en.includes("Smith"))!;

  it("MIT 命中麻省理工学院（走别名，不是 en 子串）", () => {
    expect(matchesQuery(mit, "MIT")).toBe(true);
  });

  it("mit 不命中 Smith College（短关键词按词首匹配）", () => {
    expect(matchesQuery(smith, "mit")).toBe(false);
  });

  it("CA 命中加州的院校（走州缩写）", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, q: "CA" } }));
    expect(r.length).toBeGreaterThan(10);
    expect(r.every((c) => c.st === "CA" || c.en.toLowerCase().includes("ca") || c.city.toLowerCase().includes("ca") || c.zh.includes("ca") || c.abList.some((a) => a.toLowerCase().includes("ca")))).toBe(true);
  });

  it("Boston 命中波士顿的院校（走 city）", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, q: "Boston" } }));
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((c) => c.city === "Boston")).toBe(true);
  });

  it("中文校名可搜", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, q: "斯坦福" } }));
    expect(r.map((c) => c.zh)).toContain("斯坦福大学");
  });

  it("英文长词按子串匹配", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, q: "university" } }));
    expect(r.length).toBeGreaterThan(50);
  });

  it("联想：不足 2 个字符不给建议，够长时最多 8 条", () => {
    expect(searchSuggestions(COLLEGES, "a")).toHaveLength(0);
    expect(searchSuggestions(COLLEGES, "univ").length).toBeLessThanOrEqual(8);
  });
});

describe("过滤管线（docs/08 §6.6）", () => {
  it("空条件返回全量", () => {
    expect(filterColleges(COLLEGES, base())).toHaveLength(113);
  });

  it("组合筛选是逐步收窄的（不是各自独立求交集）", () => {
    const onlyType = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, type: "lac" } }));
    expect(onlyType).toHaveLength(30);
    const typeAndRegion = filterColleges(
      COLLEGES,
      base({ filters: { ...EMPTY_FILTERS, type: "lac", region: "NE" } }),
    );
    expect(typeAndRegion.length).toBeLessThanOrEqual(onlyType.length);
    expect(typeAndRegion.every((c) => c.type === "lac" && c.rg === "NE")).toBe(true);
  });

  it("只看收藏时只返回收藏里的院校", () => {
    const favs = new Set([COLLEGES[0].en, COLLEGES[5].en]);
    const r = filterColleges(COLLEGES, base({ favOnly: true, favs }));
    expect(r.map((c) => c.en).sort()).toEqual([...favs].sort());
  });

  it("排名筛选按 Top N 生效", () => {
    const r = filterColleges(COLLEGES, base({ filters: { ...EMPTY_FILTERS, rank: "30" } }));
    expect(r.every((c) => c.rank <= 30)).toBe(true);
    expect(r.length).toBe(COLLEGES.filter((c) => c.rank <= 30).length);
  });

  it("洞察榜 + 类型 + 地区 叠加后结果正确", () => {
    const r = filterColleges(
      COLLEGES,
      base({ insight: "tr", filters: { ...EMPTY_FILTERS, type: "uni" } }),
    );
    expect(r.every((c) => c.trNum != null && c.trNum >= 35 && c.type === "uni")).toBe(true);
  });

  it("是否有筛选生效", () => {
    expect(hasActiveFilters(base())).toBe(false);
    expect(hasActiveFilters(base({ insight: "ed" }))).toBe(true);
    expect(hasActiveFilters(base({ favOnly: true }))).toBe(true);
    expect(hasActiveFilters(base({ filters: { ...EMPTY_FILTERS, q: "x" } }))).toBe(true);
  });
});
