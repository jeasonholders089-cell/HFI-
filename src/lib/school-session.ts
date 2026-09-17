/**
 * 场次（docs/10 §3.7 / docs/11 七、M7）—— 纯函数，可单测。
 *
 * **一天一场，按北京时间算日界。**
 *
 * 为什么不用数据库的 `current_date` / `date(created_at)`：托管库通常跑在 UTC。
 * 活动早上 8 点录入，UTC 还是前一天 24 点——用数据库的"今天"会把这一场算到昨天去，
 * 大屏开场就是空的。中国不实行夏令时（1991 年起），偏移固定 +08:00，
 * 所以这里手算，不引时区库。
 */

/** 北京时间的固定偏移（毫秒）。 */
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** `YYYY-MM-DD` 的合法形状；同时必须是一个真实存在的日期。 */
export function isValidDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  // 2026-02-30 这种会被 Date 规范化成 3 月 2 日，回比一次就能挡住
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** 某一时刻对应的北京时间日期（`YYYY-MM-DD`）。 */
export function beijingDate(at: Date = new Date()): string {
  return new Date(at.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

/** 北京时间的某一天 → `[当日 00:00+08:00, 次日 00:00+08:00)` 的 UTC 区间（左闭右开）。 */
export function beijingDayRange(dateKey: string): { start: Date; end: Date } {
  const start = new Date(`${dateKey}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime())) throw new Error(`日期不合法：${dateKey}`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * 从一批时间戳里算出"有哪些场次"，**按日期倒序**（最近的在最前）。
 * 给大屏的切换器用：只列有数据的日期，避免工作人员点到空场次。
 */
export function sessionDatesOf(times: readonly Date[], limit = 30): string[] {
  const set = new Set<string>();
  for (const t of times) set.add(beijingDate(t));
  return [...set].sort().reverse().slice(0, limit);
}

export type SessionParam = { kind: "day"; date: string } | { kind: "all" };

/**
 * 解析查询参数，**默认今天**。
 *
 * - 空 / 非法 → `{ kind: "day", date: 今天 }`（大屏不带参数时的默认行为）
 * - `all` → 不过滤（等于改版前的口径，工作人员复盘时用）
 * - `YYYY-MM-DD` → 指定场次
 */
export function parseSessionParam(raw: string | null | undefined, now: Date = new Date()): SessionParam {
  const v = (raw ?? "").trim();
  if (v === "all") return { kind: "all" };
  if (isValidDateKey(v)) return { kind: "day", date: v };
  return { kind: "day", date: beijingDate(now) };
}
