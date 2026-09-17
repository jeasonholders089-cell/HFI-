"use client";

import { useMemo, useState } from "react";

import type { College } from "@/lib/colleges-data";
import {
  EMPTY_FILTERS,
  INSIGHT_DEFS,
  ROUND_OPTIONS,
  searchSuggestions,
  type Filters,
  type InsightKey,
} from "@/lib/colleges-filter";
import { MATCH_DISCLAIMER, MATCH_LABEL, MATCH_ORDER } from "@/lib/colleges-match";

/** 工具栏五行（docs/06 第三节）。图例从地图左下角搬到这里（docs/05 3.2）。 */
type Props = {
  view: "map" | "table";
  onView: (v: "map" | "table") => void;
  all: readonly College[];
  filters: Filters;
  insight: InsightKey | null;
  favOnly: boolean;
  favCount: number;
  resultCount: number;
  userSat: number | null;
  matchCounts: Record<string, number>;
  onFilters: (patch: Partial<Filters>) => void;
  onInsight: (k: InsightKey) => void;
  onToggleFavOnly: () => void;
  onReset: () => void;
  onOpenMatch: () => void;
  onBrowse: (en: string) => void;
  active: boolean;
};

const REGIONS = [
  { value: "", label: "全部地区" },
  { value: "NE", label: "东北部" },
  { value: "S", label: "南部" },
  { value: "MW", label: "中西部" },
  { value: "W", label: "西部" },
];
const TESTS = [
  { value: "", label: "全部标化政策" },
  { value: "req", label: "标化必交" },
  { value: "opt", label: "标化可选" },
  { value: "flex", label: "标化灵活" },
  { value: "blind", label: "不看标化" },
];
const RANKS = [
  { value: "", label: "全部排名" },
  { value: "30", label: "Top 30" },
  { value: "50", label: "Top 50" },
];

const select =
  "rounded-lg border border-[#d6d2c7] bg-white px-2.5 py-2 text-[13px] text-[#17382f] outline-none focus:border-[#8b6f45]";

