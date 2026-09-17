"use client";

import { useMemo, useState } from "react";

import { useLang, useT } from "@/components/colleges/colleges-context";
import type { College } from "@/lib/colleges-data";
import {
  INSIGHT_DEFS,
  ROUND_OPTIONS,
  searchSuggestions,
  type Filters,
  type InsightKey,
} from "@/lib/colleges-filter";
import type { TextKey } from "@/lib/colleges-i18n";
import { nameOf, subNameOf } from "@/lib/colleges-l10n";
import { MATCH_ORDER, matchDisclaimer } from "@/lib/colleges-match";

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
  /** 导出收藏清单（D4）。收藏为空时不渲染这个按钮 */
  onExport: () => void;
  /** 收藏健康度提示（D3），由页面按 favs + userSat 算好 */
  hints: readonly { key: string; textKey: TextKey }[];
  onBrowse: (en: string) => void;
  active: boolean;
};

const REGIONS: { value: string; label: TextKey }[] = [
  { value: "", label: "toolbar.regionAll" },
  { value: "NE", label: "toolbar.regionNE" },
  { value: "S", label: "toolbar.regionS" },
  { value: "MW", label: "toolbar.regionMW" },
  { value: "W", label: "toolbar.regionW" },
];
const TESTS: { value: string; label: TextKey }[] = [
  { value: "", label: "toolbar.testAll" },
  { value: "req", label: "toolbar.testReq" },
  { value: "opt", label: "toolbar.testOpt" },
  { value: "flex", label: "toolbar.testFlex" },
  { value: "blind", label: "toolbar.testBlind" },
];
const RANKS: { value: string; label: TextKey }[] = [
  { value: "", label: "toolbar.rankAll" },
  { value: "30", label: "Top 30" as TextKey },
  { value: "50", label: "Top 50" as TextKey },
];
/** 洞察榜的文案 key（lib 里只放判定，文案在这里）。 */
const INSIGHT_LABEL: Record<InsightKey, TextKey> = {
  ed: "insight.ed",
  intl: "insight.intl",
  tr: "insight.tr",
  calm: "insight.calm",
  blind: "insight.blind",
};
const BAND_LABEL: Record<string, TextKey> = {
  r: "band.r",
  rm: "band.rm",
  m: "band.m",
  s: "band.s",
  h: "band.h",
};

