/**
 * 派生字段的解析与计算 —— 纯函数，可直接单元测试（docs/08 §3.3）。
 *
 * 这里的每个函数都会被构建脚本调用，结果写进 lib/colleges-data.ts。
 * 运行时不解析字符串：组件只读派生好的数值。
 */
import { project } from "./colleges-project";
import type { CollegeRow } from "./colleges-schema";

/**
 * 取字符串里第一个数字；转不出返回 null。「未设线」「—」「test-blind」都会得到 null。
 *
 * 先去掉千分位逗号再匹配 —— 否则 `$68,454(26-27)` 会在逗号处截断成 68。
 * 其余调用方（录取率、比例、GPA）本来就不含逗号，去掉不影响。
 */
export function firstNumber(v: string | null): number | null {
  if (v == null) return null;
  const m = v.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * SAT 中位区间，如 `1490-1560` → `[1490, 1560]`。
 * 非区间返回 null —— 数据里有 9 条是 `test-blind`（加州大学 8 所 + 罗格斯纽瓦克），
 * 它们本来就没有区间，返回 null 是正确行为，分档会走「无区间」分支。
 */
export function parseSat(v: string | null): [number, number] | null {
  if (v == null) return null;
  const m = v.match(/(\d{3,4})\s*-\s*(\d{3,4})/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * 学费：去掉 `$` 和 `,` 后取数。
 * **不大于 1000 视为无效** —— 这是参考实现的保护条件，用来滤掉把学分数当学费之类的脏值。
 */
export function parseTuition(v: string | null): number | null {
  if (v == null) return null;
  const digits = v.replace(/[$,]/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 1000 ? n : null;
}

/**
 * 截止日期 → 可排序的数值，`月 * 100 + 日`。
 * **跨年归一：8 月为学年起点**，1–7 月算作次年（+12 个月），排在 12 月之后。
 * 这样 `1月4日`（104 + 1200 = 1304）会排在 `11月1日`（1101）之后。
 */
export function parseDeadline(v: string | null): number | null {
  if (v == null) return null;
  const m = v.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return (month < 8 ? month + 12 : month) * 100 + day;
}

/** 早申杠杆：早申录取率 ÷ RD 录取率。两者都要能解析出正数。 */
export function parseLever(erNum: number | null, rrNum: number | null): number | null {
  return erNum != null && rrNum != null && erNum > 0 && rrNum > 0 ? erNum / rrNum : null;
}

/** 点色分组。`pub` 只对综合性大学生效。 */
export function typeKeyOf(type: string, pub: number): "uni" | "pub" | "lac" {
  if (type === "lac") return "lac";
  return pub === 1 ? "pub" : "uni";
}

/** 全部派生字段。 */
export type Derived = {
  x: number;
  y: number;
  accNum: number | null;
  erNum: number | null;
  rrNum: number | null;
  trNum: number | null;
  intlNum: number | null;
  gpaNum: number | null;
  qsNum: number | null;
  satLo: number | null;
  satHi: number | null;
  tuitionNum: number | null;
  ddlNum: number | null;
  lever: number | null;
  roundsArr: string[];
  typeKey: "uni" | "pub" | "lac";
  singleRound: boolean;
  hasEarly: boolean;
  hasED: boolean;
  hasREA: boolean;
  abList: string[];
};

export function derive(r: CollegeRow): Derived {
  const [x, y] = project(r.lat, r.lng);
  const accNum = firstNumber(r.acc);
  const erNum = firstNumber(r.er);
  const rrNum = firstNumber(r.rr);
  const band = parseSat(r.sat);
  const roundsArr = r.rounds.split("|").map((s) => s.trim()).filter(Boolean);

  return {
    x,
    y,
    accNum,
    erNum,
    rrNum,
    trNum: firstNumber(r.tr),
    intlNum: firstNumber(r.intl),
    gpaNum: firstNumber(r.gpa),
    qsNum: firstNumber(r.qs),
    satLo: band ? band[0] : null,
    satHi: band ? band[1] : null,
    tuitionNum: parseTuition(r.tuition),
    // 早申截止优先，没有则退回 RD 截止
    ddlNum: parseDeadline(r.ea) ?? parseDeadline(r.rdd),
    lever: parseLever(erNum, rrNum),
    roundsArr,
    typeKey: typeKeyOf(r.type, r.pub),
    singleRound: roundsArr.every((s) => s === "RD"),
    hasEarly: roundsArr.some((s) => s === "EA" || s === "EAR" || s === "REA" || s.startsWith("ED")),
    hasED: roundsArr.some((s) => s.startsWith("ED")),
    hasREA: roundsArr.some((s) => s === "REA" || s === "EAR"),
    abList: r.ab ? r.ab.split("|") : [],
  };
}
