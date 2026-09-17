/**
 * 过滤管线与搜索（docs/08 §6.6 / §6.7 / §6.10）。
 *
 * 顺序**定死不可调**（9 步）—— 和参考实现 filtered() 的判定顺序一致。
 * 顺序会影响结果，尤其与黑马匹配、洞察榜组合时。
 */
import type { College } from "./colleges-data";
import { matchTag, type MatchTag } from "./colleges-match";

/** 洞察榜标签。阈值是常量，命中数由实时计算得出。 */
export type InsightKey = "ed" | "intl" | "tr" | "calm" | "blind";

export type InsightDef = { key: InsightKey; label: string; hit: (c: College) => boolean };

export const INSIGHT_DEFS: readonly InsightDef[] = [
  // C1 的防复发点：lever 是 早申 ÷ RD，不是 早申 ÷ 整体录取率
  { key: "ed", label: "早申倍数高", hit: (c) => c.lever != null && c.lever >= 2.5 },
  { key: "intl", label: "国际生占比高", hit: (c) => c.intlNum != null && c.intlNum >= 15 },
  { key: "tr", label: "转学率较高", hit: (c) => c.trNum != null && c.trNum >= 35 },
  { key: "calm", label: "申请池较小", hit: (c) => c.apps != null && c.apps < 12000 },
  { key: "blind", label: "不看标化", hit: (c) => c.test === "blind" },
];

export type RoundOption = { value: string; label: string; hit: (c: College) => boolean };

/** 批次筛选的四项判定。有 EA 命中 EA∪EAR；限制性早申命中 REA∪EAR。 */
export const ROUND_OPTIONS: readonly RoundOption[] = [
  {
    value: "EA",
    label: "有 EA（含 EAR）",
    hit: (c) => c.roundsArr.includes("EA") || c.roundsArr.includes("EAR"),
  },
  { value: "ED1", label: "有 ED1", hit: (c) => c.roundsArr.includes("ED1") },
  { value: "ED2", label: "有 ED2", hit: (c) => c.roundsArr.includes("ED2") },
  {
    value: "REA",
    label: "限制性早申（REA / EAR）",
    hit: (c) => c.roundsArr.includes("REA") || c.roundsArr.includes("EAR"),
  },
];

export type Filters = {
  q: string;
  type: string;
  region: string;
  round: string;
  test: string;
  rank: string;
  match: string;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  type: "",
  region: "",
  round: "",
  test: "",
  rank: "",
  match: "",
};

export type FilterState = {
  filters: Filters;
  insight: InsightKey | null;
  favOnly: boolean;
  favs: ReadonlySet<string>;
  userSat: number | null;
};

/** 搜索：**没有归一化步骤**，直接用小写原文匹配（docs/08 §6.7）。 */
export function matchesQuery(c: College, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;

  const en = c.en.toLowerCase();
  const enHit =
    q.length >= 4
      ? en.includes(q)
      : // 短关键词按「词首」匹配，防 mit 命中 Smith
        en.split(/[^a-z0-9&]+/).some((w) => w.length > 0 && w.startsWith(q));

  const abHit = c.abList.some((a) => {
    const al = a.toLowerCase();
    return (
      al === q ||
      al.startsWith(q) ||
      (q.length >= 3 && al.includes(q)) ||
      q.split(/\s+/).includes(al)
    );
  });

  return (
    enHit ||
    abHit ||
    c.zh.includes(q) ||
    c.city.toLowerCase().includes(q) ||
    c.st.toLowerCase().includes(q)
  );
}

/** 过滤管线：9 步，顺序不可调。 */
export function filterColleges(all: readonly College[], state: FilterState): College[] {
  const { filters: f, insight, favOnly, favs, userSat } = state;
  return all.filter((c) => {
    if (favOnly && !favs.has(c.en)) return false;
    if (insight) {
      const def = INSIGHT_DEFS.find((d) => d.key === insight);
      if (def && !def.hit(c)) return false;
    }
    if (f.match) {
      const tag: MatchTag | null = matchTag(c, userSat);
      if (tag !== f.match) return false;
    }
    if (f.type && c.type !== f.type) return false;
    if (f.region && c.rg !== f.region) return false;
    if (f.round) {
      const opt = ROUND_OPTIONS.find((o) => o.value === f.round);
      if (opt && !opt.hit(c)) return false;
    }
    if (f.test && c.test !== f.test) return false;
    if (f.rank && c.rank > Number(f.rank)) return false;
    if (f.q && !matchesQuery(c, f.q)) return false;
    return true;
  });
}

/** 搜索联想：输入 2 个字符以上，取前 8 条。 */
export function searchSuggestions(all: readonly College[], raw: string, limit = 8): College[] {
  const q = raw.trim();
  if (q.length < 2) return [];
  return all.filter((c) => matchesQuery(c, q)).slice(0, limit);
}

/** 是否有任一筛选生效（决定「清除筛选」按钮是否出现）。 */
export function hasActiveFilters(state: FilterState): boolean {
  const { filters: f, insight, favOnly } = state;
  return favOnly || insight !== null || Object.values(f).some((v) => v !== "");
}
