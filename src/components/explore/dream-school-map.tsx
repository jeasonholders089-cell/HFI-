"use client";

import { useMemo } from "react";

import { UsBaseLayers } from "@/components/map/us-base-layers";
import { layoutLabels } from "@/lib/colleges-labels";
import { MAP_H, MAP_W, project } from "@/lib/map-project";

/**
 * 梦想院校地图（docs/10 §3.2 / docs/11 §4.1、§5）。
 *
 * 大屏头三秒要回答「今天现场有多少人、往哪走」。只给**人数**，不给姓名 ——
 * 「谁选了哪所学校」正是 AGENTS.md 第五节禁止的组合，所以接口与组件里都不出现姓名。
 *
 * 做：底图三层 + 人数气泡 + 前 12 名标签 + `<title>` 悬停（零 JS）。
 * 不做：缩放、平移、双击、筛选、搜索、洞察榜、对比位、详情栏、表格视图、点击跳转。
 *
 * **信息承载者是标签，不是悬停**（docs/11 §5 的 v1.1 改写，评审 M2）：
 * 大屏前面没有鼠标，悬停只可能是工作人员在笔记本上预览时的加分项。
 * 所以标签名额拉到 12 且**带单位**，验收口径是"不悬停、不点击也能说出人数最多的 3 所"。
 */
export type DreamSchoolMapItem = {
  name: string;
  count: number;
  matched: boolean;
  st: string | null;
  lat: number | null;
  lng: number | null;
};

/** 挂标签的名次数（docs/11 §5：v1.1 从 8 提到 12——标签才是信息承载者）。 */
const LABEL_TOP = 12;
const LABEL_FS = 11;

/** 气泡半径：1 人 ≈ 7.7、4 人 ≈ 10.9、9 人 ≈ 14.1、16 人以上封顶 15（docs/11 §5）。 */
export function bubbleRadius(count: number): number {
  return Math.min(15, 4.5 + 3.2 * Math.sqrt(Math.max(0, count)));
}

type Placed = DreamSchoolMapItem & { x: number; y: number; rank: number };

function placesLabel(n: number): string {
  return n === 0 ? "当前没有可显示的院校" : `当前显示 ${n} 所`;
}

export function DreamSchoolMap({
  schools,
  className = "",
}: {
  schools: readonly DreamSchoolMapItem[];
  className?: string;
}) {
  const placed: Placed[] = useMemo(
    () =>
      schools
        .filter((s) => s.matched && s.lat !== null && s.lng !== null)
        .map((s, i) => {
          const [x, y] = project(s.lat as number, s.lng as number);
          return { ...s, x, y, rank: i };
        }),
    [schools],
  );

  const labels = useMemo(() => {
    if (!placed.length) return [];
    const offsetX = bubbleRadius(placed[0].count) + 4;
    return layoutLabels(
      placed.slice(0, LABEL_TOP).map((p) => ({
        en: p.name,
        x: p.x,
        y: p.y,
        rank: p.rank,
        // 补单位（评审 M4）：单所院校那个数是"填了它的孩子数"，量词是「人」
        text: `${p.name} · ${p.count} 人`,
      })),
      LABEL_FS,
      { x: 0, y: 0, w: MAP_W, h: MAP_H },
      offsetX,
      5,
      LABEL_TOP,
    );
  }, [placed]);

  const empty = placed.length === 0;
  const emptyText =
    schools.length === 0 ? "还没有录入孩子的梦想院校" : "已录入的梦想院校都还没有收录坐标";

  return (
    <div
      /*
        高度 min(52vh, 520px)（v1.1 评审 M5）：原来 58vh 在 1080p 上是 626px，
        加上标题行与说明会把 8 类条形图挤到折线以下——"往哪走"要滚，而大屏没人会滚。
        手机上仍是 42vh（容器 < 640px），避免一块地图占满整屏。
      */
      className={`relative h-[42vh] min-h-[240px] w-full overflow-hidden sm:h-[min(52vh,520px)] ${className}`}
      style={{ background: "var(--map-ocean)" }}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="h-full w-full select-none"
        role="img"
        aria-label={`孩子们填的梦想院校分布地图，${placesLabel(placed.length)}`}
      >
        <UsBaseLayers />

        {/* 人数气泡：只画收录了坐标的学校 */}
        <g className="dream-dots">
          {placed.map((p) => (
            <circle
              key={p.name}
              cx={p.x}
              cy={p.y}
              r={bubbleRadius(p.count)}
              fill="var(--dot-lac)"
              fillOpacity={0.9}
              stroke="var(--map-land)"
              strokeWidth={1}
            >
              {/*
                悬停看人数：SVG 原生 <title>，零 JS、零状态。
                这里**不能**加 pointerEvents="none" —— 那会让 circle 不参与 hit-test，
                原生 <title> 根本不会触发（评审 M2）。选校地图那边需要它是因为要
                让位给平移与最近点拾取；本页没有平移与拾取，不需要。
              */}
              <title>{`${p.name} · ${p.count} 人`}</title>
            </circle>
          ))}
        </g>

        {labels.length > 0 && (
          <g aria-hidden className="dream-labels">
            {labels.map((l) => (
              <text key={l.en} x={l.x} y={l.y} fontSize={l.fs} fill="#211d18" pointerEvents="none">
                {l.text}
              </text>
            ))}
          </g>
        )}
      </svg>

      {/* 空态：底图照常画，不白屏（docs/11 §4.4） */}
      {empty && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm text-[#50645b]">
          {emptyText}
        </p>
      )}
    </div>
  );
}
