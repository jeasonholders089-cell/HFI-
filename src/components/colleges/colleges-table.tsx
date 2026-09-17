"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLang, useT } from "@/components/colleges/colleges-context";
import type { College } from "@/lib/colleges-data";
import { nameOf } from "@/lib/colleges-l10n";
import { COLUMNS, columnLabel, nextSort, sortColleges } from "@/lib/colleges-table";

/**
 * 表格视图（docs/08 §6.8 / §6.9）。
 *
 * 三种横向滚动方式，三者双向同步：
 *   ① 拖顶部金棕滑块  ② 点两侧圆形按钮整屏平移  ③ 直接按住表格拖动
 * 前两列冻结：第二列的 left 由第一列的宽度推出，避免 1px 缝隙。
 */
type Props = {
  colleges: readonly College[];
  favs: ReadonlySet<string>;
  onToggleFav: (en: string) => void;
  onOpenDetail: (en: string) => void;
  onRowClick: (en: string) => void;
};

export function CollegesTable({ colleges, favs, onToggleFav, onOpenDetail, onRowClick }: Props) {
  const t = useT();
  const lang = useLang();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false, id: null as number | null });
  const [sc, setSc] = useState({ left: 0, total: 0, view: 0 });

  const rows = useMemo(() => sortColleges(colleges, sort, lang), [colleges, sort, lang]);
  const frozenW1 = COLUMNS[0].width;

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setSc({ left: el.scrollLeft, total: el.scrollWidth, view: el.clientWidth });
  }, []);

  useEffect(() => {
    sync();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync, rows.length]);

  const canLeft = sc.left > 1;
  const canRight = sc.left + sc.view < sc.total - 1;
  const ratio = sc.total > 0 ? sc.view / sc.total : 1;
  const thumbPct = Math.max(6, ratio * 100);

  return (
    <div className="rounded-xl border border-[#d6d2c7] bg-white">
      <div className="px-4 py-3 text-[0.6875rem] text-[#68786e]">
        {t("tbl.hint")}
      </div>

      <div className="relative mx-4 mb-3 h-3 rounded-full bg-[#e6e0d5]">
        <div
          role="scrollbar"
          aria-controls="colleges-table-scroll"
          aria-valuenow={Math.round(sc.left)}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, sc.total - sc.view)}
          tabIndex={0}
          className="absolute top-0 h-3 cursor-grab rounded-full bg-[#8b6f45]"
          style={{
            width: `${thumbPct}%`,
            left: sc.total > sc.view ? `${(sc.left / (sc.total - sc.view)) * (100 - thumbPct)}%` : "0%",
          }}
          onPointerDown={(e) => {
            const bar = e.currentTarget.parentElement;
            if (!bar) return;
            const rect = bar.getBoundingClientRect();
            const move = (clientX: number) => {
              const r = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
              const el = scrollRef.current;
              if (el) el.scrollLeft = r * (el.scrollWidth - el.clientWidth);
            };
            move(e.clientX);
            const onMove = (ev: PointerEvent) => move(ev.clientX);
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        />
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label={t("tbl.shiftLeft")}
          disabled={!canLeft}
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollLeft -= el.clientWidth;
          }}
          className="absolute left-2 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-full border border-[#d6d2c7] bg-white text-sm text-[#50645b] shadow disabled:opacity-30"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label={t("tbl.shiftRight")}
          disabled={!canRight}
          onClick={() => {
            const el = scrollRef.current;
            if (el) el.scrollLeft += el.clientWidth;
          }}
          className="absolute right-2 top-1/2 z-20 h-9 w-9 -translate-y-1/2 rounded-full border border-[#d6d2c7] bg-white text-sm text-[#50645b] shadow disabled:opacity-30"
        >
          ▶
        </button>

        <div
          id="colleges-table-scroll"
          ref={scrollRef}
          onScroll={sync}
          onPointerDown={(e) => {
            drag.current = {
              active: true,
              startX: e.clientX,
              startLeft: e.currentTarget.scrollLeft,
              moved: false,
              id: e.pointerId,
            };
          }}
          onPointerMove={(e) => {
            if (!drag.current.active || drag.current.id !== e.pointerId) return;
            const dx = e.clientX - drag.current.startX;
            if (!drag.current.moved && Math.abs(dx) > 6) drag.current.moved = true;
            if (drag.current.moved) e.currentTarget.scrollLeft = drag.current.startLeft - dx;
          }}
          onPointerUp={() => {
            drag.current.active = false;
            // moved 标记：拖动结束后抑制 click，避免"想拖动结果打开了详情"
            setTimeout(() => {
              drag.current.moved = false;
            }, 0);
          }}
          className="overflow-x-auto"
          style={{ touchAction: "pan-x" }}
        >
          <table className="border-collapse text-left text-[0.75rem]">
            <thead>
              <tr>
                {COLUMNS.map((col, i) => {
                  const isSorted = sort?.key === col.key;
                  const sticky = i === 0 || i === 1;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        left: i === 0 ? 0 : i === 1 ? frozenW1 : undefined,
                        background: "#f8f5ed",
                      }}
                      className={`border-b border-[#d6d2c7] px-2 py-2 font-normal text-[#68786e] ${
                        sticky ? "sticky z-10" : ""
                      } ${sticky && i === 1 ? "border-r border-[#e6e0d5]" : ""}`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => setSort((cur) => nextSort(cur, col.key))}
                          className="inline-flex items-center gap-1 hover:text-[#8b6f45]"
                        >
                          {columnLabel(col, lang)}
                          <span className="text-[0.625rem] text-[#9aa59c]">
                            {isSorted ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </button>
                      ) : (
                        columnLabel(col, lang)
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const isFav = favs.has(c.en);
                return (
                  <tr
                    key={c.en}
                    tabIndex={0}
                    onClick={() => {
                      if (!drag.current.moved) onRowClick(c.en);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onRowClick(c.en);
                    }}
                    className="cursor-pointer border-b border-[#efebe3] hover:bg-[#f5ecdf]"
                  >
                    {COLUMNS.map((col, i) => {
                      const sticky = i === 0 || i === 1;
                      return (
                        <td
                          key={col.key}
                          style={{
                            width: col.width,
                            minWidth: col.width,
                            left: i === 0 ? 0 : i === 1 ? frozenW1 : undefined,
                            background: sticky ? "#ffffff" : undefined,
                          }}
                          className={`px-2 py-2 text-[#17382f] ${sticky ? "sticky z-[5]" : ""} ${
                            sticky && i === 1 ? "border-r border-[#e6e0d5]" : ""
                          } ${col.key === "note" ? "whitespace-normal" : "whitespace-nowrap"}`}
                        >
                          {col.key === "detail" ? (
                            <span className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                aria-label={
                                  isFav
                                    ? t("fav.remove") + " " + nameOf(c, lang)
                                    : t("fav.add") + " " + nameOf(c, lang)
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleFav(c.en);
                                }}
                                className={isFav ? "text-[#8b6f45]" : "text-[#9aa59c]"}
                              >
                                {isFav ? "★" : "☆"}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDetail(c.en);
                                }}
                                className="text-[#8b6f45] hover:underline"
                              >
                                {t("tbl.detail")}
                              </button>
                            </span>
                          ) : (
                            col.text(c, lang)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-[#e6e0d5] px-4 py-2 text-[0.6875rem] text-[#68786e]">
        {t("tbl.rows", { n: rows.length })}
      </div>
    </div>
  );
}
