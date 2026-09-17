/**
 * 表格视图的列契约与排序（docs/08 §6.8）。
 *
 * 三条排序细节：
 *   1. **缺数据的行在升降序下都排最后**（不是简单取反）；
 *   2. 数值列的首次点击方向："越大越好"的列从降序开始；
 *   3. 主键相同用 rank 兜底，保证顺序稳定。
 */
import { firstNumber } from "./colleges-derive";
import type { College } from "./colleges-data";
import type { Lang, TextKey } from "./colleges-i18n";
import {
  applicantsText,
  dateTerm,
  deadlineText,
  idefName,
  ivwName,
  nameOf,
  pair,
  testName,
  termText,
} from "./colleges-l10n";
import { t } from "./colleges-i18n";

export type SortKey =
  | "rank" | "school" | "city" | "qs" | "acc" | "er" | "rr" | "tr" | "apps" | "intl"
  | "idef" | "mf" | "gpa" | "lang" | "sat" | "test" | "ivw" | "rounds" | "ddl" | "tuition";

/** 枚举序：国际生认定的排序优先级（docs/08 §6.8）。 */
const IDEF_ORDER: Record<string, number> = { hs: 0, both: 1, id: 2 };
/** 枚举序：面试政策。 */
const IVW_ORDER: Record<string, number> = { req: 0, rec: 1, opt: 2, inv: 3, none: 4, unv: 5 };

export type Column = {
  key: SortKey | "tags" | "note" | "detail";
  /** 列名的词条 key（§6.15：表头走词条表，不写死中文） */
  labelKey: TextKey;
  width: number;
  /** 前两列冻结 */
  frozen?: boolean;
  sortable: boolean;
  /** 排序取值；返回 null 表示缺数据（会排最后） */
  sortValue?: (c: College) => number | string | null;
  /** 单元格渲染文本 */
  text: (c: College, lang?: Lang) => string;
};

const n = (v: number | null) => (v == null ? null : v);

/** 取列名（%6.15 表头双语）。 */
export function columnLabel(col: Column, lang: Lang): string {
  return t(lang, col.labelKey);
}

export const COLUMNS: readonly Column[] = [
  {
    key: "rank", labelKey: "col.rank", width: 96, frozen: true, sortable: true,
    sortValue: (c) => c.rank,
    text: (c) => `#${c.rank}${c.chg ? ` (${c.chg > 0 ? "+" : ""}${c.chg})` : ""}`,
  },
  {
    key: "school", labelKey: "col.school", width: 190, frozen: true, sortable: true,
    sortValue: (c) => c.en,
    text: (c, lang = "zh") => nameOf(c, lang),
  },
  {
    key: "city", labelKey: "col.city", width: 150, sortable: true,
    sortValue: (c) => `${c.st}${c.city}`,
    text: (c) => `${c.city}, ${c.st}`,
  },
  {
    key: "qs", labelKey: "col.qs", width: 68, sortable: true,
    sortValue: (c) => n(c.qsNum), text: (c, lang = "zh") => c.qs ?? t(lang, "data.dash"),
  },
  {
    key: "acc", labelKey: "col.acc", width: 70, sortable: true,
    sortValue: (c) => n(c.accNum), text: (c, lang = "zh") => c.acc ?? t(lang, "data.dash"),
  },
  {
    key: "er", labelKey: "col.er", width: 104, sortable: true,
    sortValue: (c) => n(c.erNum), text: (c, lang = "zh") => dashT(c.er, lang),
  },
  {
    key: "rr", labelKey: "col.rr", width: 104, sortable: true,
    sortValue: (c) => n(c.rrNum), text: (c, lang = "zh") => dashT(c.rr, lang),
  },
  {
    key: "tr", labelKey: "col.tr", width: 88, sortable: true,
    sortValue: (c) => n(c.trNum), text: (c, lang = "zh") => dashT(c.tr, lang),
  },
  {
    key: "apps", labelKey: "col.apps", width: 86, sortable: true,
    sortValue: (c) => n(c.apps), text: (c, lang = "zh") => applicantsText(c, lang),
  },
  {
    key: "intl", labelKey: "col.intl", width: 74, sortable: true,
    sortValue: (c) => n(c.intlNum), text: (c, lang = "zh") => c.intl ?? t(lang, "data.dash"),
  },
  {
    key: "idef", labelKey: "col.idef", width: 108, sortable: true,
    sortValue: (c) => (c.idef_c ? IDEF_ORDER[c.idef_c] : null),
    text: (c, lang = "zh") => idefName(c.idef_c, lang, true),
  },
  {
    key: "mf", labelKey: "col.mf", width: 62, sortable: true,
    // 排序用「男占比」数字；"女校" 视为有效值但不是数字 → 排最后
    sortValue: (c) => (c.mf === "女校" ? null : firstNumber(c.mf)),
    text: (c, lang = "zh") =>
      c.mf === "女校" ? t(lang, "data.womenShort") : (c.mf ?? t(lang, "data.dash")),
  },
  {
    key: "gpa", labelKey: "col.gpa", width: 96, sortable: true,
    sortValue: (c) => n(c.gpaNum), text: (c, lang = "zh") => dashT(c.gpa, lang),
  },
  {
    key: "lang", labelKey: "col.lang", width: 150, sortable: true,
    sortValue: (c) => firstNumber(c.toefl),
    text: (c, lang = "zh") => `${dateTerm(c.toefl, lang)} / ${dateTerm(c.ielts, lang)}`,
  },
  {
    key: "sat", labelKey: "col.sat", width: 102, sortable: true,
    sortValue: (c) => n(c.satLo), text: (c, lang = "zh") => c.sat ?? t(lang, "data.dash"),
  },
  {
    key: "test", labelKey: "col.test", width: 94, sortable: true,
    sortValue: (c) => c.test,
    text: (c, lang = "zh") => testName(c.test, lang, true),
  },
  {
    key: "ivw", labelKey: "col.ivw", width: 128, sortable: true,
    sortValue: (c) => (c.ivw_c ? IVW_ORDER[c.ivw_c] : null),
    text: (c, lang = "zh") => ivwName(c.ivw_c, lang, true),
  },
  {
    key: "rounds", labelKey: "col.rounds", width: 128, sortable: true,
    // 按批次**个数**排，不是字典序
    sortValue: (c) => c.roundsArr.length,
    text: (c) => c.roundsArr.join(" / "),
  },
  {
    key: "ddl", labelKey: "col.ddl", width: 142, sortable: true,
    sortValue: (c) => n(c.ddlNum), text: (c, lang = "zh") => deadlineText(c, lang, true),
  },
  {
    key: "tuition", labelKey: "col.tuition", width: 118, sortable: true,
    sortValue: (c) => n(c.tuitionNum), text: (c, lang = "zh") => dashT(c.tuition, lang),
  },
  {
    key: "tags", labelKey: "col.tags", width: 122, sortable: false,
    text: (c, lang = "zh") => pair(c.tz, c.te, lang).split("|").join(" / "),
  },
  {
    key: "note", labelKey: "col.note", width: 300, sortable: false,
    text: (c, lang = "zh") => pair(c.nz, c.ne, lang),
  },
  {
    key: "detail", labelKey: "tbl.detail", width: 58, sortable: false,
    text: (_c, lang = "zh") => t(lang, "tbl.detail"),
  },
];

