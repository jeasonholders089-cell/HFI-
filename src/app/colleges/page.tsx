"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { CollegesProvider, FONT_ATTR, useLang, useT } from "@/components/colleges/colleges-context";
import { CollegesMap, type CollegesMapHandle } from "@/components/colleges/colleges-map";
import { CollegesTable } from "@/components/colleges/colleges-table";
import { CollegesToolbar } from "@/components/colleges/colleges-toolbar";
import { CompareModal } from "@/components/colleges/compare-modal";
import { CompareSlots } from "@/components/colleges/compare-slots";
import { ExportShortlist } from "@/components/colleges/export-shortlist";
import { MatchModal } from "@/components/colleges/match-modal";
import { SchoolProfile } from "@/components/colleges/school-profile";
import { SiteNav } from "@/components/site-nav";
import { COLLEGES } from "@/lib/colleges-data";
import { entryContextText, parseEntryContext } from "@/lib/colleges-entry";
import { favHints } from "@/lib/colleges-favs";
import {
  EMPTY_FILTERS,
  emptyKindFor,
  filterColleges,
  hasActiveFilters,
  type Filters,
  type InsightKey,
} from "@/lib/colleges-filter";
import { nameOf } from "@/lib/colleges-l10n";
import { matchLabel, matchTag, matchWhy, type MatchTag } from "@/lib/colleges-match";
import { setFontPref, setLangPref, setSatPref, toggleFavPref, useCollegePrefs } from "@/lib/colleges-prefs";
import { initialSlotState, slotReducer } from "@/lib/colleges-slots";
import { storageDegraded } from "@/lib/colleges-storage";

/**
 * 选校地图（docs/05 v0.6 / docs/08 v0.4）。
 *
 * 一期**不新增后端接口**：数据在构建期编译进 bundle，整页零网络请求（§2.1）。
 * 本文件只做三件事：状态装配、布局、把产品逻辑接到子组件上。
 */
export default function CollegesPage() {
  const prefs = useCollegePrefs();
  return (
    <CollegesProvider lang={prefs.lang} font={prefs.font}>
      <CollegesView />
    </CollegesProvider>
  );
}

const NOOP_SUB = () => () => {};

/** URL 查询串的外部存储：只影响顶部语境条，不参与任何筛选（§6.17）。 */
function subscribeUrl(cb: () => void): () => void {
  window.addEventListener("popstate", cb);
  // 自己 replace 之后 location 变了但 popstate 不触发，用自定义事件补一次
  window.addEventListener("hfi:urlchange", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("hfi:urlchange", cb);
  };
}

