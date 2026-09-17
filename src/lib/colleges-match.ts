/**
 * 黑马匹配（docs/08 §6.11）。
 *
 * 三条边界约束（AGENTS.md 第一节）在实现层的落点：
 *   1. 只出现在 /colleges —— 本模块只被 app/colleges 引用，其他页面不 import；
 *   2. 局限说明**常驻显示**——文案是下面的常量，与分档 UI 同级渲染，且在导出清单里也带；
 *   3. 不与个体画像绑定——userSat 只在本地输入，不落服务端、不与其他页面的孩子数据关联。
 */
import type { College } from "./colleges-data";

/** 五档。这是全站唯一允许出现「冲 / 稳」话术的地方（AGENTS.md 第一节的例外条款）。 */
export type MatchTag = "r" | "rm" | "m" | "s" | "h";

export const MATCH_LABEL: Record<MatchTag, string> = {
  r: "偏冲",
  rm: "冲·适中",
  m: "适中",
  s: "较稳",
  h: "看综合",
};

export const MATCH_ORDER: readonly MatchTag[] = ["r", "rm", "m", "s", "h"];

/** SAT 允许范围（docs/05 H1）。 */
export const SAT_MIN = 400;
export const SAT_MAX = 1600;

/**
 * 分档算法 —— 与参考实现逐行一致，只去掉话术。
 * 只基于「SAT 中位区间 × 整体录取率」两个维度。
 */
export function matchTag(c: College, userSat: number | null): MatchTag | null {
  if (userSat == null) return null;
  const acc = c.accNum;
  const band = c.satLo != null && c.satHi != null ? [c.satLo, c.satHi] : null;
  if (!band) return acc != null && acc < 15 ? "r" : "h";
  const mid = (band[0] + band[1]) / 2;
  const fit = userSat >= band[1] ? 2 : userSat >= mid ? 1 : userSat >= band[0] ? 0 : -1;
  if (acc == null) return fit >= 1 ? "m" : "r";
  if (acc < 10) return "r";
  if (acc < 22) return fit >= 2 ? "rm" : "r";
  if (acc < 40) return fit >= 2 ? "m" : fit >= 1 ? "rm" : "r";
  if (acc < 60) return fit >= 1 ? "s" : fit >= 0 ? "m" : "rm";
  return fit >= 1 ? "s" : fit >= 0 ? "s" : "m";
}

/** 判断依据（H4，悬停徽标可见）。四段由 matchTag 的中间量反推，不另写一套判断。 */
export function matchWhy(c: College, userSat: number): string {
  const parts: string[] = [];
  if (c.satLo != null && c.satHi != null) {
    const mid = (c.satLo + c.satHi) / 2;
    const rel =
      userSat >= c.satHi
        ? "高于中位区间上沿"
        : userSat >= mid
          ? "位于中位区间上半段"
          : userSat >= c.satLo
            ? "位于中位区间下半段"
            : "低于中位区间下沿";
    parts.push(`SAT ${userSat} ${rel}（该校 ${c.sat}）`);
  } else {
    parts.push("该校不看标化或未公布 SAT 区间，仅按录取率参考");
  }
  if (c.accNum != null) {
    parts.push(`整体录取率 ${c.acc}${c.accNum < 10 ? "（低于 10%，对所有人都不轻松）" : ""}`);
  }
  parts.push("未纳入：GPA 与课程体系 / 专业与学院 / 国际生身份 / 资助需求 / 申请批次");
  parts.push("置信度：低 · 仅供参考，不构成录取预测");
  return parts.join("\n");
}

/**
 * 常驻的局限说明。**不折叠、不悬停才出**，与分档 UI 同级渲染；
 * 打印导出的清单里也要带上（第 2 条约束）。
 */
export const MATCH_DISCLAIMER =
  "「初步区间」仅基于「SAT 中位区间 × 整体录取率」两个维度，未纳入 GPA 与课程难度、" +
  "申请专业与学院、国际生身份与就读高中位置、资助需求、ED/EA/RD 批次等关键因素，" +
  "置信度低，不构成录取预测或承诺。";

/** 输入校验。 */
export function isValidSat(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= SAT_MIN && v <= SAT_MAX;
}
