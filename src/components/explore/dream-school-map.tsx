"use client";

import { useMemo } from "react";

import { UsBaseLayers } from "@/components/map/us-base-layers";
import { layoutLabels } from "@/lib/colleges-labels";
import { MAP_H, MAP_W, project } from "@/lib/map-project";

/**
 * 梦想院校地图（docs/10 §3.2 / docs/11 §4.1、§5）。
 *
 * 大屏头三秒要回答「今天现场有多少人、往哪走」。只给**人次**，不给姓名 ——
 * 「谁选了哪所学校」正是 AGENTS.md 第五节禁止的组合，所以接口与组件里都不出现姓名。
 *
 * 做：底图三层 + 人次气泡 + 前 8 名标签 + `<title>` 悬停（零 JS）。
 * 不做：缩放、平移、双击、筛选、搜索、洞察榜、对比位、详情栏、表格视图、点击跳转。
 * 本页唯一的交互是悬停看人次。
 */
export type DreamSchoolMapItem = {
  name: string;
  count: number;
  matched: boolean;
  st: string | null;
  lat: number | null;
  lng: number | null;
};

/** 挂标签的名次数（docs/11 §5：产品方案给的 8–10，技术层定为 8）。 */
const LABEL_TOP = 8;
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
        text: `${p.name} · ${p.count}`,
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
      // 手机上降到 42vh（容器宽度 < 640px），避免一块地图占满整屏
      className={`relative h-[42vh] min-h-[240px] w-full overflow-hidden sm:h-[58vh] ${className}`}
      style={{ background: "var(--map-ocean)" }}
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="h-full w-full select-none"
        role="img"
        aria-label={`孩子们填的梦想院校分布地图，${placesLabel(placed.length)}`}
      >
        <UsBaseLayers />

        {/* 人次气泡：只画收录了坐标的学校 */}
        <g className="dream-dots">
          {placed.map((p) => (
            <circle
              key={p.name}
              data-school={p.name}
              data-count={p.count}
              cx={p.x}
              cy={p.y}
              r={bubbleRadius(p.count)}
              fill="var(--dot-lac)"
              fillOpacity={0.9}
              stroke="var(--map-land)"
              strokeWidth={1}
              pointerEvents="none"
            >
              {/* 悬停看人次：SVG 原生 title，零 JS、零状态 */}
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
