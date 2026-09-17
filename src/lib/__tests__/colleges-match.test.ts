import { describe, expect, it } from "vitest";

import { COLLEGES } from "../colleges-data";
import {
  MATCH_DISCLAIMER,
  MATCH_LABEL,
  MATCH_ORDER,
  SAT_MAX,
  SAT_MIN,
  isValidSat,
  matchTag,
  matchWhy,
} from "../colleges-match";
import type { College } from "../colleges-data";

/** 造一个可控的院校，避免依赖真实数据的具体数值。 */
const make = (over: Partial<College>): College =>
  ({
    ...COLLEGES[0],
    satLo: null,
    satHi: null,
    accNum: null,
    ...over,
  }) as College;

describe("matchTag 分档（docs/08 §6.11）", () => {
  it("未开启匹配时返回 null", () => {
    expect(matchTag(COLLEGES[0], null)).toBeNull();
  });

  it("无 SAT 区间：录取率 < 15 记偏冲，否则记看综合", () => {
    expect(matchTag(make({ satLo: null, satHi: null, accNum: 8 }), 1500)).toBe("r");
    expect(matchTag(make({ satLo: null, satHi: null, accNum: 30 }), 1500)).toBe("h");
  });

  it("录取率 < 10 一律偏冲，不管分数多高", () => {
    expect(matchTag(make({ satLo: 1490, satHi: 1560, accNum: 4.4 }), 1600)).toBe("r");
  });

  it("录取率 10–22：分数达上沿才冲·适中", () => {
    expect(matchTag(make({ satLo: 1400, satHi: 1500, accNum: 15 }), 1520)).toBe("rm");
    expect(matchTag(make({ satLo: 1400, satHi: 1500, accNum: 15 }), 1460)).toBe("r");
  });

  it("录取率 22–40：达上沿记适中，上半段记冲·适中，下半段记偏冲", () => {
    const c = make({ satLo: 1400, satHi: 1500, accNum: 35 });
    expect(matchTag(c, 1520)).toBe("m");
    expect(matchTag(c, 1460)).toBe("rm");
    expect(matchTag(c, 1410)).toBe("r");
  });

  it("录取率 40–60：上半段记较稳，下半段记适中，低于下沿记冲·适中", () => {
    const c = make({ satLo: 1400, satHi: 1500, accNum: 50 });
    expect(matchTag(c, 1460)).toBe("s");
    expect(matchTag(c, 1410)).toBe("m");
    expect(matchTag(c, 1300)).toBe("rm");
  });

  it("录取率 >= 60：整体偏宽", () => {
    const c = make({ satLo: 1400, satHi: 1500, accNum: 70 });
    expect(matchTag(c, 1520)).toBe("s");
    expect(matchTag(c, 1410)).toBe("s");
    expect(matchTag(c, 1200)).toBe("m");
  });

  it("边界：分数正好等于 lo / mid / hi", () => {
    const c = make({ satLo: 1400, satHi: 1500, accNum: 35 }); // mid = 1450
    expect(matchTag(c, 1500)).toBe("m"); // >= hi
    expect(matchTag(c, 1450)).toBe("rm"); // >= mid
    expect(matchTag(c, 1400)).toBe("r"); // >= lo，但 acc<40 时 fit=0 -> r
  });

  it("五档都有文案，顺序固定", () => {
    expect(MATCH_ORDER).toEqual(["r", "rm", "m", "s", "h"]);
    for (const t of MATCH_ORDER) expect(MATCH_LABEL[t].length).toBeGreaterThan(0);
  });
});

describe("判断依据与局限说明", () => {
  it("判断依据含四段：SAT 位置 / 录取率 / 未纳入 / 置信度", () => {
    const c = make({ satLo: 1400, satHi: 1500, accNum: 8, sat: "1400-1500", acc: "8.0%" });
    const why = matchWhy(c, 1460);
    expect(why).toContain("位于中位区间上半段");
    expect(why).toContain("整体录取率 8.0%");
    expect(why).toContain("未纳入");
    expect(why).toContain("置信度：低");
  });

  it("判断依据里不出现第三方导流话术（评审 M2 的验收点）", () => {
    for (const c of COLLEGES) {
      const why = matchWhy(c, 1500);
      for (const banned of ["小助手", "顾问", "私信", "定位报告", "会员"]) {
        expect(why.includes(banned), `${c.zh}: ${banned}`).toBe(false);
      }
    }
    for (const banned of ["小助手", "顾问", "私信", "定位报告", "会员"]) {
      expect(MATCH_DISCLAIMER.includes(banned)).toBe(false);
    }
  });

  it("局限说明写明了两维度、置信度低、不构成预测", () => {
    expect(MATCH_DISCLAIMER).toContain("两个维度");
    expect(MATCH_DISCLAIMER).toContain("置信度低");
    expect(MATCH_DISCLAIMER).toContain("不构成录取预测");
  });
});

describe("SAT 输入校验", () => {
  it("范围 400–1600，必须是整数", () => {
    expect(isValidSat(SAT_MIN)).toBe(true);
    expect(isValidSat(SAT_MAX)).toBe(true);
    expect(isValidSat(399)).toBe(false);
    expect(isValidSat(1601)).toBe(false);
    expect(isValidSat(1450.5)).toBe(false);
    expect(isValidSat("1450")).toBe(false);
    expect(isValidSat(NaN)).toBe(false);
  });
});

describe("对全量数据跑一遍，结果都在五档内", () => {
  it("113 所 × 常见分数都能分档", () => {
    for (const sat of [400, 1000, 1300, 1500, 1600]) {
      for (const c of COLLEGES) {
        const t = matchTag(c, sat);
        expect(t).not.toBeNull();
        expect(MATCH_ORDER).toContain(t!);
      }
    }
  });
});
