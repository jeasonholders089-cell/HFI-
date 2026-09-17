"use client";

import Link from "next/link";
import { useCallback, useMemo, useReducer, useRef, useState } from "react";

import { CompareModal } from "@/components/colleges/compare-modal";
import { CompareSlots } from "@/components/colleges/compare-slots";
import { CollegesMap, type CollegesMapHandle } from "@/components/colleges/colleges-map";
import { CollegesToolbar } from "@/components/colleges/colleges-toolbar";
import { CollegesTable } from "@/components/colleges/colleges-table";
import { MatchModal } from "@/components/colleges/match-modal";
import { SchoolProfile } from "@/components/colleges/school-profile";
import { SiteNav } from "@/components/site-nav";
import { COLLEGES } from "@/lib/colleges-data";
import {
  EMPTY_FILTERS,
  filterColleges,
  hasActiveFilters,
  type Filters,
  type InsightKey,
} from "@/lib/colleges-filter";
import { MATCH_LABEL, matchTag, matchWhy, type MatchTag } from "@/lib/colleges-match";
import { initialSlotState, slotReducer } from "@/lib/colleges-slots";
import { setSatPref, toggleFavPref, useCollegePrefs } from "@/lib/colleges-prefs";

/**
 * 选校地图（docs/05 v0.6 / docs/08 v0.4）。
 *
 * 一期**不新增后端接口**：数据在构建期编译进 bundle，整页零网络请求（docs/08 §2.1）。
 * 表格视图与中英切换/字号三档在 M5/M6 接入。
 */
