/**
 * 院校名 → 坐标的匹配（docs/11 §3.1 / §3.3）——纯函数，可单测。
 *
 * 三级 + 唯一性闸，任何一级命中超过 1 条一律视为「未命中」：
 *   ① 别名表（规范中文名 → 它的全部写法，先精确后唯一包含）
 *   ② 精确匹配（归一化后与机构名完全相同）
 *   ③ 唯一包含匹配（互相包含，且只命中一所）
 *   ④ 人工覆盖表（帕森斯这类「学院挂在大学下」）
 *
 * 宁可少一个点，也不要在大屏上把「华盛顿大学」标到 Bothell 去。
 */
import type { CoordRow } from "./university-coords";
import { aliasNamesOf, lookupUniversity } from "./university-names";

/** 命中来源：联调时能一眼看出这个点是从哪一级来的。 */
export type LocateVia = "colleges" | "alias" | "exact" | "contain" | "override";

export type SchoolHit = {
  /** 展示名：优先用别名表的规范中文名，否则用机构英文名 */
  name: string;
  /** 别名表命中时才有 */
  zh: string | null;
  nameEn: string;
  st: string;
  city: string;
  lat: number;
  lng: number;
  via: LocateVia;
};

/**
 * 归一化只做四件事（docs/11 §3.3），多一件都不做：
 *   1. NFKC（全角→半角）
 *   2. 转小写
 *   3. 去掉空格与标点 `.,·’'“”"-–—()（）&`
 *   4. 去掉结尾的 `main campus` / `main`
 *
 * 第 4 条是实测后补的：Scorecard 里主校区常写成 `X-Main Campus`
 * （`Georgia Institute of Technology-Main Campus`），只去 `main` 拦不住 `maincampus`，
 * 佐治亚理工、宾州州立这一批会全部落空。`Pratt Institute-Main` 靠同一条规则命中。
 *
 * 刻意不做：不去 `The` 前缀、不去 `University`/`College` 后缀、不做词序调整与缩写扩展
 * —— 那些会误合并（`Boston University` 与 `Boston College` 是两所学校），
 * 缺失的写法靠别名表人工维护。
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s.,，。·’'“”"\-–—()（）&]/g, "")
    .replace(/maincampus$/, "")
    .replace(/main$/, "");
}

/**
 * 建索引：归一化后的机构名 → 行。
 * **重名的整组不进索引**（实测 15 组，如三个州各一所 `Lincoln University`）——
 * 唯一性闸因此是索引的性质，而不是查询路径上的一个分支。
 */
export function buildCoordIndex(rows: readonly CoordRow[]): ReadonlyMap<string, CoordRow> {
  const groups = new Map<string, CoordRow[]>();
  for (const row of rows) {
    const k = normalizeName(row[0]);
    if (!k) continue;
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  const index = new Map<string, CoordRow>();
  for (const [k, list] of groups) if (list.length === 1) index.set(k, list[0]);
  return index;
}

/** 人工覆盖表：键会被归一化，调用方直接用生成产物里的原始键即可。 */
export function buildOverrideMap(source: Record<string, CoordRow>): ReadonlyMap<string, CoordRow> {
  const map = new Map<string, CoordRow>();
  for (const [k, row] of Object.entries(source)) map.set(normalizeName(k), row);
  return map;
}

function toHit(row: CoordRow, zh: string | null, via: LocateVia): SchoolHit {
  return {
    name: zh ?? row[0],
    zh,
    nameEn: row[0],
    st: row[2],
    city: row[1],
    lat: row[3],
    lng: row[4],
    via,
  };
}

/** 唯一化：0 条或 ≥2 条都返回 null（歧义一律算没命中）。 */
function onlyRow(rows: readonly CoordRow[]): CoordRow | null {
  if (!rows.length) return null;
  const uniq = [...new Set(rows)];
  return uniq.length === 1 ? uniq[0] : null;
}

/** 互相包含的候选；命中超过 1 所由 onlyRow 拦掉。 */
function containCandidates(
  keys: readonly string[],
  index: ReadonlyMap<string, CoordRow>,
): CoordRow[] {
  const out: CoordRow[] = [];
  for (const [k, row] of index) {
    if (k.length < 4) continue; // 太短的键不做包含，避免 `Yale` 这类片段误伤
    for (const q of keys) {
      if (!q || q.length < 4) continue;
      if (k.includes(q) || q.includes(k)) {
        out.push(row);
        break;
      }
    }
  }
  return out;
}

/**
 * 单个名字 → 坐标；命中不唯一或全不命中 → null。
 * 顺序固定：④覆盖 → ①别名 → ②精确 → ③唯一包含，每级命中即返回。
 * **覆盖表排在最前**：它是人工决定（每条都带 reason + source），
 * 不该被一条偶然的包含匹配抢先——否则「帕森斯设计学院」会靠别名里的
 * `Parsons The New School for Design` 恰好包含 `The New School` 命中，
 * 覆盖表就成了永远走不到的死代码。
 * `via === "colleges"` 在调用方按「113 表更优先」处理，这里不产生。
 */
export function locateSchool(
  raw: string,
  index: ReadonlyMap<string, CoordRow>,
  overrides: ReadonlyMap<string, CoordRow>,
): SchoolHit | null {
  const clean = (raw ?? "").trim();
  if (!clean) return null;

  const canonical = lookupUniversity(clean);

  // —— ④ 人工覆盖（优先于其它三级）——
  const override = overrides.get(normalizeName(canonical ?? clean));
  if (override) return toHit(override, canonical ?? clean, "override");

  // —— ① 别名表 ——
  if (canonical) {
    const names = aliasNamesOf(canonical);
    const keys = names.map(normalizeName).filter(Boolean);
    const exact = onlyRow(keys.map((k) => index.get(k)).filter((r): r is CoordRow => Boolean(r)));
    if (exact) return toHit(exact, canonical, "alias");
    const contained = onlyRow(containCandidates(keys, index));
    if (contained) return toHit(contained, canonical, "alias");
  }

  // —— ② 精确 ——
  const key = normalizeName(clean);
  if (!key) return null;
  const exact = index.get(key);
  if (exact) return toHit(exact, null, "exact");

  // —— ③ 唯一包含 ——
  const contained = onlyRow(containCandidates([key], index));
  if (contained) return toHit(contained, null, "contain");

  return null;
}
