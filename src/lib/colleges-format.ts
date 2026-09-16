/**
 * 空值与数值的展示格式化 —— 纯函数（docs/08 §3.6）。
 *
 * 纪律：**禁止在 JSX 里直接写 `value || "未公布"`** —— `0` 和 `""` 会被误判成空。
 * 一律走这里。
 */

export type FieldKind = "text" | "percent" | "rank" | "list" | "count" | "money";

const NA = "未公布";

/**
 * 判断"真的为空"：null / undefined / 空字符串。`0` 与 `"0"` 都不算空。
 * 写成类型谓词，这样调用处的 `if (isBlank(v)) return ...` 能把 v 收窄到非空。
 */
export function isBlank(v: unknown): v is null | undefined | "" {
  return v === null || v === undefined || v === "";
}

/** 按类型格式化；空值给统一文案。 */
export function formatField(v: unknown, kind: FieldKind = "text"): string {
  if (isBlank(v)) {
    switch (kind) {
      case "rank":
        return "未上榜";
      case "list":
        return "—";
      default:
        return NA;
    }
  }
  if (kind === "count" && typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

/** 比例的展示：数据里已是 `13%` 这种字符串，直接透传。 */
export function formatPercent(v: string | null): string {
  return v === null || v.trim() === "" ? NA : v;
}

/** RD 录取率的推算值标注 —— 必须常驻，不得呈现为学校公布值（docs/05 4.6）。 */
export function isExtrapolated(v: string | null): boolean {
  return typeof v === "string" && v.includes("推算");
}

/** 男女生比："女校" 是特例，渲染成文字而不是塞进比例位置。 */
export function formatGenderRatio(v: string | null): string {
  if (isBlank(v)) return NA;
  return v === "女校" ? "女子学院" : v;
}
