/**
 * 梦想院校人次聚合 + 坐标匹配（docs/11 §3.2 / §3.4）——纯函数，可单测。
 *
 * 只给「人次」不给「谁」：地图与接口都不带姓名（AGENTS.md 第五节）。
 * 未命中坐标的学校**也返回**（matched:false、坐标为 null），这样地图、名单、
 * 图下那行「另有 N 人次未收录坐标」三处同源，不会各算各的。
 *
 * 本模块跑在服务端：它引用了 2468 行的坐标表，import 进客户端组件会把大屏首屏撑大
 * （docs/11 §1.1 / §6.3 第 11 条有 grep 探针守着）。
 */
import { parseUniversities } from "./university-names";
import { COORD_OVERRIDES, COORD_ROWS, type CoordRow } from "./university-coords";
import { buildCoordIndex, buildOverrideMap, locateSchool } from "./school-locate";

export type DreamSchool = {
  /** 展示名：别名表命中时用规范中文名，否则用机构英文名 */
  name: string;
  /** 人次：同一个孩子在同一个学校只计一次 */
  count: number;
  matched: boolean;
  st: string | null;
  lat: number | null;
  lng: number | null;
};

const INDEX = buildCoordIndex(COORD_ROWS);
const OVERRIDES = buildOverrideMap(COORD_OVERRIDES);

/**
 * 从孩子记录聚合梦想院校人次。
 * 口径与页面上原「梦想院校统计」一致，不改：先 `parseUniversities()` 拆词与归一，
 * `Set` 去重 → 同一个孩子在同一个学校只计 1 次；不同孩子累加。
 * 未收录的写法保留原文，避免误合并。
 */
export function aggregateDreamSchools(
  children: readonly { dreamSchool: string | null }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const child of children) {
    const names = new Set(parseUniversities(child.dreamSchool ?? ""));
    for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/**
 * 定位 + 排序：人次降序 → 名字升序。
 * 名字用码位比较（不用 localeCompare）——大屏每次刷新顺序必须一模一样，
 * 不能依赖运行环境的 ICU 排序。
 */
export function buildDreamSchools(
  children: readonly { dreamSchool: string | null }[],
): DreamSchool[] {
  const merged = new Map<string, DreamSchool>();

  for (const [raw, count] of aggregateDreamSchools(children)) {
    const hit = locateSchool(raw, INDEX, OVERRIDES);
    const name = hit ? hit.name : raw;
    const coord: { st: string; lat: number; lng: number } | null = hit
      ? { st: hit.st, lat: hit.lat, lng: hit.lng }
      : null;
    const existing = merged.get(name);
    if (existing) {
      // 两种写法落到同一个展示名：人次相加，坐标以命中的那条为准
      existing.count += count;
      if (coord) {
        existing.matched = true;
        existing.st = coord.st;
        existing.lat = coord.lat;
        existing.lng = coord.lng;
      }
    } else {
      merged.set(name, {
        name,
        count,
        matched: Boolean(coord),
        st: coord?.st ?? null,
        lat: coord?.lat ?? null,
        lng: coord?.lng ?? null,
      });
    }
  }

  return [...merged.values()].sort(
    (a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
}

/** 暴露给测试与联调：当前坐标表规模。 */
export function coordTableSize(): number {
  return COORD_ROWS.length;
}

export type { CoordRow };
