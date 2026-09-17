/**
 * 收藏健康度（docs/08 §6.13 D3）—— 纯函数。
 *
 * 为什么要有这一条：收藏只是"把学校挑出来放着"，很容易挑出一堆同类院校而自己看不出来。
 * 这里只做**客观可验证**的两条提示，不做"你的清单有问题"这类判断。
 *
 * 三条提示与触发条件：
 *   1. 清单里没有「较稳」档 —— **只在黑马匹配开启时**评估（没输入分数就无从判断）；
 *   2. 输入分数之前提示一次「输入 SAT 后可评估底盘」，避免家长以为这里坏了；
 *   3. 同时存在限制性早申（REA / EAR）与 ED 院校 —— 早申名额互斥。
 *
 * 门槛：**收藏数 ≥ 6 才显示**（清单短的时候提示只是噪音）。
 */
import type { College } from "./colleges-data";
import type { TextKey } from "./colleges-i18n";
import { matchTag } from "./colleges-match";

/** 显示门槛（§6.13）。 */
export const HINT_MIN_FAVS = 6;

export type FavHintKey = "no-baseline" | "need-sat" | "restrictive";

export type FavHint = { key: FavHintKey; textKey: TextKey };

const HINT_TEXT: Record<FavHintKey, TextKey> = {
  "no-baseline": "hint.noBaseline",
  "need-sat": "hint.needSat",
  restrictive: "hint.restrictive",
};

/**
 * 求当前收藏清单的健康度提示。返回空数组表示不显示这一栏。
 * `favs` 传 `College[]`（顺序无关），`userSat` 为黑马匹配的输入值。
 */
export function favHints(favs: readonly College[], userSat: number | null): FavHint[] {
  if (favs.length < HINT_MIN_FAVS) return [];

  const out: FavHint[] = [];

  if (userSat === null) {
    out.push({ key: "need-sat", textKey: HINT_TEXT["need-sat"] });
  } else if (!favs.some((c) => matchTag(c, userSat) === "s")) {
    out.push({ key: "no-baseline", textKey: HINT_TEXT["no-baseline"] });
  }

  const hasRestrictive = favs.some((c) => c.hasREA);
  const hasEd = favs.some((c) => c.hasED);
  if (hasRestrictive && hasEd) out.push({ key: "restrictive", textKey: HINT_TEXT.restrictive });

  return out;
}
