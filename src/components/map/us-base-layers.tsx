"use client";

import { MAP_H, MAP_W } from "@/lib/map-project";
import { NEIGHBOR_LAND, STATE_PATHS, US_INSETS } from "@/lib/us-map-paths";

/**
 * 美国底图三层 —— 选校地图与现场全景共用（docs/11 §1.3 / §4.1）。
 *
 * 从 `components/colleges/colleges-map.tsx` 里原样搬出来，**只搬不改**：
 * 三层结构与类名（`g.land-shadow` / `fill="var(--map-land)"` …）不变，
 * 选校地图的既有测试继续守着它。
 *
 * 这一层**不含任何交互**：州悬停高亮由 `hoverState` / `onHoverState` 从外面驱动，
 * 不传就是纯静态底图。缩放补偿也由外面的 `k` 决定（现场全景恒定 k = 1）。
 */
type Props = {
  /** 缩放补偿（选校地图会传 k，现场全景恒定 1） */
  k?: number;
  /** 州悬停高亮；不传就是纯静态底图 */
  hoverState?: string | null;
  onHoverState?: (st: string | null) => void;
};

export function UsBaseLayers({ k = 1, hoverState = null, onHoverState }: Props) {
  const comp = Math.max(1, k ** 0.5);

  return (
    <>
      {/*
        ① 海洋：整块矩形，**单一颜色**（最底层，其余都压在上面）。
        不用渐变：容器宽高比与 viewBox 宽高比不一致时，SVG 会在两侧或上下留白，
        渐变会在「内容区」与「留白区」之间露出一条接缝。纯色 + 和容器同色，
        接缝就不存在了 —— "陆地之外都是海洋"。
      */}
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="var(--map-ocean)" pointerEvents="none" />

      {/* ② 邻国陆地（加拿大 / 墨西哥 / 巴哈马 / 古巴）：平涂，比美国本土深一档 */}
      <g aria-hidden>
        {NEIGHBOR_LAND.map((n) => (
          <path
            key={n.id}
            d={n.d}
            fill="var(--map-neighbor)"
            stroke="var(--map-neighbor-line)"
            strokeWidth={1 / comp}
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}
      </g>

      {/*
        ③ 美国：本土 49 州 + 阿拉斯加 / 夏威夷插图，整组带投影。
        投影是把它从邻国陆地上"抬起来"的那一下 —— 也是这三层里唯一的层级信号。
      */}
      <g className="land-shadow">
        {US_INSETS.map((ins) => (
          <g key={ins.st} transform={ins.transform}>
            <path
              d={ins.d}
              fill="var(--map-land)"
              stroke="var(--map-inset-line)"
              strokeWidth={1.1 / comp}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          </g>
        ))}
        {STATE_PATHS.map((s) => {
          const hot = hoverState === s.st;
          return (
            <path
              key={s.st}
              d={s.d}
              fill={hot ? "var(--map-land-hover)" : "var(--map-land)"}
              stroke={hot ? "var(--map-land-hover-line)" : "var(--map-land-line)"}
              strokeWidth={(hot ? 1.2 : 1.1) / comp}
              strokeLinejoin="round"
              onPointerEnter={onHoverState ? () => onHoverState(s.st) : undefined}
              onPointerLeave={onHoverState ? () => onHoverState(null) : undefined}
            />
          );
        })}
      </g>
    </>
  );
}