function CollegesView() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();

  // 对比位状态机走 lib/colleges-slots.ts —— 单测覆盖的就是这份逻辑
  const [slotState, dispatch] = useReducer(slotReducer, undefined, initialSlotState);
  const { browsing: selected, slots } = slotState;
  const [compareRequested, setCompareRequested] = useState(false);
  const [view, setView] = useState<"map" | "table">("map");
  const [exportOpen, setExportOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mapRef = useRef<CollegesMapHandle | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [insight, setInsight] = useState<InsightKey | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);

  // 收藏与匹配分数来自外部存储（§6.1）—— 刷新后仍在，
  // 且 hydration 由 useSyncExternalStore 处理，不用 effect + setState。
  const prefs = useCollegePrefs();
  const userSat = prefs.sat;
  const font = prefs.font;
  const favs = useMemo(() => new Set(prefs.favs), [prefs.favs]);

  const visible = useMemo(
    () => filterColleges(COLLEGES, { filters, insight, favOnly, favs, userSat }),
    [filters, insight, favOnly, favs, userSat],
  );

  /** 分档结果只算一次，地图 / 卡片 / 对比表都从这里读（H3 的三处同步）。 */
  const matchTags = useMemo(() => {
    if (userSat == null) return null;
    const m = new Map<string, MatchTag | null>();
    for (const c of COLLEGES) m.set(c.en, matchTag(c, userSat));
    return m;
  }, [userSat]);

  const matchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!matchTags) return counts;
    for (const tag of matchTags.values()) if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
    return counts;
  }, [matchTags]);

  const current = useMemo(
    () => (selected ? COLLEGES.find((c) => c.en === selected) ?? null : null),
    [selected],
  );
  const slotColleges = useMemo(
    () =>
      slots
        .map((en) => COLLEGES.find((c) => c.en === en))
        .filter((c): c is (typeof COLLEGES)[number] => !!c),
    [slots],
  );
  const favColleges = useMemo(() => COLLEGES.filter((c) => favs.has(c.en)), [favs]);
  const hints = useMemo(() => favHints(favColleges, userSat), [favColleges, userSat]);

  /** 唯一的写入入口。BROWSE 走 BROWSE —— 只改浏览位，**不动 slots**（核心不变量）。 */
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

  /** 字号三档循环（A → A+ → A++ → A），写在根元素上让 rem 文案整体缩放。 */
  const cycleFont = () => setFontPref((((font + 1) % 3) as 0 | 1 | 2));

  // §6.14：字号三档走 html[data-font]（"md" / "lg" / "xl"），rem 单位的文案与间距整体缩放。
  // 离开本页时移除，避免影响其他页面。
  useEffect(() => {
    document.documentElement.dataset.font = FONT_ATTR[font];
    return () => {
      delete document.documentElement.dataset.font;
    };
  }, [font]);

  /** E4：点表格行 → 切回地图 → 把该点移到视口中心 → 浏览位打开它。 */
  const openFromTable = useCallback(
    (en: string) => {
      setView("map");
      browse(en);
      setDrawerOpen(true);
      requestAnimationFrame(() => mapRef.current?.focusOn(en));
    },
    [browse],
  );

  const onMapSelect = useCallback(
    (en: string) => {
      browse(en);
      setDrawerOpen(true);
    },
    [browse],
  );

  const resetAll = () => {
    setFilters(EMPTY_FILTERS);
    setInsight(null);
    setFavOnly(false);
  };

  /* ---------------- 6.17 语境条（只影响顶部提示，不筛数据） ---------------- */
  const search = useSyncExternalStore(
    subscribeUrl,
    () => window.location.search,
    () => "",
  );
  const ctxText = entryContextText(parseEntryContext(search), lang);
  const clearCtx = () => {
    // replace 而不是 push：不留多余历史，后退一次回到来源页（§6.17）
    router.replace("/colleges");
    window.dispatchEvent(new Event("hfi:urlchange"));
  };

  /* ---------------- 6.16 空态 / 异常态 ---------------- */
  const noData = COLLEGES.length === 0;
  const emptyKind = emptyKindFor({ resultCount: visible.length, favOnly, favCount: favs.size, q: filters.q });

  const degraded = useSyncExternalStore(
    NOOP_SUB,
    () => storageDegraded(),
    () => false,
  );
  const [storageNoticeOff, setStorageNoticeOff] = useState(false);

  /* ---------------- G3 回到顶部：滚动超过一屏才出现 ---------------- */
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const backToTop = () => {
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  if (noData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#f4f0e6] text-[#17382f]">
        <p className="text-lg">{t("empty.loading")}</p>
        <p className="max-w-md text-center text-sm text-[#68786e]">{t("empty.loadingHint")}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f0e6] pb-28 text-[#17382f] lg:pb-8">
      <header className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-8 py-6">
        <Link href="/" className="text-xl tracking-[.18em]">
          HFI 家长成长营
        </Link>
        <div className="flex items-center gap-3">
          <SiteNav />
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={cycleFont}
              title={t("global.font")}
              aria-label={t("global.font")}
              className="h-8 rounded-md border border-[#aeb7ad] px-2.5 text-[#50645b] hover:border-[#8b6f45]"
            >
              {["A", "A+", "A++"][font]}
            </button>
            <button
              type="button"
              onClick={() => setLangPref(lang === "zh" ? "en" : "zh")}
              className="h-8 rounded-md border border-[#aeb7ad] px-2.5 text-[#50645b] hover:border-[#8b6f45]"
            >
              {t("global.lang")}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] flex-1 px-8 pb-8">
        <div className="mb-5">
          <p className="text-xs tracking-[.3em] text-[#8b6f45]">{t("page.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-light">{t("page.title")}</h1>
        </div>

        {/* 语境条（6.17）：来自哪条链路 —— 只提示，不筛数据 */}
        {ctxText && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#d6d2c7] bg-[#f8f5ed] px-4 py-2.5 text-sm">
            <span className="text-[#17382f]">{ctxText}</span>
            <span className="text-[0.6875rem] text-[#68786e]">{t("ctx.note")}</span>
            <button
              type="button"
              onClick={clearCtx}
              className="ml-auto rounded-md border border-[#aeb7ad] px-2.5 py-1 text-xs text-[#50645b] hover:border-[#8b6f45]"
            >
              {t("ctx.clear")}
            </button>
          </div>
        )}

        {/* 本地存储不可用（6.16）：提示一次，功能降级为会话内有效 */}
        {degraded && !storageNoticeOff && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#a26047] bg-[#f5ecdf] px-4 py-2.5 text-sm text-[#a26047]">
            <span>{t("warn.storage")}</span>
            <button
              type="button"
              onClick={() => setStorageNoticeOff(true)}
              className="ml-auto rounded-md border border-[#a26047] px-2.5 py-1 text-xs"
            >
              {t("warn.storageClose")}
            </button>
          </div>
        )}

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
          onExport={() => setExportOpen(true)}
          hints={hints}
          onBrowse={onMapSelect}
          active={active}
        />

        {/* 地图区与详情栏：比例来自 --colleges-map-ratio；<1024px 切上下布局 + 底部抽屉 */}
        <div className="colleges-split">
          {view === "map" ? (
            <section className="h-[58vh] min-h-[380px] overflow-hidden rounded-xl border border-[#d6d2c7]">
              {emptyKind ? (
                <EmptyState kind={emptyKind} onReset={resetAll} />
              ) : (
                <CollegesMap
                  ref={mapRef}
                  colleges={visible}
                  selected={selected}
                  slots={slots}
                  favs={favs}
                  matchTags={matchTags}
                  onSelect={onMapSelect}
                />
              )}
            </section>
          ) : (
            <section>
              {emptyKind ? (
                <div className="rounded-xl border border-[#d6d2c7] bg-white">
                  <EmptyState kind={emptyKind} onReset={resetAll} />
                </div>
              ) : (
                <CollegesTable
                  colleges={visible}
                  favs={favs}
                  onToggleFav={toggleFav}
                  onOpenDetail={openFromTable}
                  onRowClick={openFromTable}
                />
              )}
            </section>
          )}

          {/* min-h 只在 lg 以上生效：手机上如果留着 380px 最小高度，收起时会变成一大块空白压在页面底部 */}
          <aside className="flex flex-col overflow-hidden rounded-xl border border-[#d6d2c7] lg:min-h-[380px] max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-h-[78vh] max-lg:rounded-b-none">
            {/* 手机端折叠条：收起时只有一条窄条贴底（docs/06 7.8） */}
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              className="flex items-center justify-between gap-2 border-b border-[#d6d2c7] bg-[#17382f] px-4 py-2.5 text-sm text-white lg:hidden"
            >
              <span className="truncate">
                {current ? nameOf(current, lang) : t("empty.pane1")}
                {slots.length > 0 ? ` · ${t("slots.title", { n: slots.length })}` : ""}
              </span>
              <span className="shrink-0 text-xs text-white/80">
                {drawerOpen ? t("drawer.close") : t("drawer.open")}
              </span>
            </button>

            <div className={`${drawerOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
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
              <div className="min-h-0 flex-1 overflow-hidden bg-[#f8f5ed]">
                {current ? (
                  <SchoolProfile
                    college={current}
                    inSlot={slots.includes(current.en)}
                    slotsFull={slots.length >= 3}
                    isFav={favs.has(current.en)}
                    matchLabel={
                      userSat != null ? matchLabel(matchTags?.get(current.en) ?? "h", lang) : null
                    }
                    matchWhyText={userSat != null ? matchWhy(current, userSat, lang) : null}
                    onToggleSlot={() =>
                      slots.includes(current.en) ? removeSlot(current.en) : addSlot(current.en)
                    }
                    onToggleFav={() => toggleFav(current.en)}
                    onClose={closeBrowse}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                    <p className="text-sm text-[#68786e]">{t("empty.pane1")}</p>
                    <p className="text-sm text-[#68786e]">{t("empty.pane2")}</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* 6.3 的坑 2：地图区域不滚页面，给一行静态提示 */}
        {view === "map" && (
          <p className="mt-2 text-[0.6875rem] text-[#718077]">{t("map.hint")}</p>
        )}

        <footer className="mt-6 border-t border-[#d6d2c7] pt-4 text-xs text-[#718077]">
          {t("page.footer")}
        </footer>
      </div>

      {showTop && (
        <button
          type="button"
          onClick={backToTop}
          aria-label={t("global.backTop")}
          className="fixed bottom-6 right-6 z-30 h-10 w-10 rounded-full border border-[#d6d2c7] bg-white/95 text-[#50645b] shadow-md hover:border-[#8b6f45] hover:text-[#8b6f45] max-lg:bottom-20"
        >
          ↑
        </button>
      )}

      {compareOpen && slotColleges.length >= 2 && (
        <CompareModal
          colleges={slotColleges}
          onClose={() => setCompareRequested(false)}
          onRemove={removeSlot}
          matchRow={
            userSat != null
              ? { label: t("mt.bandHead"), text: (c) => matchLabel(matchTags?.get(c.en) ?? "h", lang) }
              : null
          }
        />
      )}

      {exportOpen && (
        <ExportShortlist colleges={favColleges} onClose={() => setExportOpen(false)} />
      )}

      {matchOpen && (
        <MatchModal
          current={userSat}
          onApply={(sat) => {
            setSatPref(sat);
            setMatchOpen(false);
          }}
          onClear={() => {
            // H6：只重置分数与档位筛选，不动其他状态
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

/** 6.16 的三种空态：文案各不相同，都带一键恢复。 */
function EmptyState({ kind, onReset }: { kind: "favs" | "search" | "filtered"; onReset: () => void }) {
  const t = useT();
  const text = kind === "favs" ? t("empty.favs") : kind === "search" ? t("empty.search") : t("empty.filtered");
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 bg-[#e8e6dc] p-6 text-center">
      <p className="text-sm text-[#50645b]">{text}</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-[#8b6f45] px-4 py-2 text-sm text-[#8b6f45]"
      >
        {t("empty.reset")}
      </button>
    </div>
  );
}
