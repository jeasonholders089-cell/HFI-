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

export type SortKey =
  | "rank" | "school" | "city" | "qs" | "acc" | "er" | "rr" | "tr" | "apps" | "intl"
  | "idef" | "mf" | "gpa" | "lang" | "sat" | "test" | "ivw" | "rounds" | "ddl" | "tuition";

/** 枚举序：国际生认定的排序优先级（docs/08 §6.8）。 */
const IDEF_ORDER: Record<string, number> = { hs: 0, both: 1, id: 2 };
/** 枚举序：面试政策。 */
const IVW_ORDER: Record<string, number> = { req: 0, rec: 1, opt: 2, inv: 3, none: 4, unv: 5 };

export type Column = {
  key: SortKey | "tags" | "note" | "detail";
  label: string;
  width: number;
  /** 前两列冻结 */
  frozen?: boolean;
  sortable: boolean;
  /** 排序取值；返回 null 表示缺数据（会排最后） */
  sortValue?: (c: College) => number | string | null;
  /** 单元格渲染文本 */
  text: (c: College) => string;
};

const n = (v: number | null) => (v == null ? null : v);

export const COLUMNS: readonly Column[] = [
  {
    key: "rank", label: "排名·较去年", width: 96, frozen: true, sortable: true,
    sortValue: (c) => c.rank,
    text: (c) => `#${c.rank}${c.chg ? ` (${c.chg > 0 ? "+" : ""}${c.chg})` : ""}`,
  },
  {
    key: "school", label: "学校", width: 190, frozen: true, sortable: true,
    sortValue: (c) => c.zh,
    text: (c) => c.zh,
  },
  {
    key: "city", label: "所在城市", width: 150, sortable: true,
    sortValue: (c) => `${c.st}${c.city}`,
    text: (c) => `${c.city}, ${c.st}`,
  },
  { key: "qs", label: "QS世界", width: 68, sortable: true, sortValue: (c) => n(c.qsNum), text: (c) => c.qs ?? "—" },
  { key: "acc", label: "录取率", width: 70, sortable: true, sortValue: (c) => n(c.accNum), text: (c) => c.acc },
  { key: "er", label: "早申录取率", width: 104, sortable: true, sortValue: (c) => n(c.erNum), text: (c) => c.er ?? "—" },
  { key: "rr", label: "RD录取率", width: 104, sortable: true, sortValue: (c) => n(c.rrNum), text: (c) => c.rr ?? "—" },
  { key: "tr", label: "转学录取率", width: 88, sortable: true, sortValue: (c) => n(c.trNum), text: (c) => c.tr ?? "—" },
  { key: "apps", label: "申请人数", width: 86, sortable: true, sortValue: (c) => n(c.apps), text: (c) => (c.apps != null ? c.apps.toLocaleString("en-US") : "—") },
  { key: "intl", label: "国际生比例", width: 74, sortable: true, sortValue: (c) => n(c.intlNum), text: (c) => c.intl },
  {
    key: "idef", label: "国际生认定", width: 108, sortable: true,
    sortValue: (c) => (c.idef_c ? IDEF_ORDER[c.idef_c] : null),
    text: (c) => ({ id: "按国籍", hs: "按高中地", both: "两者兼看" } as const)[c.idef_c ?? "id"] ?? "—",
  },
  {
    key: "mf", label: "男女比", width: 62, sortable: true,
    // 排序用「男占比」数字；"女校" 视为有效值但不是数字 → 排最后
    sortValue: (c) => (c.mf === "女校" ? null : firstNumber(c.mf)),
    text: (c) => (c.mf === "女校" ? "女校" : (c.mf ?? "—")),
  },
  { key: "gpa", label: "平均GPA", width: 96, sortable: true, sortValue: (c) => n(c.gpaNum), text: (c) => c.gpa ?? "—" },
  { key: "lang", label: "TOEFL / IELTS", width: 150, sortable: true, sortValue: (c) => firstNumber(c.toefl), text: (c) => `${c.toefl} / ${c.ielts}` },
  { key: "sat", label: "SAT中位50%", width: 102, sortable: true, sortValue: (c) => n(c.satLo), text: (c) => c.sat ?? "—" },
  {
    key: "test", label: "标化政策", width: 94, sortable: true,
    sortValue: (c) => c.test,
    text: (c) => ({ req: "必交", opt: "可选", flex: "灵活", blind: "不看" } as const)[c.test],
  },
  {
    key: "ivw", label: "面试政策", width: 128, sortable: true,
    sortValue: (c) => (c.ivw_c ? IVW_ORDER[c.ivw_c] : null),
    text: (c) => ({ req: "必须", rec: "官方推荐", opt: "可选", inv: "仅邀请", none: "无面试", unv: "未核实" } as const)[c.ivw_c ?? "unv"] ?? "—",
  },
  {
    key: "rounds", label: "申请批次", width: 128, sortable: true,
    // 按批次**个数**排，不是字典序
    sortValue: (c) => c.roundsArr.length,
    text: (c) => c.roundsArr.join(" / "),
  },
  { key: "ddl", label: "截止日期", width: 142, sortable: true, sortValue: (c) => n(c.ddlNum), text: (c) => `${c.ea ?? "—"} / ${c.rdd ?? "—"}` },
  { key: "tuition", label: "学费", width: 118, sortable: true, sortValue: (c) => n(c.tuitionNum), text: (c) => c.tuition ?? "—" },
  { key: "tags", label: "院校气质", width: 122, sortable: false, text: (c) => c.tz.split("|").join(" / ") },
  { key: "note", label: "一句话点评", width: 300, sortable: false, text: (c) => c.nz },
  { key: "detail", label: "详情", width: 58, sortable: false, text: () => "详情" },
];

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
): College[] {
  const out = [...list];
  const col = sort ? COLUMNS.find((c) => c.key === sort.key && c.sortable) : null;

  out.sort((a, b) => {
    if (!sort || !col?.sortValue) {
      // 默认：按 rank 升序，同排名按中文名
      return a.rank - b.rank || a.zh.localeCompare(b.zh, "zh");
    }
    const va = col.sortValue(a);
    const vb = col.sortValue(b);
    if (va == null && vb == null) return a.rank - b.rank || a.zh.localeCompare(b.zh, "zh");
    // 缺数据不参与插入，两个方向都排最后
    if (va == null) return 1;
    if (vb == null) return -1;

    let cmp: number;
    if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb), "zh");
    if (cmp === 0) return a.rank - b.rank || a.zh.localeCompare(b.zh, "zh");
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return out;
}
