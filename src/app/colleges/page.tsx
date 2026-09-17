"use client";

import Link from "next/link";
import { useCallback, useMemo, useReducer, useState } from "react";

import { SiteNav } from "@/components/site-nav";
import { CompareModal } from "@/components/colleges/compare-modal";
import { CompareSlots } from "@/components/colleges/compare-slots";
import { CollegesMap } from "@/components/colleges/colleges-map";
import { SchoolProfile } from "@/components/colleges/school-profile";
import { COLLEGES } from "@/lib/colleges-data";
import { initialSlotState, slotReducer } from "@/lib/colleges-slots";

/**
 * 选校地图（docs/05 v0.6 / docs/08 v0.4）。
 *
 * M2 阶段：地图 + 打点 + 缩放平移 + 最近点拾取 + 悬停 + 州名/院校名标注。
 * 工具栏筛选、详情档案 15 节、对比位、表格视图、洞察榜、黑马匹配分别在 M3 到 M5 接入。
 * 一期**不新增后端接口**——数据在构建期编译进 bundle，整页零网络请求（docs/08 §2.1）。
 */
export default function CollegesPage() {
  // 对比位状态机走 lib/colleges-slots.ts —— 单测覆盖的就是这份逻辑（docs/08 §5.3）
  const [slotState, dispatch] = useReducer(slotReducer, undefined, initialSlotState);
  const { browsing: selected, slots } = slotState;
  // 用「是否请求过对比」派生，而不是在 effect 里 setState ——
  // 后者会触发级联渲染（react-hooks/set-state-in-effect）。
  const [compareRequested, setCompareRequested] = useState(false);
  const compareOpen = compareRequested && slots.length >= 2;

  // M2 阶段先不做筛选，渲染全量；M4 接入过滤管线
  const visible = COLLEGES;
  const current = useMemo(
    () => (selected ? visible.find((c) => c.en === selected) ?? null : null),
    [selected, visible],
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

  return (
    <main className="flex min-h-screen flex-col bg-[#f4f0e6] text-[#17382f]">
      <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-8 py-6">
        <Link href="/" className="text-xl tracking-[.18em]">
          HFI 家长成长营
        </Link>
        <SiteNav />
      </header>

      <div className="mx-auto w-full max-w-[1600px] flex-1 px-8 pb-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[.3em] text-[#8b6f45]">US COLLEGE MAP · 2026</p>
            <h1 className="mt-2 text-3xl font-light">美国有哪些学校，都在哪儿</h1>
          </div>
          <p className="text-sm text-[#607168]">
            共 <b className="text-[#17382f]">{visible.length}</b> 所院校
          </p>
        </div>

        {/* 地图区与详情栏：固定比例，不做拖拽（docs/05 3.5） */}
        <div className="grid gap-5 lg:grid-cols-[62fr_38fr]">
          <section className="h-[62vh] min-h-[380px] overflow-hidden rounded-xl border border-[#d6d2c7]">
            <CollegesMap
              colleges={visible}
              selected={selected}
              slots={slots}
              onSelect={browse}
            />
          </section>

          <aside className="flex min-h-[380px] flex-col overflow-hidden rounded-xl border border-[#d6d2c7]">
            {/* ① 对比位：顶部常驻（docs/05 3.3） */}
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
                  onToggleSlot={() =>
                    slots.includes(current.en) ? removeSlot(current.en) : addSlot(current.en)
                  }
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
          数据来源：各校 Common Data Set 与官方发布 · 排名口径 US News 2026 · 录取率等字段以官网为准 ·
          <span className="ml-1">数据更新 2026-08-11</span>
        </footer>
      </div>
      {compareOpen && slotColleges.length >= 2 && (
    <CompareModal
      colleges={slotColleges}
      onClose={() => setCompareRequested(false)}
      onRemove={removeSlot}
    />
  )}
    </main>
  );
}
