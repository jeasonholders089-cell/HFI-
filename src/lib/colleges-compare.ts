/**
 * 对比表：23 行固定 + 1 行条件（黑马匹配开启时插在最前面的「初步区间」）。
 *
 * 行序照参考实现 `cmpRows` 原样（docs/08 §6.12）。
 * **只有 8 行参与最优值高亮** —— SAT 与 GPA 不参与（C2 的更正）。
 */
import { formatField, formatGenderRatio, isExtrapolated } from "./colleges-format";
import type { College } from "./colleges-data";

export type CompareRow = {
  key: string;
  label: string;
  /** 高亮方向；不参与高亮则不填 */
  mode?: "max" | "min";
  /** 取数值用于比较高亮；返回 null 表示这一格缺失 */
  num?: (c: College) => number | null;
  /** 渲染文本 */
  text: (c: College) => string;
};

const dash = (v: string | null, kind: Parameters<typeof formatField>[1] = "text") =>
  formatField(v, kind);

export const COMPARE_ROWS: readonly CompareRow[] = [
  {
    key: "name",
    label: "学校",
    // 参考实现把校名当成第一行数据（不是表头）。我们两边都保留：
    // 表头放校名 + ✕（便于移除），这一行照原样保留，行序与 cmpRows 一致。
    text: (c) => `${c.zh}\n${c.en}`,
  },
  {
    key: "usn",
    label: "US News 2026",
    text: (c) =>
      `#${c.rank} · ${c.type === "uni" ? "综合大学榜" : "文理学院榜"}` +
      (c.chg ? `（较去年 ${c.chg > 0 ? "+" : ""}${c.chg}）` : ""),
  },
  { key: "qs", label: "QS 世界 2026", text: (c) => (c.qs ? `#${c.qs}` : "未上榜") },
  {
    key: "city",
    label: "城市 / 州",
    text: (c) => `${c.city}, ${c.st}\n${c.cz}`,
  },
  {
    key: "type",
    label: "类型",
    text: (c) =>
      c.type === "lac" ? "文理学院" : c.pub === 1 ? "公立综合性大学" : "私立综合性大学",
  },
  {
    key: "acc",
    label: "整体录取率",
    mode: "max",
    num: (c) => c.accNum,
    text: (c) => dash(c.acc, "percent"),
  },
  {
    key: "er",
    label: "早申录取率",
    mode: "max",
    num: (c) => c.erNum,
    text: (c) => dash(c.er, "percent"),
  },
  {
    key: "rr",
    label: "RD 录取率",
    mode: "max",
    num: (c) => c.rrNum,
    // 推算值必须常驻标注（docs/05 4.6）
    text: (c) => (c.rr ? `${c.rr}${isExtrapolated(c.rr) ? "" : ""}` : "未公布"),
  },
  {
    key: "lever",
    label: "早申杠杆",
    mode: "max",
    num: (c) => c.lever,
    text: (c) => (c.lever != null ? `${c.lever.toFixed(1)}×` : "—"),
  },
  {
    key: "tr",
    label: "转学录取率",
    mode: "max",
    num: (c) => c.trNum,
    text: (c) => dash(c.tr, "percent"),
  },
  {
    key: "apps",
    label: "申请人数",
    mode: "min",
    num: (c) => c.apps,
    text: (c) => (c.apps != null ? `${c.apps.toLocaleString("en-US")} 人` : "未公布"),
  },
  {
    key: "sat",
    label: "SAT 中位 50%",
    // SAT 不参与高亮（C2）
    text: (c) => dash(c.sat),
  },
  { key: "gpa", label: "平均 GPA", text: (c) => dash(c.gpa) },
  {
    key: "test",
    label: "标化政策",
    text: (c) =>
      ({ req: "标化必交", opt: "标化可选", flex: "标化灵活", blind: "不看标化" })[c.test],
  },
  { key: "rounds", label: "申请批次", text: (c) => c.roundsArr.join(" / ") },
  {
    key: "ddl",
    label: "截止（早申 / RD）",
    text: (c) => `${c.ea ?? (c.singleRound ? "无早申" : "—")}\nRD ${c.rdd ?? "—"}`,
  },
  {
    key: "tuition",
    label: "学费",
    mode: "min",
    num: (c) => c.tuitionNum,
    text: (c) => dash(c.tuition),
  },
  {
    key: "intl",
    label: "国际生比例",
    mode: "max",
    num: (c) => c.intlNum,
    text: (c) => dash(c.intl, "percent"),
  },
  {
    key: "idef",
    label: "国际生认定",
    text: (c) =>
      ({ id: "按国籍/永居", hs: "按高中所在地", both: "国籍 + 高中地" } as const)[
        c.idef_c ?? "id"
      ] ?? "—",
  },
  {
    key: "ivw",
    label: "面试政策",
    text: (c) =>
      ({
        req: "必须面试",
        rec: "官方推荐",
        opt: "可选",
        inv: "仅邀请",
        none: "无面试",
        unv: "未核实",
      } as const)[c.ivw_c ?? "unv"] ?? "—",
  },
  { key: "mf", label: "男女比", text: (c) => formatGenderRatio(c.mf) },
  { key: "tags", label: "院校气质", text: (c) => c.tz.split("|").join(" / ") },
  { key: "note", label: "一句话点评", text: (c) => c.nz },
];

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
