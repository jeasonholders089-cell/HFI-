/**
 * 入口互通的 URL 契约（docs/08 §6.17）—— 纯函数。
 *
 * ```
 * /colleges?from=child&direction=艺术
 * /colleges?from=explore
 * ```
 *
 * **这条契约只影响顶部语境条，不影响任何筛选。**
 * 理由：数据里没有院校与方向的映射，按方向硬筛等于编数据。
 */
import { t, type Lang } from "./colleges-i18n";

export type EntryContext = {
  from: "child" | "explore" | null;
  direction: string | null;
};

/** 解析查询串。`from` 只认这两个值，其余一律当作没有来源。 */
export function parseEntryContext(search: string): EntryContext {
  const p = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const from = p.get("from");
  const direction = p.get("direction");
  return {
    from: from === "child" || from === "explore" ? from : null,
    direction: direction && direction.trim() ? direction.trim() : null,
  };
}

/** 语境条文案；没有来源时返回空串（不渲染这一条）。 */
export function entryContextText(ctx: EntryContext, lang: Lang): string {
  if (ctx.from === "child") {
    return ctx.direction
      ? t(lang, "ctx.fromChild", { direction: ctx.direction })
      : t(lang, "ctx.fromChildNoDir");
  }
  if (ctx.from === "explore") return t(lang, "ctx.fromExplore");
  return "";
}
