/**
 * 「画像是否已生成」的判定 —— 抽成共享函数（2026-09-18）。
 *
 * 为什么必须共享：首页（判断今天还有几个孩子没画像）和 `/explore`（三个数字、待分析清单）
 * 用的是**同一个概念**。两处各写一份迟早会漂移——那时会出现"首页说都生成好了、大屏说还有待分析"，
 * 而两个页面看上去都很正常。
 *
 * 判定口径：`ai_directions` 恰好是 3 个方向（与产品定义一致：AI 必须输出 3 个学术方向）。
 * **注意它不看类别合不合法**——类别合法性是"已分类"（用于方向统计），是另一件事。
 */

export type ProfileRow = { id: number; aiDirections: string | null };

/** 有画像 = `ai_directions` 能解析出恰好 3 个方向。 */
export function hasProfile(aiDirections: string | null): boolean {
  try {
    return JSON.parse(aiDirections || "[]").length === 3;
  } catch {
    return false;
  }
}

/** 从一批记录里挑出还没有画像的 id（首页的「还有 N 个孩子没有画像」用它）。 */
export function pendingProfileIds(rows: readonly ProfileRow[]): number[] {
  return rows.filter((r) => !hasProfile(r.aiDirections)).map((r) => r.id);
}