export default function CollegesPage() {
  // 对比位状态机走 lib/colleges-slots.ts —— 单测覆盖的就是这份逻辑
  const [slotState, dispatch] = useReducer(slotReducer, undefined, initialSlotState);
  const { browsing: selected, slots } = slotState;
  const [compareRequested, setCompareRequested] = useState(false);
  const [view, setView] = useState<"map" | "table">("map");
  const mapRef = useRef<CollegesMapHandle | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [insight, setInsight] = useState<InsightKey | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  // 收藏与匹配分数来自外部存储（docs/08 §6.1）—— 刷新后仍在，
  // 且 hydration 由 useSyncExternalStore 处理，不用 effect + setState。
  const prefs = useCollegePrefs();
  const userSat = prefs.sat;
  const favs = useMemo(() => new Set(prefs.favs), [prefs.favs]);

  const visible = useMemo(
    () => filterColleges(COLLEGES, { filters, insight, favOnly, favs, userSat }),
    [filters, insight, favOnly, favs, userSat],
  );

  /** 分档结果只算一次，地图/卡片/对比表都从这里读（H3 的三处同步）。 */
  const matchTags = useMemo(() => {
    if (userSat == null) return null;
    const m = new Map<string, MatchTag | null>();
    for (const c of COLLEGES) m.set(c.en, matchTag(c, userSat));
    return m;
  }, [userSat]);

  const matchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!matchTags) return counts;
    for (const t of matchTags.values()) if (t) counts[t] = (counts[t] ?? 0) + 1;
    return counts;
  }, [matchTags]);

  const current = useMemo(
    () => (selected ? COLLEGES.find((c) => c.en === selected) ?? null : null),
    [selected],
  );
  const slotColleges = useMemo(
    () => slots.map((en) => COLLEGES.find((c) => c.en === en)).filter((c): c is (typeof COLLEGES)[number] => !!c),
    [slots],
  );

  // 唯一的写入口。browse 走 BROWSE —— 只改浏览位，**不动 slots**（核心不变量）。
  const browse = useCallback((en: string) => dispatch({ type: "BROWSE", en }), []);
  const closeBrowse = useCallback(() => dispatch({ type: "CLOSE_BROWSE" }), []);
  const addSlot = useCallback((en: string) => dispatch({ type: "ADD", en }), []);
  const removeSlot = useCallback((en: string) => dispatch({ type: "REMOVE", en }), []);
  const clearSlots = useCallback(() => {
    dispatch({ type: "CLEAR" });
    setCompareRequested(false);
  }, []);

  const compareOpen = compareRequested && slots.length >= 2;
  const active = hasActiveFilters({ filters, insight, favOnly, favs, userSat });

  const toggleFav = (en: string) => toggleFavPref(en);

  /** E4：点表格行 → 切回地图 → 把该点移到视口中心 → 浏览位打开它。 */
  const openFromTable = useCallback((en: string) => {
    setView("map");
    browse(en);
    // 视口居中放在下一帧，避免与视图切换同批渲染
    requestAnimationFrame(() => mapRef.current?.focusOn(en));
  }, [browse]);

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setInsight(null);
    setFavOnly(false);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f0e6] text-[#17382f]">
      <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-8 py-6">
        <Link href="/" className="text-xl tracking-[.18em]">
          HFI 家长成长营
        </Link>
        <SiteNav />
      </header>

      <div className="mx-auto w-full max-w-[1600px] flex-1 px-8 pb-8">
        <div className="mb-5">
          <p className="text-xs tracking-[.3em] text-[#8b6f45]">US COLLEGE MAP · 2026</p>
          <h1 className="mt-2 text-3xl font-light">美国有哪些学校，都在哪儿</h1>
        </div>

        <CollegesToolbar
          view={view}
          onView={setView}
          all={COLLEGES}
          filters={filters}
          insight={insight}
          favOnly={favOnly}
          favCount={favs.size}
          resultCount={visible.length}
          userSat={userSat}
          matchCounts={matchCounts}
          onFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onInsight={(k) => setInsight((prev) => (prev === k ? null : k))}
          onToggleFavOnly={() => setFavOnly((v) => !v)}
          onReset={resetAll}
          onOpenMatch={() => setMatchOpen(true)}
          onBrowse={browse}
          active={active}
        />

        {/* 地图区与详情栏：固定比例，不做拖拽（docs/05 3.5） */}
        <div className="grid gap-5 lg:grid-cols-[62fr_38fr]">
          {view === "map" ? (
            <section className="h-[58vh] min-h-[380px] overflow-hidden rounded-xl border border-[#d6d2c7]">
              {visible.length ? (
                <CollegesMap
                  ref={mapRef}
                  colleges={visible}
                  selected={selected}
                  slots={slots}
                  matchTags={matchTags}
                  onSelect={browse}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#e8e6dc]">
                  <p className="text-sm text-[#50645b]">没有符合条件的学校</p>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded-lg border border-[#8b6f45] px-4 py-2 text-sm text-[#8b6f45]"
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section>
              <CollegesTable
                colleges={visible}
                favs={favs}
                onToggleFav={toggleFav}
                onOpenDetail={openFromTable}
                onRowClick={openFromTable}
              />
            </section>
          )}

          <aside className="flex min-h-[380px] flex-col overflow-hidden rounded-xl border border-[#d6d2c7]">
            {/* ① 对比位：顶部常驻 */}
            <CompareSlots
              colleges={COLLEGES}
              slots={slots}
              canCompare={slots.length >= 2}
              onPick={browse}
              onRemove={removeSlot}
              onClear={clearSlots}
              onCompare={() => setCompareRequested(true)}
            />

            {/* ② 浏览位：中间可滚动 */}
            <div className="min-h-0 flex-1 bg-[#f8f5ed]">
              {current ? (
                <SchoolProfile
                  college={current}
                  inSlot={slots.includes(current.en)}
                  slotsFull={slots.length >= 3}
                  isFav={favs.has(current.en)}
                  matchLabel={userSat != null ? MATCH_LABEL[matchTags?.get(current.en) ?? "h"] : null}
                  matchWhyText={userSat != null ? matchWhy(current, userSat) : null}
                  onToggleSlot={() =>
                    slots.includes(current.en) ? removeSlot(current.en) : addSlot(current.en)
                  }
                  onToggleFav={() => toggleFav(current.en)}
                  onClose={closeBrowse}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <p className="text-sm text-[#68786e]">点地图上的圆点</p>
                  <p className="text-sm text-[#68786e]">查看院校详情</p>
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="mt-6 border-t border-[#d6d2c7] pt-4 text-xs text-[#718077]">
          数据来源：各校 Common Data Set 与官方发布 · 排名口径 US News 2026 ·
          RD 录取率标注「推算值」处为按 CDS 推算 · 录取率、标化等字段以官网为准 ·
          <span className="ml-1">数据更新 2026-08-11</span>
        </footer>
      </div>

      {compareOpen && slotColleges.length >= 2 && (
        <CompareModal
          colleges={slotColleges}
          onClose={() => setCompareRequested(false)}
          onRemove={removeSlot}
          matchRow={
            userSat != null
              ? { label: "初步区间", text: (c) => MATCH_LABEL[matchTags?.get(c.en) ?? "h"] }
              : null
          }
        />
      )}

      {matchOpen && (
        <MatchModal
          current={userSat}
          onApply={(sat) => {
            setSatPref(sat);
            setMatchOpen(false);
          }}
          onClear={() => {
            setSatPref(null);
            setFilters((prev) => ({ ...prev, match: "" }));
            setMatchOpen(false);
          }}
          onClose={() => setMatchOpen(false)}
        />
      )}
    </main>
  );
}