export function CollegesToolbar({
  view,
  onView,
  all,
  filters,
  insight,
  favOnly,
  favCount,
  resultCount,
  userSat,
  matchCounts,
  onFilters,
  onInsight,
  onToggleFavOnly,
  onReset,
  onOpenMatch,
  onBrowse,
  active,
}: Props) {
  const [focusSuggest, setFocusSuggest] = useState(false);
  const suggestions = useMemo(
    () => (focusSuggest ? searchSuggestions(all, filters.q) : []),
    [all, filters.q, focusSuggest],
  );

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-[#d6d2c7] bg-[#f8f5ed] p-4">
      {/* 第 1 行：视图切换（表格视图在 M5 接入，这里先置灰占位）+ 搜索 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-[#d6d2c7] bg-white">
          {(["map", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              aria-pressed={view === v}
              className={`px-4 py-2 text-[13px] ${
                view === v ? "bg-[#8b6f45] font-medium text-white" : "text-[#50645b]"
              }`}
            >
              {v === "map" ? "地图视图" : "表格视图"}
            </button>
          ))}
        </div>

        <div className="relative">
          <input
            type="text"
            value={filters.q}
            onChange={(e) => onFilters({ q: e.target.value })}
            onFocus={() => setFocusSuggest(true)}
            onBlur={() => setTimeout(() => setFocusSuggest(false), 120)}
            placeholder="搜索学校（中 / 英文）…"
            aria-label="搜索学校"
            className="w-[16rem] rounded-lg border border-[#d6d2c7] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#8b6f45]"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#d6d2c7] bg-white shadow-lg">
              {suggestions.map((c) => (
                <li key={c.en}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onBrowse(c.en);
                      setFocusSuggest(false);
                    }}
                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[13px] hover:bg-[#f5ecdf]"
                  >
                    <span>{c.zh}</span>
                    <span className="text-[11px] text-[#9aa59c]">{c.en}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 第 2 行：五个筛选器 + 图例 */}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="类型" value={filters.type} onChange={(e) => onFilters({ type: e.target.value })} className={select}>
          <option value="">全部类型</option>
          <option value="uni">综合性大学</option>
          <option value="lac">文理学院</option>
        </select>
        <select aria-label="地区" value={filters.region} onChange={(e) => onFilters({ region: e.target.value })} className={select}>
          {REGIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="批次" value={filters.round} onChange={(e) => onFilters({ round: e.target.value })} className={select}>
          <option value="">全部批次</option>
          {ROUND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="标化政策" value={filters.test} onChange={(e) => onFilters({ test: e.target.value })} className={select}>
          {TESTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select aria-label="排名" value={filters.rank} onChange={(e) => onFilters({ rank: e.target.value })} className={select}>
          {RANKS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* 图例（A9）——色点形状与地图一致：实心 / 空心 / 菱形 */}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-[#68786e]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--dot-uni)" }} />
            私立综合
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--dot-pub)", background: "white" }} />
            公立综合
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ background: "var(--dot-lac)", transform: "rotate(45deg)" }}
            />
            文理学院
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rotate-45 bg-[#68786e]" />
            主要城市
          </span>
        </div>
      </div>

      {/* 第 3 行：操作按钮 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleFavOnly}
          aria-pressed={favOnly}
          className={`rounded-lg border px-3 py-1.5 text-[12px] ${
            favOnly ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#d6d2c7] bg-white text-[#50645b]"
          }`}
        >
          我的收藏{favCount ? `（${favCount}）` : ""}
        </button>
        <button
          type="button"
          onClick={onOpenMatch}
          className={`rounded-lg border px-3 py-1.5 text-[12px] ${
            userSat != null ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#d6d2c7] bg-white text-[#50645b]"
          }`}
        >
          {userSat != null ? `SAT ${userSat} 匹配中` : "SAT 初步区间"}
        </button>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-[#a26047] bg-white px-3 py-1.5 text-[12px] text-[#a26047]"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 第 4 行：洞察榜（5 个标签，单选） */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-bold text-[#8b6f45]">洞察榜</span>
        {INSIGHT_DEFS.map((d) => {
          const n = all.filter(d.hit).length;
          const on = insight === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onInsight(d.key)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1 ${
                on ? "border-[#8b6f45] bg-[#8b6f45] text-white" : "border-[#c9cfc6] bg-white text-[#50645b]"
              }`}
            >
              {d.label} {n}
            </button>
          );
        })}
      </div>

      {/* 第 4 行附：匹配档位筛选（仅在开启匹配后出现） */}
      {userSat != null && (
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-[#68786e]">初步区间</span>
          <button
            type="button"
            onClick={() => onFilters({ match: "" })}
            className={`rounded-full border px-3 py-1 ${
              filters.match === "" ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#c9cfc6] bg-white text-[#50645b]"
            }`}
          >
            全部
          </button>
          {MATCH_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onFilters({ match: t })}
              className={`rounded-full border px-3 py-1 ${
                filters.match === t ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#c9cfc6] bg-white text-[#50645b]"
              }`}
            >
              {MATCH_LABEL[t]} {matchCounts[t] ?? 0}
            </button>
          ))}
          <span className="w-full text-[11px] leading-5 text-[#a26047]">{MATCH_DISCLAIMER}</span>
        </div>
      )}

      {/* 第 5 行：计数 */}
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-[#68786e]">
        <span>
          共 <b className="text-[#17382f]">{resultCount}</b> 所院校
        </span>
        <span>· 综合性大学 {all.filter((c) => c.type === "uni").length}</span>
        <span>· 文理学院 {all.filter((c) => c.type === "lac").length}</span>
      </div>
    </div>
  );
}

export { EMPTY_FILTERS };
