/**
 * 对比表：23 行固定 + 1 行条件（黑马匹配开启时插在最前面的「初步区间」）。
 *
 * 行序照参考实现 `cmpRows` 原样（docs/08 §6.12）。
 * **只有 8 行参与最优值高亮** —— SAT 与 GPA 不参与（C2 的更正）。
 */
import type { College } from "./colleges-data";
import type { FieldKind } from "./colleges-format";
import type { Lang } from "./colleges-i18n";
import {
  applicantsText,
  dateTerm,
  formatFieldL,
  genderName,
  idefName,
  leverText,
  pair,
  rankListName,
  roundsText,
  testName,
  typeName,
  ivwName,
} from "./colleges-l10n";

export type CompareRow = {
  key: string;
  /** 中文行名（zh 模式用它） */
  label: string;
  /** 英文行名（en 模式用它） */
  labelEn: string;
  /** 高亮方向；不参与高亮则不填 */
  mode?: "max" | "min";
  /** 取数值用于比较高亮；返回 null 表示这一格缺失 */
  num?: (c: College) => number | null;
  /** 渲染文本 */
  text: (c: College, lang?: Lang) => string;
};

const dash = (v: string | null, kind: FieldKind = "text", lang: Lang = "zh") =>
  formatFieldL(v, kind, lang);

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    key: "name",
    label: "学校",
    labelEn: "School",
    // 参考实现把校名当成第一行数据（不是表头）。我们两边都保留：
    // 表头放校名 + ✕（便于移除），这一行照原样保留，行序与 cmpRows 一致。
    text: (c, lang = "zh") => (lang === "en" ? `${c.en}\n${c.zh}` : `${c.zh}\n${c.en}`),
  },
  {
    key: "usn",
    label: "US News 2026",
    labelEn: "US News 2026",
    text: (c, lang = "zh") =>
      `#${c.rank} · ${rankListName(c, lang)}` +
      (c.chg
        ? lang === "en"
          ? ` (${c.chg > 0 ? "+" : ""}${c.chg} YoY)`
          : `（较去年 ${c.chg > 0 ? "+" : ""}${c.chg}）`
        : ""),
  },
  {
    key: "qs",
    label: "QS 世界 2026",
    labelEn: "QS World 2026",
    text: (c, lang = "zh") => (c.qs ? `#${c.qs}` : dash(null, "rank", lang)),
  },
  {
    key: "city",
    label: "城市 / 州",
    labelEn: "City / State",
    text: (c, lang = "zh") => `${c.city}, ${c.st}\n${pair(c.cz, c.ce, lang)}`,
  },
  {
    key: "type",
    label: "类型",
    labelEn: "Type",
    text: (c, lang = "zh") => typeName(c, lang),
  },
  {
    key: "acc",
    label: "整体录取率",
    labelEn: "Overall acceptance",
    mode: "max",
    num: (c) => c.accNum,
    text: (c, lang = "zh") => dash(c.acc, "percent", lang),
  },
  {
    key: "er",
    label: "早申录取率",
    labelEn: "Early acceptance",
    mode: "max",
    num: (c) => c.erNum,
    text: (c, lang = "zh") => dash(c.er, "percent", lang),
  },
  {
    key: "rr",
    label: "RD 录取率",
    labelEn: "RD acceptance",
    mode: "max",
    num: (c) => c.rrNum,
    // 推算值必须常驻标注（docs/05 4.6）
    text: (c, lang = "zh") => dash(c.rr, "percent", lang),
  },
  {
    key: "lever",
    label: "早申杠杆",
    labelEn: "Early leverage",
    mode: "max",
    num: (c) => c.lever,
    text: (c, lang = "zh") => leverText(c, lang),
  },
  {
    key: "tr",
    label: "转学录取率",
    labelEn: "Transfer acceptance",
    mode: "max",
    num: (c) => c.trNum,
    text: (c, lang = "zh") => dash(c.tr, "percent", lang),
  },
  {
    key: "apps",
    label: "申请人数",
    labelEn: "Applicants",
    mode: "min",
    num: (c) => c.apps,
    text: (c, lang = "zh") => applicantsText(c, lang),
  },
  {
    key: "sat",
    label: "SAT 中位 50%",
    labelEn: "SAT mid 50%",
    // SAT 不参与高亮（C2）
    text: (c, lang = "zh") => dash(c.sat, "text", lang),
  },
  {
    key: "gpa",
    label: "平均 GPA",
    labelEn: "Average GPA",
    text: (c, lang = "zh") => dash(c.gpa, "text", lang),
  },
  {
    key: "test",
    label: "标化政策",
    labelEn: "Testing policy",
    text: (c, lang = "zh") => testName(c.test, lang),
  },
  { key: "rounds", label: "申请批次", labelEn: "Rounds", text: (c) => roundsText(c) },
  {
    key: "ddl",
    label: "截止（早申 / RD）",
    labelEn: "Deadlines (early / RD)",
    text: (c, lang = "zh") => {
      const early = dateTerm(
        c.ea ?? (c.singleRound ? (lang === "en" ? "No early round" : "无早申") : null),
        lang,
      );
      return `${early}\nRD ${dateTerm(c.rdd, lang)}`;
    },
  },
  {
    key: "tuition",
    label: "学费",
    labelEn: "Tuition",
    mode: "min",
    num: (c) => c.tuitionNum,
    text: (c, lang = "zh") => dash(c.tuition, "text", lang),
  },
  {
    key: "intl",
    label: "国际生比例",
    labelEn: "International share",
    mode: "max",
    num: (c) => c.intlNum,
    text: (c, lang = "zh") => dash(c.intl, "percent", lang),
  },
  {
    key: "idef",
    label: "国际生认定",
    labelEn: "International defined by",
    text: (c, lang = "zh") => idefName(c.idef_c, lang, true),
  },
  {
    key: "ivw",
    label: "面试政策",
    labelEn: "Interview policy",
    text: (c, lang = "zh") => ivwName(c.ivw_c, lang),
  },
  { key: "mf", label: "男女比", labelEn: "M:F", text: (c, lang = "zh") => genderName(c.mf, lang) },
  {
    key: "tags",
    label: "院校气质",
    labelEn: "Character",
    text: (c, lang = "zh") => pair(c.tz, c.te, lang).split("|").join(" / "),
  },
  {
    key: "note",
    label: "一句话点评",
    labelEn: "One-line note",
    text: (c, lang = "zh") => pair(c.nz, c.ne, lang),
  },
];

/** 按语言取行名。 */
export function rowLabel(row: CompareRow, lang: Lang): string {
  return lang === "en" ? row.labelEn : row.label;
}

/**
 * 找出这一行该高亮的列下标；不高亮返回 -1。
 * 规则：缺失的不参与；不足两所可比不高亮；**并列时都不高亮**（与参考实现一致）。
 */
export function bestIndex(colleges: readonly College[], row: CompareRow): number {
  if (!row.mode || !row.num) return -1;
  const vals = colleges.map((c) => row.num!(c));
  const ok = vals.filter((v): v is number => v != null);
  if (ok.length < 2) return -1;
  const target = row.mode === "max" ? Math.max(...ok) : Math.min(...ok);
  if (vals.filter((v) => v === target).length > 1) return -1;
  return vals.indexOf(target);
}