const select =
  "rounded-lg border border-[#d6d2c7] bg-white px-2.5 py-2 text-[0.8125rem] text-[#17382f] outline-none focus:border-[#8b6f45]";

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
  onExport,
  hints,
  onBrowse,
  active,
}: Props) {
  const t = useT();
  const lang = useLang();
  const [focusSuggest, setFocusSuggest] = useState(false);
  const suggestions = useMemo(
    () => (focusSuggest ? searchSuggestions(all, filters.q) : []),
    [all, filters.q, focusSuggest],
  );

  return (
    <div className="mb-5 space-y-3 rounded-xl border border-[#d6d2c7] bg-[#f8f5ed] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-[#d6d2c7] bg-white">
          {(["map", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              aria-pressed={view === v}
              className={`px-4 py-2 text-[0.8125rem] ${
                view === v ? "bg-[#8b6f45] font-medium text-white" : "text-[#50645b]"
              }`}
            >
              {v === "map" ? t("toolbar.map") : t("toolbar.table")}
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
            placeholder={t("toolbar.search")}
            aria-label={t("toolbar.search")}
            className="w-[16rem] rounded-lg border border-[#d6d2c7] bg-white px-3 py-2 text-[0.8125rem] outline-none focus:border-[#8b6f45]"
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
                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-[0.8125rem] hover:bg-[#f5ecdf]"
                  >
                    <span>{nameOf(c, lang)}</span>
                    <span className="text-[0.6875rem] text-[#9aa59c]">{subNameOf(c, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={t("toolbar.typeAll")} value={filters.type} onChange={(e) => onFilters({ type: e.target.value })} className={select}>
          <option value="">{t("toolbar.typeAll")}</option>
          <option value="uni">{t("toolbar.typeUni")}</option>
          <option value="lac">{t("toolbar.typeLac")}</option>
        </select>
        <select aria-label={t("toolbar.regionAll")} value={filters.region} onChange={(e) => onFilters({ region: e.target.value })} className={select}>
          {REGIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label.startsWith("toolbar.") ? t(o.label) : o.label}
            </option>
          ))}
        </select>
        <select aria-label={t("toolbar.roundAll")} value={filters.round} onChange={(e) => onFilters({ round: e.target.value })} className={select}>
          <option value="">{t("toolbar.roundAll")}</option>
          {ROUND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(`toolbar.round${o.value}` as TextKey)}
            </option>
          ))}
        </select>
        <select aria-label={t("toolbar.testAll")} value={filters.test} onChange={(e) => onFilters({ test: e.target.value })} className={select}>
          {TESTS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
        <select aria-label={t("toolbar.rankAll")} value={filters.rank} onChange={(e) => onFilters({ rank: e.target.value })} className={select}>
          {RANKS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label.startsWith("toolbar.") ? t(o.label) : o.label}
            </option>
          ))}
        </select>

        {/* 图例（A9）——形状与地图一致：实心 / 空心 / 菱形 */}
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[0.6875rem] text-[#68786e]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--dot-uni)" }} />
            {t("toolbar.legendUni")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--dot-pub)", background: "white" }} />
            {t("toolbar.legendPub")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ background: "var(--dot-lac)", transform: "rotate(45deg)" }} />
            {t("toolbar.legendLac")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rotate-45 bg-[#68786e]" />
            {t("toolbar.legendCity")}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleFavOnly}
          aria-pressed={favOnly}
          className={`rounded-lg border px-3 py-1.5 text-[0.75rem] ${
            favOnly ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#d6d2c7] bg-white text-[#50645b]"
          }`}
        >
          {t("toolbar.favBtn", { fav: favCount ? `（${favCount}）` : "" })}
        </button>
        {favCount > 0 && (
          <button
            type="button"
            onClick={onExport}
            className="rounded-lg border border-[#8b6f45] bg-white px-3 py-1.5 text-[0.75rem] text-[#8b6f45]"
          >
            {t("exp.button")}
          </button>
        )}
        <button
          type="button"
          onClick={onOpenMatch}
          className={`rounded-lg border px-3 py-1.5 text-[0.75rem] ${
            userSat != null ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#d6d2c7] bg-white text-[#50645b]"
          }`}
        >
          {userSat != null ? t("toolbar.matchOn", { sat: userSat }) : t("toolbar.matchBtn")}
        </button>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-[#a26047] bg-white px-3 py-1.5 text-[0.75rem] text-[#a26047]"
          >
            {t("toolbar.reset")}
          </button>
        )}
      </div>

      {/* 收藏健康度（D3）：≥6 所才显示，最多两条客观提示 */}
      {hints.length > 0 && (
        <ul className="space-y-1 text-[0.6875rem] leading-5 text-[#a26047]">
          {hints.map((h) => (
            <li key={h.key}>· {t(h.textKey)}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
        <span className="font-bold text-[#8b6f45]">{t("toolbar.insights")}</span>
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
              {t(INSIGHT_LABEL[d.key])} {n}
            </button>
          );
        })}
      </div>

      {userSat != null && (
        <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
          <span className="text-[#68786e]">{t("cmp.band")}</span>
          <button
            type="button"
            onClick={() => onFilters({ match: "" })}
            className={`rounded-full border px-3 py-1 ${
              filters.match === "" ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#c9cfc6] bg-white text-[#50645b]"
            }`}
          >
            {t("toolbar.bandAll")}
          </button>
          {MATCH_ORDER.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onFilters({ match: b })}
              className={`rounded-full border px-3 py-1 ${
                filters.match === b ? "border-[#8b6f45] bg-[#f5ecdf] text-[#8b6f45]" : "border-[#c9cfc6] bg-white text-[#50645b]"
              }`}
            >
              {t(BAND_LABEL[b])} {matchCounts[b] ?? 0}
            </button>
          ))}
          <span className="w-full text-[0.6875rem] leading-5 text-[#a26047]">{matchDisclaimer(lang)}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-[#68786e]">
        <span>{t("page.count", { n: resultCount })}</span>
        <span>· {t("page.uni", { n: all.filter((c) => c.type === "uni").length })}</span>
        <span>· {t("page.lac", { n: all.filter((c) => c.type === "lac").length })}</span>
      </div>
    </div>
  );
}
