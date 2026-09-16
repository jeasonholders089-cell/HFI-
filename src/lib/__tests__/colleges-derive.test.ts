import { describe, expect, it } from "vitest";

import {
  derive,
  firstNumber,
  parseDeadline,
  parseLever,
  parseSat,
  parseTuition,
  typeKeyOf,
} from "../colleges-derive";
import { COLLEGES } from "../colleges-data";
import type { CollegeRow } from "../colleges-schema";

describe("firstNumber —— 数值抽取", () => {
  it("取第一个数字，容忍百分号、货币符号、括号说明", () => {
    expect(firstNumber("4.4%")).toBe(4.4);
    expect(firstNumber("$68,454(26-27)")).toBe(68454);
    expect(firstNumber("8.7%(2028届EA,其后未公布)")).toBe(8.7);
    expect(firstNumber("3.96")).toBe(3.96);
    expect(firstNumber("50:50")).toBe(50);
  });

  it("转不出数字时返回 null", () => {
    expect(firstNumber("未设线")).toBeNull();
    expect(firstNumber("—")).toBeNull();
    expect(firstNumber("")).toBeNull();
    expect(firstNumber(null)).toBeNull();
    expect(firstNumber("test-blind")).toBeNull();
  });
});

describe("parseSat —— SAT 中位区间", () => {
  it("解析两位到四位数的区间", () => {
    expect(parseSat("1490-1560")).toEqual([1490, 1560]);
    expect(parseSat("1000 - 1200")).toEqual([1000, 1200]);
  });

  it("非区间返回 null", () => {
    expect(parseSat("test-blind")).toBeNull();
    expect(parseSat("不参考(test-blind)")).toBeNull();
    expect(parseSat("1500")).toBeNull();
    expect(parseSat(null)).toBeNull();
  });

  it("实测：113 所里 103 所有区间，其余是 test-blind 或缺失", () => {
    const withBand = COLLEGES.filter((c) => c.satLo != null).length;
    expect(withBand).toBe(103);
  });
});

describe("parseTuition —— 学费", () => {
  it("去掉 $ 与逗号后取数", () => {
    expect(parseTuition("$68,454(26-27)")).toBe(68454);
    expect(parseTuition("$73,750")).toBe(73750);
  });

  it("不大于 1000 视为无效（沿用参考实现的保护条件）", () => {
    expect(parseTuition("$900")).toBeNull();
    expect(parseTuition("$1,000")).toBeNull();
    expect(parseTuition("1001")).toBe(1001);
  });

  it("转不出数字返回 null", () => {
    expect(parseTuition(null)).toBeNull();
    expect(parseTuition("以官网为准")).toBeNull();
  });
});

describe("parseDeadline —— 截止日期跨年归一", () => {
  it("8 月及以后按当学年", () => {
    expect(parseDeadline("11月1日(SCEA)")).toBe(1101);
    expect(parseDeadline("8月15日")).toBe(815);
  });

  it("1–7 月算作次年，因此排在 12 月之后", () => {
    expect(parseDeadline("1月4日")).toBe(1304);
    expect(parseDeadline("1月4日")).toBeGreaterThan(parseDeadline("11月1日(SCEA)")!);
    expect(parseDeadline("7月31日")).toBe(1931);
    expect(parseDeadline("7月31日")).toBeGreaterThan(parseDeadline("1月4日")!);
  });

  it("非日期返回 null", () => {
    expect(parseDeadline("无早申")).toBeNull();
    expect(parseDeadline(null)).toBeNull();
    expect(parseDeadline("13月1日")).toBeNull();
    expect(parseDeadline("1月40日")).toBeNull();
  });
});

describe("parseLever —— 早申杠杆（C1 的更正的落点）", () => {
  it("用 er ÷ rr，不是 er ÷ acc", () => {
    expect(parseLever(16.8, 7.1)).toBeCloseTo(2.366, 3);
  });

  it("任一为 null 或非正数时返回 null", () => {
    expect(parseLever(null, 7.1)).toBeNull();
    expect(parseLever(16.8, null)).toBeNull();
    expect(parseLever(0, 7.1)).toBeNull();
    expect(parseLever(16.8, 0)).toBeNull();
  });

  it("实测：113 所里 47 所能算出杠杆", () => {
    expect(COLLEGES.filter((c) => c.lever != null)).toHaveLength(47);
  });
});

describe("typeKeyOf —— 点色分组", () => {
  it("文理学院优先", () => {
    expect(typeKeyOf("lac", 0)).toBe("lac");
    expect(typeKeyOf("lac", 1)).toBe("lac");
  });
  it("pub 只对综合性大学生效", () => {
    expect(typeKeyOf("uni", 0)).toBe("uni");
    expect(typeKeyOf("uni", 1)).toBe("pub");
  });
});

describe("derive —— 派生字段整体", () => {
  it("rounds 按竖线拆成数组", () => {
    const c = COLLEGES.find((x) => x.rounds === "ED1|ED2|RD");
    expect(c?.roundsArr).toEqual(["ED1", "ED2", "RD"]);
  });

  it("singleRound 只对全 RD 的院校为真", () => {
    const lacs = COLLEGES.filter((c) => c.singleRound);
    expect(lacs.every((c) => c.roundsArr.every((r) => r === "RD"))).toBe(true);
    expect(COLLEGES.find((c) => c.en === "Massachusetts Institute of Technology")?.singleRound).toBe(false);
  });

  it("hasED / hasREA 与 roundsArr 一致", () => {
    expect(COLLEGES.find((c) => c.en === "University of Chicago" /* ED0+ED1+ED2 */)?.hasED).toBe(true);
    expect(COLLEGES.filter((c) => c.hasREA)).toHaveLength(7); // REA∪EAR
  });

  it("typeKey 分布与数据一致", () => {
    expect(COLLEGES.filter((c) => c.typeKey === "lac")).toHaveLength(30);
    expect(COLLEGES.filter((c) => c.typeKey === "pub")).toHaveLength(41);
    expect(COLLEGES.filter((c) => c.typeKey === "uni")).toHaveLength(42);
  });

  it("abList 由竖线拆出；无别名为空数组", () => {
    const mit = COLLEGES.find((c) => c.en === "Massachusetts Institute of Technology");
    expect(mit?.abList).toContain("MIT");
    const noAb = COLLEGES.find((c) => c.ab === null);
    expect(noAb?.abList).toEqual([]);
  });

  it("对一条最小行也能跑通（不依赖真实数据）", () => {
    const row = {
      ...COLLEGES[0],
      ab: null,
      er: null,
      rr: null,
      tr: null,
      sat: null,
      gpa: null,
      qs: null,
      tuition: null,
      ea: null,
      rdd: null,
    } as unknown as CollegeRow;
    const d = derive(row);
    expect(d.lever).toBeNull();
    expect(d.satLo).toBeNull();
    expect(d.tuitionNum).toBeNull();
    expect(Number.isFinite(d.x)).toBe(true);
  });
});
