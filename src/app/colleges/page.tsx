"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SiteNav } from "@/components/site-nav";
import { CollegesMap } from "@/components/colleges/colleges-map";
import { COLLEGES } from "@/lib/colleges-data";
import { formatField } from "@/lib/colleges-format";

/**
 * 选校地图（docs/05 v0.6 / docs/08 v0.4）。
 *
 * M2 阶段：地图 + 打点 + 缩放平移 + 最近点拾取 + 悬停 + 州名/院校名标注。
 * 工具栏筛选、详情档案 15 节、对比位、表格视图、洞察榜、黑马匹配分别在 M3 到 M5 接入。
 * 一期**不新增后端接口**——数据在构建期编译进 bundle，整页零网络请求（docs/08 §2.1）。
 */
export default function CollegesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);

  // M2 阶段先不做筛选，渲染全量；M4 接入过滤管线
  const visible = COLLEGES;
  const current = useMemo(
    () => (selected ? visible.find((c) => c.en === selected) ?? null : null),
    [selected, visible],
  );

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
              onSelect={setSelected}
            />
          </section>

          <aside className="flex min-h-[380px] flex-col rounded-xl border border-[#d6d2c7] bg-[#f8f5ed]">
            {current ? (
              <div className="flex-1 overflow-auto p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl">{current.zh}</h2>
                    <p className="mt-1 text-sm text-[#68786e]">{current.en}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="关闭"
                    className="h-7 w-7 shrink-0 rounded-md bg-[#e6e0d5] text-sm text-[#68786e]"
                  >
                    ✕
                  </button>
                </div>

                <p className="mt-3 text-xs text-[#8b6f45]">
                  {current.type === "lac" ? "文理学院" : current.pub === 1 ? "公立综合性大学" : "私立综合性大学"}
                  {" · "}US News 2026 第 {current.rank} 名
                </p>

                <dl className="mt-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-[#8b6f45]">所在城市与州</dt>
                    <dd className="mt-0.5">
                      {current.city}, {current.st}
                    </dd>
                    <dd className="mt-0.5 text-xs text-[#68786e]">{current.cz}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#8b6f45]">一句话点评</dt>
                    <dd className="mt-0.5 leading-6">{current.nz}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#8b6f45]">录取率（整体）</dt>
                    <dd className="mt-0.5">{formatField(current.acc, "percent")}</dd>
                  </div>
                </dl>

                <p className="mt-5 border-t border-[#d6d2c7] pt-4 text-xs text-[#68786e]">
                  完整的 15 节档案、加入对比、表格视图、筛选与洞察榜将在后续里程碑接入。
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-sm text-[#68786e]">点地图上的圆点</p>
                <p className="text-sm text-[#68786e]">查看院校详情</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="mt-6 border-t border-[#d6d2c7] pt-4 text-xs text-[#718077]">
          数据来源：各校 Common Data Set 与官方发布 · 排名口径 US News 2026 · 录取率等字段以官网为准 ·
          <span className="ml-1">数据更新 2026-08-11</span>
        </footer>
      </div>
    </main>
  );
}