/** 短数据值：空 → 「—」，非空 → 术语转换后的原文。 */
function dashT(v: string | null, lang: Lang): string {
  return v === null || v.trim() === "" ? t(lang, "data.dash") : termText(v, lang);
}

/** 首次点击就从降序开始的列 ——「越大越好」的那些。 */
const DESC_FIRST: ReadonlySet<string> = new Set([
  "apps",
  "tuition",
  "sat",
  "gpa",
  "intl",
  "er",
  "rr",
  "tr",
  "acc",
]);

export function defaultDirection(key: string): "asc" | "desc" {
  return DESC_FIRST.has(key) ? "desc" : "asc";
}

/** 表头三态：无 → 该列的默认方向 → 反向 → 无。 */
export function nextSort(
  cur: { key: string; dir: "asc" | "desc" } | null,
  key: string,
): { key: string; dir: "asc" | "desc" } | null {
  if (!cur || cur.key !== key) return { key, dir: defaultDirection(key) };
  const first = defaultDirection(key);
  if (cur.dir === first) return { key, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

/** 排序。缺数据永远排最后；相同则用 rank 兜底保证稳定。 */
export function sortColleges(
  list: readonly College[],
  sort: { key: string; dir: "asc" | "desc" } | null,
  lang: Lang = "zh",
): College[] {
  const out = [...list];
  const col = sort ? COLUMNS.find((c) => c.key === sort.key && c.sortable) : null;
  const collator = lang === "en" ? "en" : "zh";
  const by = (c: College) => (lang === "en" ? c.en : c.zh);
  const tie = (a: College, b: College) => a.rank - b.rank || by(a).localeCompare(by(b), collator);

  out.sort((a, b) => {
    if (!sort || !col?.sortValue) {
      // 默认：按 rank 升序，同排名按校名（按当前语言）
      return tie(a, b);
    }
    const va = col.sortValue(a);
    const vb = col.sortValue(b);
    if (va == null && vb == null) return tie(a, b);
    // 缺数据不参与插入，两个方向都排最后
    if (va == null) return 1;
    if (vb == null) return -1;

    let cmp: number;
    if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), collator);
    if (cmp === 0) return tie(a, b);
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return out;
}
