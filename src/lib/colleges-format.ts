/**
 * 空值与数值的展示格式化 —— 纯函数（docs/08 §3.6）。
 *
 * 纪律：**禁止在 JSX 里直接写 `value || "未公布"`** —— `0` 和 `""` 会被误判成空。
 * 一律走这里。
 *
 * 三处空值文案在两种语言下不同（§6.15），所以这些函数都带 `lang`，默认中文 ——
 * 默认值是给测试与构建脚本用的，组件一律显式传当前语言。
 */
import { t, type Lang } from "./colleges-i18n";

export type FieldKind = "text" | "percent" | "rank" | "list" | "count" | "money";

/**
 * 判断"真的为空"：null / undefined / 空字符串。`0` 与 `"0"` 都不算空。
 * 写成类型谓词，这样调用处的 `if (isBlank(v)) return ...` 能把 v 收窄到非空。
 */
export function isBlank(v: unknown): v is null | undefined | "" {
  return v === null || v === undefined || v === "";
}

/** 空值文案：`rank` 是「未上榜」，`list` 是一个破折号，其余是「未公布」。 */
export function blankName(lang: Lang, kind: FieldKind = "text"): string {
  if (kind === "rank") return t(lang, "data.unranked");
  if (kind === "list") return t(lang, "data.dash");
  return t(lang, "data.na");
}

/** 按类型格式化；空值给统一文案。 */
export function formatField(v: unknown, kind: FieldKind = "text", lang: Lang = "zh"): string {
  if (isBlank(v)) return blankName(lang, kind);
  if (kind === "count" && typeof v === "number") {
    return v.toLocaleString(lang === "en" ? "en-US" : "zh-CN");
  }
  return String(v);
}

/** 比例的展示：数据里已是 `13%` 这种字符串，直接透传。 */
export function formatPercent(v: string | null, lang: Lang = "zh"): string {
  return v === null || v.trim() === "" ? blankName(lang, "percent") : v;
}

/** RD 录取率的推算值标注 —— 必须常驻，不得呈现为学校公布值（docs/05 4.6）。 */
export function isExtrapolated(v: string | null): boolean {
  return typeof v === "string" && v.includes("推算");
}

/**
 * 男女比：`女校` 是特例，渲染成文字而不是塞进比例位置（§3.6）。
 * `short` 给表格里的窄列用（女校 / Women's）。
 */
export function formatGenderRatio(v: string | null, lang: Lang = "zh", short = false): string {
  if (isBlank(v)) return blankName(lang, "text");
  if (v === "女校") return t(lang, short ? "data.womenShort" : "data.women");
  return v;
}
